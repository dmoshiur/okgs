import { defaultFairSlug, fail, ok, safeId, staff, str } from "@/lib/api";
import { logActivity } from "@/lib/portal-db";
import { createGuest, getStudentById, guestRelationLabel, listGuests } from "@/lib/student-db";

export const dynamic = "force-dynamic";

/** GET /api/staff/guests?fair=&student_id= — registered outside guests. */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const url = new URL(request.url);
  const fair = str(url.searchParams.get("fair")) || (await defaultFairSlug());
  const studentId = str(url.searchParams.get("student_id"));
  const guests = await listGuests({ fair_slug: fair, student_id: studentId || undefined });
  return ok({ guests });
}

/** POST /api/staff/guests — register a temporary outside guest for a student. */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(body.name);
  const contact = str(body.contact);
  const relatedId = str(body.related_student_id);
  const relation = guestRelationLabel(str(body.relation));
  const fair = str(body.fair_slug) || (await defaultFairSlug());

  if (!name) return fail("Guest name is required.", 422);
  if (contact && !/^[+0-9 ()-]{6,20}$/.test(contact)) return fail("Enter a valid contact number.", 422);
  if (!safeId(relatedId)) return fail("Choose the student this guest is visiting or accompanying.", 422);
  // `Mama`, `mama` and `Mama (maternal uncle)` all mean the same relation; the
  // canonical label is what lands in the database and on the printed ticket.
  if (!relation) return fail("Choose the relation — Mama, Chacha, Fufa, Khala, Phupu, Guardian or Other guest.", 422);

  const student = await getStudentById(relatedId);
  if (!student) return fail("The related student was not found.", 404);

  const guest = await createGuest({
    fair_slug: fair,
    name,
    contact,
    related_student_id: relatedId,
    relation,
    created_by: session.user.id,
    created_by_name: session.user.name,
  });

  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: "guest.register",
    entity: "guests",
    entity_id: guest?.id ?? "",
    detail: `${name} (${relation}) for ${student.name} · ${student.student_code}`,
  });

  return ok({ guest }, 201);
}
