import { defaultFairSlug, fail, ok, safeId, staff, str } from "@/lib/api";
import { GUEST_ENTRY_FEE, GUEST_LUNCH_FEE, guestFeeBreakdown } from "@/lib/guest-fees";
import { logActivity } from "@/lib/portal-db";
import { createGuest, getStudentById, guestRelationLabel, listGuests } from "@/lib/student-db";

export const dynamic = "force-dynamic";

/** Absolute http(s) URL — what the database stores for a photo. */
function isPhotoUrl(value: unknown) {
  return /^https?:\/\/[^\s"'<>]+$/i.test(String(value ?? "").trim());
}

/** GET /api/staff/guests?fair=&student_id= — registered outside guests. */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const url = new URL(request.url);
  const fair = str(url.searchParams.get("fair")) || (await defaultFairSlug());
  const studentId = str(url.searchParams.get("student_id"));
  const guests = await listGuests({ fair_slug: fair, student_id: studentId || undefined });
  return ok({ guests, fees: { entry: GUEST_ENTRY_FEE, lunch: GUEST_LUNCH_FEE } });
}

/**
 * POST /api/staff/guests — register a temporary outside guest for a student.
 *
 * The desk captures the guest's photo with the device camera and uploads it to
 * Cloudinary first; the resulting URL arrives here as `photo_url`. The fee is
 * computed on the server from the fixed structure (50 BDT entry + optional
 * 150 BDT lunch box) — the client only says whether the lunch box was taken.
 */
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
  const photoUrl = str(body.photo_url).trim();
  const hasLunch = Boolean(body.has_lunch);

  if (!name) return fail("Guest name is required.", 422);
  if (contact && !/^[+0-9 ()-]{6,20}$/.test(contact)) return fail("Enter a valid contact number.", 422);
  if (!safeId(relatedId)) return fail("Choose the student this guest is visiting or accompanying.", 422);
  // `Mama`, `mama` and `Mama (maternal uncle)` all mean the same relation; the
  // canonical label is what lands in the database and on the printed ticket.
  if (!relation) return fail("Choose the relation — Mama, Chacha, Fufa, Khala, Phupu, Guardian or Other guest.", 422);
  if (photoUrl && !isPhotoUrl(photoUrl)) return fail("The guest photo must be an uploaded image URL.", 422);

  const student = await getStudentById(relatedId);
  if (!student) return fail("The related student was not found.", 404);

  const fees = guestFeeBreakdown(hasLunch);
  const guest = await createGuest({
    fair_slug: fair,
    name,
    contact,
    related_student_id: relatedId,
    relation,
    photo_url: photoUrl,
    entry_fee: fees.entry,
    has_lunch: hasLunch,
    lunch_fee: fees.lunch,
    total_fee: fees.total,
    fee_status: "PAID",
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
    detail: `${name} (${relation}) for ${student.name} · ${student.student_code} · ${fees.total} BDT${hasLunch ? " incl. lunch box" : ""}`,
  });

  return ok({ guest, fees: { entry: fees.entry, lunch: fees.lunch, total: fees.total } }, 201);
}
