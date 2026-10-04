import { fail, ok, staff, str } from "@/lib/api";
import { createUser, logActivity, publicUser, type PortalRole } from "@/lib/portal-db";
import { defaultPortalPassword, hashPassword } from "@/lib/portal-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/staff/import — paste a CSV (or a Google-Sheets copy) of students.
 *
 * Expected headers (Bangla or English, any order):
 *   name | নাম , student_id | আইডি , class_level | শ্রেণি , section | শাখা ,
 *   roll | রোল , email | ইমেইল , phone | মোবাইল , guardian | অভিভাবক , guardian_phone
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const csv = String(body.csv ?? "").trim();
  const role = (str(body.role, "student") || "student") as PortalRole;
  const defaultClass = str(body.class_level);
  const defaultSection = str(body.section);
  if (!csv) return fail("CSV ডেটা দিন।", 422);
  if (role === "admin" && session.role !== "admin") return fail("কেবল অ্যাডমিন অ্যাডমিন আমদানি করতে পারেন।", 403);

  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  const header = lines.shift() ?? "";
  const columns = splitCsv(header).map((cell) => normalizeHeader(cell));

  const created: string[] = [];
  const problems: { line: number; message: string }[] = [];

  for (const [index, line] of lines.entries()) {
    const cells = splitCsv(line);
    const row: Record<string, string> = {};
    columns.forEach((column, position) => {
      if (column) row[column] = String(cells[position] ?? "").trim();
    });

    const name = row.name || row["নাম"] || "";
    const studentId = (row.student_id || row.id || row["আইডি"] || "").toUpperCase();
    if (!name) {
      problems.push({ line: index + 2, message: "নাম নেই" });
      continue;
    }
    const { hash, salt } = hashPassword(defaultPortalPassword());
    try {
      const user = await createUser({
        role,
        name,
        email: (row.email || "").toLowerCase(),
        student_id: studentId,
        class_level: row.class_level || defaultClass,
        section: row.section || defaultSection,
        roll: row.roll || "",
        phone: row.phone || "",
        guardian_name: row.guardian || "",
        guardian_phone: row.guardian_phone || "",
        password_hash: hash,
        password_salt: salt,
        must_change_password: 1,
        is_active: 1,
      });
      created.push(publicUser(user).name);
    } catch (error) {
      const message = error instanceof Error && /UNIQUE/i.test(error.message) ? "ইমেইল/আইডি আগেই আছে" : "সেভ করা যায়নি";
      problems.push({ line: index + 2, message });
    }
  }

  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: "user.import",
    entity: "users",
    detail: `${created.length} জন যুক্ত`,
  });

  return ok({ created: created.length, names: created.slice(0, 20), problems: problems.slice(0, 30), defaultPassword: defaultPortalPassword() });
}

function splitCsv(line: string) {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if ((char === "," || char === "\t" || char === ";") && !quoted) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current.trim());
  return out;
}

function normalizeHeader(value: string) {
  const text = value.trim().toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    name: "name",
    "নাম": "name",
    student_name: "name",
    student_id: "student_id",
    id: "student_id",
    "আইডি": "student_id",
    আইডি_নম্বর: "student_id",
    class: "class_level",
    class_level: "class_level",
    শ্রেণি: "class_level",
    section: "section",
    শাখা: "section",
    roll: "roll",
    রোল: "roll",
    email: "email",
    ইমেইল: "email",
    phone: "phone",
    mobile: "phone",
    মোবাইল: "phone",
    guardian: "guardian",
    অভিভাবক: "guardian",
    guardian_phone: "guardian_phone",
    অভিভাবকের_মোবাইল: "guardian_phone",
  };
  return map[text] ?? text;
}
