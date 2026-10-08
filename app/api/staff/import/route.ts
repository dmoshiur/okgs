import { randomBytes } from "node:crypto";
import { defaultFairSlug, fail, ok, staff } from "@/lib/api";
import {
  allRoles,
  createUser,
  listClasses,
  logActivity,
  publicUser,
  syncClassFeeDues,
  type PortalRole,
} from "@/lib/portal-db";
import { hashPassword } from "@/lib/portal-auth";
import { isEmailAddress, normalizeEmail } from "@/lib/portal-db";
import { mailAvailable, sendMail, welcomeCredentialsMail } from "@/lib/mailer";
import { inferCsvHeader, mapCsvHeader, parseDelimited } from "@/lib/csv";
import { normalizePortalRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

interface ImportRow extends Record<string, unknown> {
  name?: unknown;
  email?: unknown;
  student_id?: unknown;
  class_level?: unknown;
  section?: unknown;
  role?: unknown;
  source_line?: unknown;
}

/** Import users from reviewed rows. The browser parses/lets the admin review the file first. */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const batchRole = String(body.role ?? "student").trim() as PortalRole;
  if (!allRoles.includes(batchRole)) return fail("Invalid role.", 422);

  const importRows = normalizeInputRows(body);
  if (!importRows.length) return fail("The CSV file has no rows to import.", 422);
  if (importRows.length > 3000) return fail("You can import at most 3000 accounts at a time.", 413);

  const created: Array<{ id: string; name: string; email: string; student_id: string; role: PortalRole; class_level: string }> = [];
  const credentials: Array<{ name: string; email: string; student_id: string; role: PortalRole; password: string }> = [];
  const problems: Array<{ line: number; message: string }> = [];
  const rowsToMail: Array<{ name: string; email: string; password: string; line: number }> = [];
  const touchedClasses = new Set<string>();
  const canAssignAllRoles = session.role === "superadmin";

  for (const [index, input] of importRows.entries()) {
    const line = Math.max(1, Number(input.source_line ?? index + 2) || index + 2);
    const name = String(input.name ?? "").trim();
    const emailRaw = String(input.email ?? "").trim();
    const email = normalizeEmail(emailRaw);
    const studentId = String(input.student_id ?? "").trim().toUpperCase();
    const role = normalizePortalRole(input.role) ?? (input.role ? null : batchRole);
    const classLevel = String(input.class_level ?? "").trim() || String(body.class_level ?? "").trim();
    const section = String(input.section ?? "").trim() || String(body.section ?? "").trim();

    if (!name) { problems.push({ line, message: "Name missing" }); continue; }
    if (!role || !allRoles.includes(role)) { problems.push({ line, message: "Invalid role" }); continue; }
    if (role === "superadmin" && !canAssignAllRoles) { problems.push({ line, message: "Only a SuperAdmin can assign the SuperAdmin role" }); continue; }
    if (role === "admin" && session.role !== "superadmin") { problems.push({ line, message: "Only a SuperAdmin can assign the Admin role" }); continue; }
    if (emailRaw && !isEmailAddress(email)) { problems.push({ line, message: "Invalid email address" }); continue; }
    if (!email && !studentId) { problems.push({ line, message: "An email or school ID is required" }); continue; }

    const password = randomBytes(24).toString("base64url");
    const { hash, salt } = hashPassword(password);
    try {
      const user = await createUser({
        role,
        name,
        name_en: String(input.name_en ?? "").trim(),
        email,
        student_id: studentId,
        class_level: classLevel,
        section,
        roll: String(input.roll ?? "").trim(),
        phone: String(input.phone ?? "").trim(),
        designation: String(input.designation ?? "").trim(),
        session_year: String(input.session_year ?? "").trim(),
        blood_group: String(input.blood_group ?? "").trim(),
        address: String(input.address ?? "").trim(),
        guardian_name: String(input.guardian_name ?? "").trim(),
        guardian_phone: String(input.guardian_phone ?? "").trim(),
        password_hash: hash,
        password_salt: salt,
        must_change_password: 1,
        is_active: 1,
      });
      created.push({ id: user.id, name: user.name, email: user.email, student_id: user.student_id, role: user.role, class_level: user.class_level });
      if (role === "student" && classLevel) touchedClasses.add(classLevel);
      if (email) rowsToMail.push({ name, email, password, line });
      else credentials.push({ name, email, student_id: studentId, role, password });
    } catch (error) {
      const message = error instanceof Error && /UNIQUE/i.test(error.message) ? "Email/ID already registered" : "Could not save";
      problems.push({ line, message });
    }
  }

  if (touchedClasses.size) {
    const [classes, defaultFair] = await Promise.all([listClasses(true), defaultFairSlug()]);
    const fairSlug = String(body.fair_slug ?? "").trim() || defaultFair;
    for (const classInfo of classes.filter((item) => touchedClasses.has(item.name) && Number(item.fee_amount) > 0)) {
      try { await syncClassFeeDues(classInfo, fairSlug, session.user.name); }
      catch (error) { console.error("[import:class-fees]", error); }
    }
  }

  let delivered = 0;
  if (rowsToMail.length && await mailAvailable()) {
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
    for (let offset = 0; offset < rowsToMail.length; offset += 8) {
      const batch = rowsToMail.slice(offset, offset + 8);
      const results = await Promise.all(batch.map(async (item) => {
        const result = await sendMail(welcomeCredentialsMail(item.name, item.email, item.password, `${baseUrl}/sf/login`));
        return { ...item, delivered: result.delivered };
      }));
      for (const result of results) {
        if (result.delivered) delivered += 1;
        else credentials.push({
          name: result.name,
          email: result.email,
          student_id: created.find((user) => user.email === result.email)?.student_id || "",
          role: created.find((user) => user.email === result.email)?.role || batchRole,
          password: result.password,
        });
      }
    }
  } else {
    for (const item of rowsToMail) {
      const user = created.find((candidate) => candidate.email === item.email);
      credentials.push({ name: item.name, email: item.email, student_id: user?.student_id || "", role: user?.role || batchRole, password: item.password });
    }
  }

  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: "user.import",
    entity: "users",
    detail: `${created.length} users added · ${delivered} welcome emails delivered`,
  });

  return ok({
    created: created.length,
    users: created,
    credentials,
    welcome: { attempted: rowsToMail.length, delivered, failed: rowsToMail.length - delivered, configured: await mailAvailable() },
    problems: problems.slice(0, 200),
    defaultPassword: "",
  }, 201);
}

function normalizeInputRows(body: Record<string, unknown>): ImportRow[] {
  if (Array.isArray(body.rows)) return body.rows.filter((row): row is ImportRow => Boolean(row) && typeof row === "object") as ImportRow[];
  const csv = String(body.csv ?? "");
  if (!csv.trim()) return [];
  const { rows } = parseDelimited(csv);
  if (!rows.length) return [];
  const hasHeader = inferCsvHeader(rows);
  const headers = hasHeader ? rows[0] : rows[0].map((_, index) => `column_${index + 1}`);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const mapped = headers.map(mapCsvHeader);
  return dataRows.map((cells, index) => {
    const record: ImportRow = { source_line: index + (hasHeader ? 2 : 1) };
    mapped.forEach((field, column) => { if (field) record[field] = cells[column] ?? ""; });
    return record;
  });
}
