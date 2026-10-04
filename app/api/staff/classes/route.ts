import { fail, num, ok, safeId, staff, str } from "@/lib/api";
import { createClass, deleteClass, listClasses, logActivity, sectionList, studentsByClass, updateClass } from "@/lib/portal-db";

export const dynamic = "force-dynamic";

/** GET — every class with its sections and how many students sit in each. */
export async function GET() {
  const guard = await staff();
  if ("status" in guard) return guard;
  const [classes, grouped] = await Promise.all([listClasses(), studentsByClass()]);
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
    })),
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
    sort_order: num(body.sort_order),
  });
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "class.create", entity: "classes", entity_id: id, detail: name });
  return ok({ id }, 201);
}

export async function PATCH(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("কোন শ্রেণি ঠিক নেই।", 422);
  await updateClass(id, {
    ...(("name" in body) ? { name: str(body.name) } : {}),
    ...(("level" in body) ? { level: num(body.level) } : {}),
    ...(("sections" in body) ? { sections: str(body.sections) } : {}),
    ...(("note" in body) ? { note: str(body.note) } : {}),
    ...(("sort_order" in body) ? { sort_order: num(body.sort_order) } : {}),
    ...(("is_active" in body) ? { is_active: Number(body.is_active) ? 1 : 0 } : {}),
  });
  return ok({ updated: true });
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
