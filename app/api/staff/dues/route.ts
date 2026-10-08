import { defaultFairSlug, fail, num, ok, safeId, staff, str } from "@/lib/api";
import { createDue, deleteDue, dueReceiptTotals, getDueById, listClasses, listDues, logActivity, listUsers, sectionList, syncDuePayment, updateDue } from "@/lib/portal-db";

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
  const title = str(body.title, "Science fair fee") || "Science fair fee";
  if (!Number.isFinite(amount) || amount <= 0) return fail("Enter a valid amount.", 422);
  if (num(body.paid_amount) > 0 || ["paid", "partial"].includes(str(body.status))) return fail("Record payment by adding a receipt against the due.", 422);

  if (body.bulk) {
    const classLevel = str(body.class_level);
    const section = str(body.section);
    const users = await listUsers({ role: "student", class_level: classLevel || undefined, limit: 2000 });
    const targets = users.filter((user) => Number(user.is_active) === 1 && (!section || user.section === section));
    if (!targets.length) return fail("No students found in this class/section — add users first.", 422);
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
      detail: `${targets.length} students · ${title} · ${amount}`,
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
    paid_amount: 0,
    due_date: str(body.due_date),
    note: str(body.note),
    status: "due",
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
  if (!id) return fail("Invalid ID.", 422);
  const existing = await getDueById(id);
  if (!existing) return fail("Due not found.", 404);
  if ("paid_amount" in body || ["paid", "partial"].includes(str(body.status))) {
    return fail("Record payments by adding a receipt; paid_amount cannot be edited directly.", 422);
  }
  const patch: Record<string, string | number> = {};
  if ("amount" in body) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return fail("Due amount must be greater than zero.", 422);
    patch.amount = amount;
  }
  if ("title" in body) patch.title = str(body.title);
  if ("due_date" in body) patch.due_date = str(body.due_date);
  if ("note" in body) patch.note = str(body.note);
  if ("student_name" in body) patch.student_name = str(body.student_name);
  if ("student_id" in body) patch.student_id = str(body.student_id).toUpperCase();
  if ("class_level" in body) patch.class_level = str(body.class_level);
  if ("section" in body) patch.section = str(body.section);
  await updateDue(id, patch);
  if ("amount" in body) await syncDuePayment(id);
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "due.update", entity: "dues", entity_id: id, detail: Object.keys(patch).join(", ") });
  return ok({ updated: true });
}

export async function DELETE(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("Invalid ID.", 422);
  const due = await getDueById(id);
  if (!due) return fail("Due not found.", 404);
  const receiptTotals = await dueReceiptTotals(id);
  if (receiptTotals.count) return fail("This due has receipts linked. Delete or correct the receipts first, then delete the due.", 409);
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
