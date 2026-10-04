import { defaultFairSlug, fail, num, ok, safeId, staff, str } from "@/lib/api";
import { createDue, deleteDue, listClasses, listDues, logActivity, listUsers, sectionList, updateDue } from "@/lib/portal-db";

export const dynamic = "force-dynamic";

/** Dues — what each student still owes for the fair, a club trip, or anything else. */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const params = new URL(request.url).searchParams;
  const dues = await listDues({
    fair_slug: params.get("fair") || undefined,
    class_level: params.get("class") || undefined,
    status: params.get("status") || undefined,
    limit: num(params.get("limit"), 800),
  });
  return ok({ dues });
}

/**
 * POST — create a due for one student, or spread one title across a whole class
 * with `{ bulk: true, class_level, section, amount, title, due_date }`.
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const fairSlug = str(body.fair_slug) || (await defaultFairSlug());
  const amount = Number(body.amount ?? 0);
  const title = str(body.title, "বিজ্ঞান মেলা ফি") || "বিজ্ঞান মেলা ফি";
  if (!Number.isFinite(amount) || amount <= 0) return fail("টাকার পরিমাণ ঠিকভাবে দিন।", 422);

  if (body.bulk) {
    const classLevel = str(body.class_level);
    const section = str(body.section);
    const users = await listUsers({ role: "student", class_level: classLevel || undefined, limit: 2000 });
    const targets = users.filter((user) => !section || user.section === section);
    if (!targets.length) return fail("এই শ্রেণি/শাখায় কোনো শিক্ষার্থী পাওয়া যায়নি — আগে ইউজার যোগ করুন।", 422);
    for (const student of targets) {
      await createDue({
        fair_slug: fairSlug,
        user_id: student.id,
        student_name: student.name,
        student_id: student.student_id,
        class_level: student.class_level,
        section: student.section,
        title,
        amount,
        due_date: str(body.due_date),
        note: str(body.note),
        status: "due",
        created_by: session.user.name,
      });
    }
    await logActivity({
      actor_id: session.user.id,
      actor_name: session.user.name,
      actor_role: session.role,
      action: "due.bulk",
      entity: "dues",
      detail: `${targets.length} জন · ${title} · ${amount}`,
    });
    return ok({ created: targets.length }, 201);
  }

  const id = await createDue({
    fair_slug: fairSlug,
    user_id: str(body.user_id),
    student_name: str(body.student_name),
    student_id: str(body.student_id).toUpperCase(),
    class_level: str(body.class_level),
    section: str(body.section),
    title,
    amount,
    paid_amount: num(body.paid_amount),
    due_date: str(body.due_date),
    note: str(body.note),
    status: str(body.status, "due") || "due",
    created_by: session.user.name,
  });
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "due.create", entity: "dues", entity_id: id, detail: `${title} · ${amount}` });
  return ok({ id }, 201);
}

export async function PATCH(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("আইডি ঠিক নেই।", 422);
  const patch: Record<string, string | number> = {};
  if ("status" in body) patch.status = str(body.status);
  if ("paid_amount" in body) {
    const paid = Math.max(0, Number(body.paid_amount) || 0);
    patch.paid_amount = paid;
    if (!("status" in body)) {
      const dues = await listDues({ limit: 1000 });
      const due = dues.find((item) => item.id === id);
      if (due) patch.status = paid >= Number(due.amount) ? "paid" : paid > 0 ? "partial" : "due";
    }
  }
  if ("amount" in body) patch.amount = Number(body.amount) || 0;
  if ("title" in body) patch.title = str(body.title);
  if ("due_date" in body) patch.due_date = str(body.due_date);
  if ("note" in body) patch.note = str(body.note);
  if ("student_name" in body) patch.student_name = str(body.student_name);
  await updateDue(id, patch);
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "due.update", entity: "dues", entity_id: id, detail: Object.keys(patch).join(", ") });
  return ok({ updated: true });
}

export async function DELETE(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("আইডি ঠিক নেই।", 422);
  const removed = await deleteDue(id);
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "due.delete", entity: "dues", entity_id: id });
  return ok({ deleted: removed });
}

/** PUT — the class/section picker for the bulk form. */
export async function PUT() {
  const guard = await staff();
  if ("status" in guard) return guard;
  const classes = await listClasses(true);
  return ok({
    classes: classes.map((item) => ({ name: item.name, level: item.level, sections: sectionList(item.sections) })),
  });
}
