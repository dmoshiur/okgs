import { defaultFairSlug, errorResponse, fail, ok, safeId, staff, str } from "@/lib/api";
import { logActivity } from "@/lib/portal-db";
import { PAYMENT_STATUSES, getStudentByCode, getStudentById, setPaymentStatus, updateStudent, type PaymentStatus, type StudentPatch } from "@/lib/student-db";
import { isPhotoUrl } from "@/lib/photo-import";
import { toLatinDigits } from "@/lib/digits";

export const dynamic = "force-dynamic";

/** Text fields the edit modal may change. Anything else is ignored, never merged. */
const TEXT_FIELDS = [
  "name",
  "roll",
  "class_name",
  "section",
  "shift",
  "student_group",
  "branch",
  "sms_contact",
  "father_contact",
  "father_name",
  "mother_name",
  "tags",
] as const;

const PHOTO_FIELDS = ["photo_url", "father_photo_url", "mother_photo_url"] as const;

/**
 * GET  /api/staff/students/:id — one student, as the edit modal needs it.
 * PATCH /api/staff/students/:id — save the edited fields.
 *
 * Body (all optional, but at least one is required):
 *   name, student_code, roll, class_name, section, shift, student_group, branch,
 *   sms_contact, father_contact, father_name, mother_name, photo_url,
 *   father_photo_url, mother_photo_url, tags, serial_no,
 *   payment_status ("PAID" | "UNPAID") + fair_slug
 *
 * The three photo URLs are validated as absolute http(s) delivery links and
 * stored exactly as returned by Cloudinary. The browser uploads directly using
 * `/api/media/sign`, so no secret and no image bytes pass through this route.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { id } = await context.params;
  if (!safeId(id)) return fail("Invalid student ID.", 422);
  const student = await getStudentById(id);
  if (!student) return fail("Student not found.", 404);
  return ok({ student });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await staff();
    if ("status" in guard) return guard;
    const { session } = guard;
    const { id } = await context.params;
    if (!safeId(id)) return fail("Invalid student ID.", 422);

    const student = await getStudentById(id);
    if (!student) return fail("Student not found.", 404);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: StudentPatch = {};
    const changed: string[] = [];

    for (const field of TEXT_FIELDS) {
      if (body[field] === undefined) continue;
      const value = str(body[field]);
      if (field === "name" && !value) return fail("The student name cannot be empty.", 422);
      patch[field] = field === "roll" ? toLatinDigits(value).replace(/[^\w/-]/g, "") : value;
      if (String(student[field] ?? "") !== patch[field]) changed.push(field);
    }

    if (body.student_code !== undefined) {
      const code = toLatinDigits(str(body.student_code)).trim();
      if (!code) return fail("The student ID cannot be empty.", 422);
      if (code !== student.student_code) {
        const clash = await getStudentByCode(code);
        if (clash && clash.id !== id) return fail(`Student ID ${code} already belongs to ${clash.name || "another student"}.`, 409);
        patch.student_code = code;
        changed.push("student_code");
      }
    }

    for (const field of PHOTO_FIELDS) {
      if (body[field] === undefined) continue;
      const photo = str(body[field]);
      if (photo && !isPhotoUrl(photo)) return fail(`${field} must be a full http(s) URL.`, 422);
      if (photo !== student[field]) {
        patch[field] = photo;
        changed.push(field);
      }
    }

    if (body.serial_no !== undefined) {
      const serial = Math.max(0, Math.floor(Number(body.serial_no) || 0));
      if (serial !== Number(student.serial_no ?? 0)) {
        patch.serial_no = serial;
        changed.push("serial_no");
      }
    }

    const status = body.payment_status === undefined ? "" : (str(body.payment_status).toUpperCase() as PaymentStatus);
    if (status && !PAYMENT_STATUSES.includes(status)) return fail("Payment status must be PAID or UNPAID.", 422);

    if (!changed.length && !status) return fail("Nothing to save — no field changed.", 422);

    const updated = Object.keys(patch).length ? await updateStudent(id, patch) : student;

    if (status) {
      const fair = str(body.fair_slug) || (await defaultFairSlug());
      await setPaymentStatus({
        fair_slug: fair,
        student_ids: [id],
        status,
        actor_id: session.user.id,
        actor_name: session.user.name,
      });
      changed.push(`payment_status:${status}`);
    }

    await logActivity({
      actor_id: session.user.id,
      actor_name: session.user.name,
      actor_role: session.role,
      action: "student.update",
      entity: "students",
      entity_id: id,
      detail: `${updated.name} (${updated.student_code}) · ${changed.join(", ")}`,
    });

    return ok({ student: updated, changed });
  } catch (error) {
    if (error instanceof Error && /UNIQUE/i.test(error.message)) return fail("That student ID is already used by another student.", 409);
    return errorResponse(error, "student.update");
  }
}
