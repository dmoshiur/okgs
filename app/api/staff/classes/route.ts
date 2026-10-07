import { fail, num, ok, safeId, staff, str } from "@/lib/api";
import { classFeeTotals, createClass, deleteClass, listClasses, logActivity, sectionList, studentsByClass, syncClassFeeDues, updateClass } from "@/lib/portal-db";

export const dynamic = "force-dynamic";

/** GET — every class with its sections and how many students sit in each. */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const fairSlug = new URL(request.url).searchParams.get("fair") || undefined;
  const [classes, grouped, fees] = await Promise.all([listClasses(), studentsByClass(), classFeeTotals(fairSlug)]);
  const feeByClass = new Map(fees.rows.map((row) => [row.class_level, row]));
  const counts = new Map<string, { total: number; sections: Record<string, number> }>();
  for (const row of grouped) {
    const entry = counts.get(row.class_level) ?? { total: 0, sections: {} };
    entry.total += row.total;
    entry.sections[row.section] = (entry.sections[row.section] ?? 0) + row.total;
    counts.set(row.class_level, entry);
  }
  return ok({
    classes: classes.map((item) => ({
      ...item,
      section_list: sectionList(item.sections),
      students: counts.get(item.name)?.total ?? 0,
      students_by_section: counts.get(item.name)?.sections ?? {},
      fee_summary: feeByClass.get(item.name) ?? { expected: 0, collected: 0, pending: 0, students: counts.get(item.name)?.total ?? 0, fee_amount: Number(item.fee_amount ?? 0), title: item.fee_title, session_year: item.fee_session },
    })),
    fee_totals: fees,
  });
}

/** POST — add a class (sections are a comma separated list, e.g. "ক, খ"). */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(body.name);
  if (!name) return fail("শ্রেণির নাম দিন।", 422);
  const id = await createClass({
    name,
    level: num(body.level),
    sections: str(body.sections, "ক") || "ক",
    note: str(body.note),
    fee_amount: Math.max(0, num(body.fee_amount)),
    fee_title: str(body.fee_title, "শ্রেণি ফি") || "শ্রেণি ফি",
    fee_session: str(body.fee_session) || String(new Date().getFullYear()),
    sort_order: num(body.sort_order),
  });
  const createdClass = (await listClasses()).find((item) => item.id === id);
  const feeSync = createdClass && Number(createdClass.fee_amount) > 0
    ? await syncClassFeeDues(createdClass, str(body.fair_slug), session.user.name)
    : { created: 0, updated: 0 };
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "class.create", entity: "classes", entity_id: id, detail: name });
  return ok({ id, fee_sync: feeSync }, 201);
}

export async function PATCH(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("কোন শ্রেণি ঠিক নেই।", 422);
  await updateClass(id, {
    ...(("name" in body) ? { name: str(body.name) } : {}),
    ...(("level" in body) ? { level: num(body.level) } : {}),
    ...(("sections" in body) ? { sections: str(body.sections) } : {}),
    ...(("note" in body) ? { note: str(body.note) } : {}),
    ...(("fee_amount" in body) ? { fee_amount: Math.max(0, num(body.fee_amount)) } : {}),
    ...(("fee_title" in body) ? { fee_title: str(body.fee_title) || "শ্রেণি ফি" } : {}),
    ...(("fee_session" in body) ? { fee_session: str(body.fee_session) } : {}),
    ...(("sort_order" in body) ? { sort_order: num(body.sort_order) } : {}),
    ...(("is_active" in body) ? { is_active: Number(body.is_active) ? 1 : 0 } : {}),
  });
  const updatedClass = (await listClasses()).find((item) => item.id === id);
  const shouldSyncFee = ["fee_amount", "fee_title", "fee_session", "name"].some((key) => key in body);
  const feeSync = shouldSyncFee && updatedClass
    ? await syncClassFeeDues(updatedClass, str(body.fair_slug), session.user.name)
    : { created: 0, updated: 0 };
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "class.update", entity: "classes", entity_id: id, detail: "শ্রেণি/ফি সেটিংস আপডেট" });
  return ok({ updated: true, fee_sync: feeSync });
}

export async function DELETE(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("আইডি ঠিক নেই।", 422);
  const removed = await deleteClass(id);
  if (!removed) return fail("শ্রেণি পাওয়া যায়নি।", 404);
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "class.delete", entity: "classes", entity_id: id });
  return ok({ deleted: true });
}
