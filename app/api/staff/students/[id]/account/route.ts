import { randomBytes } from "node:crypto";
import { errorResponse, fail, ok, staff, str } from "@/lib/api";
import { createUser, dbQuery, isEmailAddress, logActivity, publicUser, type PortalUser } from "@/lib/portal-db";
import { hashPassword } from "@/lib/portal-auth";
import { isAdminRole } from "@/lib/roles";
import { getStudentById } from "@/lib/student-db";

export const dynamic = "force-dynamic";

/** Explicit provisioning, not automatic signup from a public phone/ID. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await staff();
    if ("status" in guard) return guard;
    if (!isAdminRole(guard.session.role)) return fail("Only administrators can issue student credentials.", 403);
    const { id } = await context.params;
    const student = await getStudentById(id);
    if (!student) return fail("Student not found.", 404);
    const existing = await dbQuery<PortalUser>(`SELECT * FROM users WHERE upper(student_id) = upper(?)`, [student.student_code]);
    if (existing.length) return fail("This student ID already has an account. Use Users to manage its credentials.", 409);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const email = str(body.email).toLowerCase();
    if (email && !isEmailAddress(email)) return fail("Enter a valid registered email, or leave it empty.", 422);
    const password = `Ok-${randomBytes(12).toString("base64url")}7`;
    const { hash, salt } = hashPassword(password);
    const user = await createUser({
      role: "student", student_id: student.student_code, name: student.name,
      email, phone: student.sms_contact, photo_url: student.photo_url,
      roll: student.roll, class_level: student.class_name, section: student.section,
      guardian_name: student.father_name, guardian_phone: student.father_contact,
      password_hash: hash, password_salt: salt, must_change_password: 1, is_active: 1,
    });
    await logActivity({ actor_id: guard.session.user.id, actor_name: guard.session.user.name, actor_role: guard.session.role,
      action: "student.account.create", entity: "users", entity_id: user.id, detail: `Student ID ${student.student_code}` });
    const response = ok({ user: publicUser(user), temporaryPassword: password,
      message: "Student account created. Share the temporary password securely; it is only shown once." }, 201);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof Error && /UNIQUE/i.test(error.message)) return fail("That email or student ID is already registered.", 409);
    return errorResponse(error, "student:account");
  }
}
