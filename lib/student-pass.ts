/**
 * Server-side issuance of a student's official QR pass.
 *
 * Students never create passes themselves. A pass is minted by the system when
 * the school marks a student PAID for the fair (admission/payment), or by an
 * administrator from the passes console. Issuing is idempotent: a student has at
 * most one main pass per fair, and calling this again returns the existing row.
 */
import { db } from "@/lib/db";
import { createPass, dbQuery, ensurePortal, type PassRow, type PortalUser } from "@/lib/portal-db";
import { makePassToken } from "@/lib/qr";

/** The main (non-guest) pass a person holds for one fair, if any. */
async function mainPassFor(userId: string, fairSlug: string) {
  const rows = await dbQuery<PassRow>(
    `SELECT * FROM passes WHERE user_id = ? AND fair_slug = ? AND parent_pass_id = '' ORDER BY created_at DESC LIMIT 1`,
    [userId, fairSlug],
  );
  return rows[0] ?? null;
}

/** Ensure one active main pass exists for this portal account in this fair. */
export async function ensureMainPass(user: Pick<PortalUser, "id" | "name" | "role" | "student_id" | "class_level" | "section" | "email" | "phone">, fairSlug: string) {
  const existing = await mainPassFor(user.id, fairSlug);
  if (existing) {
    if (existing.token) return { pass: existing, created: false };
    const token = makePassToken(existing.id);
    await db.execute({ sql: `UPDATE passes SET token = ?, updated_at = ? WHERE id = ?`, args: [token, new Date().toISOString(), existing.id] });
    return { pass: { ...existing, token }, created: false };
  }
  const pass = await createPass({
    fair_slug: fairSlug,
    user_id: user.id,
    holder_name: user.name,
    holder_role: user.role,
    student_id: user.student_id,
    class_level: user.class_level,
    section: user.section,
    email: user.email,
    phone: user.phone,
    token: "",
  });
  const token = makePassToken(pass.id);
  await db.execute({ sql: `UPDATE passes SET token = ?, updated_at = ? WHERE id = ?`, args: [token, new Date().toISOString(), pass.id] });
  return { pass: { ...pass, token }, created: true };
}

/** Portal account linked to a school ID (students and alumni use the same dashboard). */
export async function accountForStudentCode(studentCode: string) {
  await ensurePortal();
  const code = String(studentCode ?? "").trim();
  if (!code) return null;
  const rows = await dbQuery<PortalUser>(
    `SELECT * FROM users WHERE upper(student_id) = upper(?) AND role IN ('student', 'alumni') AND is_active = 1 LIMIT 1`,
    [code],
  );
  return rows[0] ?? null;
}

/** School IDs of every student marked PAID for the fair. */
export async function paidStudentCodes(fairSlug: string) {
  const rows = await dbQuery<{ student_code: string }>(
    `SELECT s.student_code FROM payments p JOIN students s ON s.id = p.student_id WHERE p.fair_slug = ? AND p.status = 'PAID'`,
    [fairSlug],
  );
  return rows.map((row) => String(row.student_code));
}

/**
 * Called after the office marks students PAID. Students without a portal account
 * cannot hold a pass yet, so they are counted as skipped and issued later by the
 * paid-only sweep in the passes console.
 */
export async function issuePassesForStudentIds(studentIds: string[], fairSlug: string) {
  const ids = Array.from(new Set(studentIds.filter(Boolean)));
  let issued = 0;
  let skipped = 0;
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const placeholders = chunk.map(() => "?").join(", ");
    const students = await dbQuery<{ student_code: string }>(`SELECT student_code FROM students WHERE id IN (${placeholders})`, chunk);
    for (const student of students) {
      const account = await accountForStudentCode(student.student_code);
      if (!account) {
        skipped += 1;
        continue;
      }
      const result = await ensureMainPass(account, fairSlug);
      if (result.created) issued += 1;
    }
  }
  return { issued, skipped };
}
