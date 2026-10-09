import { defaultFairSlug, fail, ok, safeId, staff, str } from "@/lib/api";
import { getGuestById, getStudentById, recordTicketPrint } from "@/lib/student-db";

export const dynamic = "force-dynamic";

/**
 * POST /api/staff/students/:id/print — logs a ticket print (copies 1–3, optional
 * guardian) and returns the landscape ticket URL for the browser to open.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const { id } = await context.params;
  if (!safeId(id)) return fail("Invalid student ID.", 422);

  const student = await getStudentById(id);
  if (!student) return fail("Student not found.", 404);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const copies = Math.floor(Number(body.copies ?? 1));
  if (!Number.isFinite(copies) || copies < 1 || copies > 3) return fail("Copies must be between 1 and 3.", 422);
  const fair = str(body.fair_slug) || (await defaultFairSlug());
  const guestId = str(body.guest_id);

  if (guestId) {
    const guest = await getGuestById(guestId);
    if (!guest || guest.related_student_id !== id || guest.status !== "active") {
      return fail("That guardian is not an active guest of this student.", 422);
    }
  }

  await recordTicketPrint({
    fair_slug: fair,
    student_id: id,
    guest_id: guestId,
    copies,
    printed_by: session.user.id,
    printed_by_name: session.user.name,
  });

  // `lang` chooses the sheet's language: en (default), bn or both.
  const lang = ["bn", "both"].includes(str(body.lang).toLowerCase()) ? str(body.lang).toLowerCase() : "";

  const params = new URLSearchParams({ fair, copies: String(copies) });
  if (guestId) params.set("guest", guestId);
  if (lang) params.set("lang", lang);
  return ok({ url: `/sf/print/ticket/${id}?${params.toString()}`, copies, lang: lang || "en" });
}
