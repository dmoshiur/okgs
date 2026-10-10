/**
 * Data access for the student roster, payments, external guests, ticket prints
 * and the entry scan audit log. Every function talks to the live database.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { dbQuery as query, dbRun as run, ensurePortal } from "@/lib/portal-db";
import { guestRelations } from "@/lib/student-schema";
import { normalizeRoll } from "@/lib/roll-range";
import { dhakaDayStartIso, nextSchoolDayIso } from "@/lib/school-time";
export { dhakaDayStartIso } from "@/lib/school-time";

const nowIso = () => new Date().toISOString();

export const PAYMENT_STATUSES = ["PAID", "UNPAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface StudentRow {
  id: string;
  serial_no: number;
  student_code: string;
  roll: string;
  photo_url: string;
  name: string;
  branch: string;
  shift: string;
  class_name: string;
  section: string;
  student_group: string;
  sms_contact: string;
  father_contact: string;
  father_name: string;
  mother_name: string;
  father_photo_url: string;
  mother_photo_url: string;
  tags: string;
  import_batch: string;
  created_at: string;
  updated_at: string;
}

export interface StudentListRow extends StudentRow {
  payment_status: PaymentStatus;
  paid_at: string;
  print_count: number;
  entered_at: string;
  guest_count: number;
}

export interface GuestRow {
  id: string;
  fair_slug: string;
  name: string;
  contact: string;
  related_student_id: string;
  relation: string;
  /** Cloudinary photo captured at the registration desk. */
  photo_url: string;
  /** Mandatory entry fee — always 50 BDT. */
  entry_fee: number;
  /** 1 when the guest opted for the 150 BDT lunch box. */
  has_lunch: number;
  lunch_fee: number;
  /** Entry + lunch: 50 or 200 BDT. */
  total_fee: number;
  /** PAID once the desk has collected the money. */
  fee_status: string;
  status: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  related_student_name?: string;
  related_student_code?: string;
  related_student_class?: string;
  related_student_section?: string;
}

export interface ScanLogRow {
  id: string;
  fair_slug: string;
  subject_type: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  method: string;
  result: string;
  entry_time: string;
  scanned_at: string;
  scanned_by: string;
  scanned_by_name: string;
  note: string;
}

export const STUDENT_COLUMNS = [
  "SL",
  "ID",
  "Roll",
  "Photo",
  "Name",
  "Branch",
  "Shift",
  "Class",
  "Section",
  "Group",
  "SMS Contact",
  "Father Contact",
  "Father Name",
  "Mother Name",
  "Father Photo",
  "Mother Photo",
  "Tags",
] as const;

export interface StudentImportRecord {
  serial_no: number;
  student_code: string;
  roll: string;
  photo_url: string;
  name: string;
  branch: string;
  shift: string;
  class_name: string;
  section: string;
  student_group: string;
  sms_contact: string;
  father_contact: string;
  father_name: string;
  mother_name: string;
  father_photo_url: string;
  mother_photo_url: string;
  tags: string;
}

/* ------------------------------------------------------------------ *
 * Roster
 * ------------------------------------------------------------------ */

export async function studentFilterOptions() {
  const [classes, sections, shifts] = await Promise.all([
    query<{ v: string }>(`SELECT DISTINCT class_name AS v FROM students WHERE class_name <> '' ORDER BY class_name`),
    query<{ v: string }>(`SELECT DISTINCT section AS v FROM students WHERE section <> '' ORDER BY section`),
    query<{ v: string }>(`SELECT DISTINCT shift AS v FROM students WHERE shift <> '' ORDER BY shift`),
  ]);
  return {
    classes: classes.map((row) => String(row.v)),
    sections: sections.map((row) => String(row.v)),
    shifts: shifts.map((row) => String(row.v)),
  };
}

export interface StudentFilter {
  fair_slug: string;
  class_name?: string;
  section?: string;
  shift?: string;
  q?: string;
  payment?: "" | "PAID" | "UNPAID";
  /** Normalised rolls (`parseRollExpression`) — filtered in SQL so paging and totals agree. */
  rolls?: Set<string>;
  /** Explicit database IDs or school student codes; an empty array matches no students. */
  student_ids?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Rolls are stored as typed (`01`, `12`, `A-12`), but a filter box compares them
 * by value. A fully numeric roll therefore matches `CAST(roll AS INTEGER)`; a
 * roll with letters matches its exact text. Doing this in SQL (instead of in
 * JavaScript after the rows arrive) is what lets the roster page be paginated
 * without the page size changing who is in the class.
 */
function rollClause(rolls: Set<string>) {
  const numeric: number[] = [];
  const text: string[] = [];
  for (const roll of rolls) {
    if (/^\d+$/.test(roll)) numeric.push(Number(roll));
    else text.push(roll);
  }
  const parts: string[] = [];
  const args: (string | number)[] = [];
  if (numeric.length) {
    parts.push(`(ltrim(s.roll, '0123456789') = '' AND s.roll <> '' AND CAST(s.roll AS INTEGER) IN (${numeric.map(() => "?").join(", ")}))`);
    args.push(...numeric);
  }
  if (text.length) {
    parts.push(`s.roll IN (${text.map(() => "?").join(", ")})`);
    args.push(...text);
  }
  if (!parts.length) return { clause: "", args: [] as (string | number)[] };
  return { clause: `(${parts.join(" OR ")})`, args };
}

/** Shared WHERE/args for every roster query, so a page and its totals can never disagree. */
function studentFilterSql(filter: StudentFilter) {
  const clauses: string[] = [];
  const args: (string | number)[] = [];
  if (filter.class_name) {
    clauses.push("s.class_name = ?");
    args.push(filter.class_name);
  }
  if (filter.section) {
    clauses.push("s.section = ?");
    args.push(filter.section);
  }
  if (filter.shift) {
    clauses.push("s.shift = ?");
    args.push(filter.shift);
  }
  if (filter.q) {
    const like = `%${filter.q}%`;
    clauses.push("(s.name LIKE ? OR s.student_code LIKE ? OR s.roll = ?)");
    args.push(like, like, normalizeRoll(filter.q));
  }
  if (filter.payment) {
    clauses.push("COALESCE(p.status, 'UNPAID') = ?");
    args.push(filter.payment);
  }
  if (filter.student_ids !== undefined) {
    if (!filter.student_ids.length) {
      clauses.push("1 = 0");
    } else {
      // Resolve each requested identifier to at most ONE record. A selected
      // database ID must not also match an unselected student's school code.
      clauses.push(`s.id IN (SELECT COALESCE(
        (SELECT by_id.id FROM students by_id WHERE by_id.id = CAST(selected.value AS TEXT)),
        (SELECT by_code.id FROM students by_code WHERE by_code.student_code = CAST(selected.value AS TEXT)),
        (SELECT MIN(by_alias.id) FROM students by_alias WHERE upper(by_alias.student_code) = upper(CAST(selected.value AS TEXT)) HAVING COUNT(*) = 1)
      ) FROM json_each(?) AS selected)`);
      args.push(JSON.stringify(Array.from(new Set(filter.student_ids))));
    }
  }
  if (filter.rolls?.size) {
    const rolls = rollClause(filter.rolls);
    if (rolls.clause) {
      clauses.push(rolls.clause);
      args.push(...rolls.args);
    }
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", args };
}

/** The per-student extras (prints, first admission, guests) share one fair slug binding. */
const STUDENT_JOIN = `FROM students s
     LEFT JOIN payments p ON p.student_id = s.id AND p.fair_slug = ?`;
const STUDENT_ORDER = `ORDER BY length(s.class_name) ASC, s.class_name ASC, s.section ASC, s.shift ASC, CAST(s.roll AS INTEGER) ASC, s.roll ASC, s.name ASC`;

/** One page of the roster with payment, print and gate status. */
export async function listStudentsWithStatus(filter: StudentFilter): Promise<StudentListRow[]> {
  const fair = filter.fair_slug;
  const { where, args } = studentFilterSql(filter);
  const limit = Math.max(1, Math.min(5000, Math.floor(filter.limit ?? 50)));
  const offset = Math.max(0, Math.floor(filter.offset ?? 0));
  const rows = await query<Record<string, unknown>>(
    `SELECT s.*,
       COALESCE(p.status, 'UNPAID') AS payment_status,
       COALESCE(p.paid_at, '') AS paid_at,
       (SELECT COUNT(*) FROM ticket_prints t WHERE t.student_id = s.id AND t.fair_slug = ?) AS print_count,
       COALESCE((SELECT MIN(l.entry_time) FROM scan_logs l WHERE l.subject_type = 'student' AND l.subject_id = s.id AND l.fair_slug = ? AND l.result = 'success'), '') AS entered_at,
       (SELECT COUNT(*) FROM guests g WHERE g.related_student_id = s.id AND g.fair_slug = ? AND g.status = 'active') AS guest_count
     ${STUDENT_JOIN}
     ${where}
     ${STUDENT_ORDER}
     LIMIT ${limit} OFFSET ${offset}`,
    [fair, fair, fair, fair, ...args],
  );
  return rows.map((row) => ({
    ...(row as unknown as StudentRow),
    payment_status: String(row.payment_status) === "PAID" ? "PAID" : "UNPAID",
    paid_at: String(row.paid_at ?? ""),
    print_count: Number(row.print_count ?? 0),
    entered_at: String(row.entered_at ?? ""),
    guest_count: Number(row.guest_count ?? 0),
  }));
}

/** How many rows the same filter matches — the "Showing 50 of 1,240" denominator. */
export async function countStudents(filter: StudentFilter): Promise<number> {
  const { where, args } = studentFilterSql(filter);
  const rows = await query<{ total: number }>(`SELECT COUNT(*) AS total ${STUDENT_JOIN} ${where}`, [filter.fair_slug, ...args]);
  return Number(rows[0]?.total ?? 0);
}

/**
 * Payment/print/gate totals for the *whole* filter, computed in the database.
 *
 * The roster table is paginated, so counting the rows on screen would report the
 * page instead of the class — one aggregate query keeps the header figures right.
 */
export async function studentStatusCounts(filter: StudentFilter) {
  const { where, args } = studentFilterSql(filter);
  const rows = await query<Record<string, number>>(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN 1 ELSE 0 END), 0) AS paid,
       COALESCE(SUM(CASE WHEN COALESCE(p.status, 'UNPAID') = 'UNPAID' THEN 1 ELSE 0 END), 0) AS unpaid,
       COALESCE(SUM(CASE WHEN (SELECT COUNT(*) FROM ticket_prints t WHERE t.student_id = s.id AND t.fair_slug = ?) > 0 THEN 1 ELSE 0 END), 0) AS printed,
       COALESCE(SUM(CASE WHEN (SELECT COUNT(*) FROM scan_logs l WHERE l.subject_type = 'student' AND l.subject_id = s.id AND l.fair_slug = ? AND l.result = 'success') > 0 THEN 1 ELSE 0 END), 0) AS entered
     ${STUDENT_JOIN} ${where}`,
    // Three fair bindings before the WHERE: the print subquery, the gate
    // subquery and the payments join. Missing one silently empties the result.
    [filter.fair_slug, filter.fair_slug, filter.fair_slug, ...args],
  );
  const row = rows[0] ?? {};
  return {
    total: Number(row.total ?? 0),
    paid: Number(row.paid ?? 0),
    unpaid: Number(row.unpaid ?? 0),
    printed: Number(row.printed ?? 0),
    entered: Number(row.entered ?? 0),
  };
}

export interface PrintableStudent {
  id: string;
  student_code: string;
  roll: string;
  name: string;
  class_name: string;
  section: string;
  shift: string;
  student_group: string;
  photo_url: string;
  /** The redesigned ticket prints all three photos with the parents' names. */
  father_name: string;
  mother_name: string;
  father_photo_url: string;
  mother_photo_url: string;
}

/**
 * Students whose fee is PAID for this fair, in print order.
 *
 * Bulk ticket printing must never put an unpaid student on paper — a sheet at the
 * gate is proof of payment — so the filter is applied in the query, not in the UI.
 */
export async function paidStudentsForPrint(
  filter: Omit<StudentFilter, "payment" | "limit" | "offset">,
): Promise<PrintableStudent[]> {
  const { where, args } = studentFilterSql({ ...filter, payment: "PAID" });
  return query<PrintableStudent>(
    `SELECT s.id, s.student_code, s.roll, s.name, s.class_name, s.section, s.shift, s.student_group,
       s.photo_url, s.father_name, s.mother_name, s.father_photo_url, s.mother_photo_url
     ${STUDENT_JOIN} ${where} ${STUDENT_ORDER}`,
    [filter.fair_slug, ...args],
  );
}

/** How many PAID / UNPAID students a scope holds — the bulk-print confirmation. */
export async function printableStudentCounts(filter: Omit<StudentFilter, "payment" | "limit" | "offset">) {
  const { where, args } = studentFilterSql(filter);
  const rows = await query<{ paid: number; total: number }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN 1 ELSE 0 END), 0) AS paid
     ${STUDENT_JOIN} ${where}`,
    [filter.fair_slug, ...args],
  );
  const total = Number(rows[0]?.total ?? 0);
  const paid = Number(rows[0]?.paid ?? 0);
  return { total, paid, unpaid: Math.max(0, total - paid) };
}

/**
 * Editable student fields. `student_code` is the school ID and must stay unique,
 * so a rename is checked by the caller before it reaches the database.
 */
export interface StudentPatch {
  student_code?: string;
  roll?: string;
  name?: string;
  branch?: string;
  shift?: string;
  class_name?: string;
  section?: string;
  student_group?: string;
  sms_contact?: string;
  father_contact?: string;
  father_name?: string;
  mother_name?: string;
  photo_url?: string;
  father_photo_url?: string;
  mother_photo_url?: string;
  tags?: string;
  serial_no?: number;
}

const STUDENT_PATCH_COLUMNS = [
  "student_code",
  "roll",
  "name",
  "branch",
  "shift",
  "class_name",
  "section",
  "student_group",
  "sms_contact",
  "father_contact",
  "father_name",
  "mother_name",
  "photo_url",
  "father_photo_url",
  "mother_photo_url",
  "tags",
] as const;

/** Writes one student's edited fields. Returns the fresh row. */
export async function updateStudent(id: string, patch: StudentPatch) {
  await ensurePortal();
  const sets: string[] = [];
  const args: (string | number)[] = [];
  for (const column of STUDENT_PATCH_COLUMNS) {
    const value = patch[column];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    args.push(String(value ?? "").trim());
  }
  if (patch.serial_no !== undefined) {
    sets.push("serial_no = ?");
    args.push(Math.max(0, Math.floor(Number(patch.serial_no) || 0)));
  }
  if (!sets.length) return getStudentById(id);
  sets.push("updated_at = ?");
  args.push(nowIso(), id);
  await run(`UPDATE students SET ${sets.join(", ")} WHERE id = ?`, args);
  return getStudentById(id);
}

export interface PhotoUpdateResult {
  matched: number;
  updated: number;
  unchanged: number;
  missing: { key: string; row: number }[];
}

/**
 * Batch photo mapping — the writer behind the CSV/XLSX photo import.
 *
 * A sheet row carries either the school ID or the roll plus a Cloudinary URL.
 * The optional `father_photo_url` / `mother_photo_url` columns sync the parents'
 * photos in the same pass, so every picture the ticket prints can be bulk-loaded.
 * Students are resolved once, in a single query, and the writes go out in
 * `db.batch` chunks so a 2,000-row sheet is a handful of round-trips instead of
 * 2,000 of them. Rows whose key matches nobody are reported, never guessed.
 */
export async function updateStudentPhotos(
  entries: { key: string; match: "code" | "roll"; photo_url: string; row: number; father_photo_url?: string; mother_photo_url?: string }[],
  options: { dryRun?: boolean } = {},
): Promise<PhotoUpdateResult> {
  await ensurePortal();
  const codes = new Set<string>();
  const rolls = new Set<string>();
  for (const entry of entries) {
    if (entry.match === "code") codes.add(entry.key.toUpperCase());
    else rolls.add(entry.key);
  }

  const byCode = new Map<string, StudentRow>();
  const byRoll = new Map<string, StudentRow>();
  if (codes.size) {
    const placeholders = Array.from(codes).map(() => "?").join(", ");
    for (const row of await query<StudentRow>(`SELECT * FROM students WHERE upper(student_code) IN (${placeholders})`, Array.from(codes))) {
      byCode.set(row.student_code.toUpperCase(), row);
    }
  }
  if (rolls.size) {
    const placeholders = Array.from(rolls).map(() => "?").join(", ");
    for (const row of await query<StudentRow>(`SELECT * FROM students WHERE roll IN (${placeholders})`, Array.from(rolls))) {
      // A roll is only unique inside a class; the first match wins and the
      // importer tells the office to use IDs when rolls repeat.
      if (!byRoll.has(row.roll)) byRoll.set(row.roll, row);
    }
  }

  const stamp = nowIso();
  const statements: { sql: string; args: (string | number)[] }[] = [];
  const missing: { key: string; row: number }[] = [];
  let matched = 0;
  let unchanged = 0;

  for (const entry of entries) {
    const student = entry.match === "code" ? byCode.get(entry.key.toUpperCase()) : byRoll.get(entry.key);
    if (!student) {
      missing.push({ key: entry.key, row: entry.row });
      continue;
    }
    matched += 1;
    const father = entry.father_photo_url ?? "";
    const mother = entry.mother_photo_url ?? "";
    const sets: string[] = [];
    const args: (string | number)[] = [];
    if (student.photo_url !== entry.photo_url) {
      sets.push("photo_url = ?");
      args.push(entry.photo_url);
    }
    if (father && student.father_photo_url !== father) {
      sets.push("father_photo_url = ?");
      args.push(father);
    }
    if (mother && student.mother_photo_url !== mother) {
      sets.push("mother_photo_url = ?");
      args.push(mother);
    }
    if (!sets.length) {
      unchanged += 1;
      continue;
    }
    statements.push({
      sql: `UPDATE students SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`,
      args: [...args, stamp, student.id],
    });
  }

  if (!options.dryRun) {
    for (let index = 0; index < statements.length; index += 100) {
      await db.batch(statements.slice(index, index + 100), "write");
    }
  }

  return { matched, updated: statements.length, unchanged, missing: missing.slice(0, 200) };
}

export async function getStudentById(id: string) {
  const rows = await query<StudentRow>(`SELECT * FROM students WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

/** Students matching a class/section/shift scope (roll filtering happens in the caller). */
export async function scopedStudents(scope: { class_name?: string; section?: string; shift?: string }) {
  const clauses: string[] = [];
  const args: string[] = [];
  if (scope.class_name) {
    clauses.push("class_name = ?");
    args.push(scope.class_name);
  }
  if (scope.section) {
    clauses.push("section = ?");
    args.push(scope.section);
  }
  if (scope.shift) {
    clauses.push("shift = ?");
    args.push(scope.shift);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return query<StudentRow>(`SELECT * FROM students ${where} ORDER BY CAST(roll AS INTEGER) ASC, roll ASC`, args);
}

/* ------------------------------------------------------------------ *
 * Roster / gate summaries — the figures behind the dashboard and reports.
 * ------------------------------------------------------------------ */

export interface RosterSummary {
  total: number;
  paid: number;
  unpaid: number;
  printed: number;
  entered: number;
  guests: number;
}

/** Head-counts for one fair: who paid, who has a printed ticket, who entered. */
export async function rosterSummary(fairSlug: string): Promise<RosterSummary> {
  const rows = await query<Record<string, number | string>>(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN 1 ELSE 0 END), 0) AS paid,
       COALESCE(SUM(CASE WHEN COALESCE(p.status, 'UNPAID') = 'UNPAID' THEN 1 ELSE 0 END), 0) AS unpaid,
       COALESCE(SUM(CASE WHEN (SELECT COUNT(*) FROM ticket_prints t WHERE t.student_id = s.id AND t.fair_slug = ?) > 0 THEN 1 ELSE 0 END), 0) AS printed,
       COALESCE(SUM(CASE WHEN (SELECT COUNT(*) FROM scan_logs l WHERE l.subject_type = 'student' AND l.subject_id = s.id AND l.fair_slug = ? AND l.result = 'success') > 0 THEN 1 ELSE 0 END), 0) AS entered,
       COALESCE(SUM((SELECT COUNT(*) FROM guests g WHERE g.related_student_id = s.id AND g.fair_slug = ? AND g.status = 'active')), 0) AS guests
     FROM students s
     LEFT JOIN payments p ON p.student_id = s.id AND p.fair_slug = ?`,
    [fairSlug, fairSlug, fairSlug, fairSlug],
  );
  const row = rows[0] ?? {};
  return {
    total: Number(row.total ?? 0),
    paid: Number(row.paid ?? 0),
    unpaid: Number(row.unpaid ?? 0),
    printed: Number(row.printed ?? 0),
    entered: Number(row.entered ?? 0),
    guests: Number(row.guests ?? 0),
  };
}

export interface ClassPaymentRow {
  class_name: string;
  section: string;
  shift: string;
  total: number;
  paid: number;
  unpaid: number;
  printed: number;
  entered: number;
  guests: number;
}

/** Class-wise payment progress — the table behind /sf/reports. */
export async function classPaymentSummary(fairSlug: string): Promise<ClassPaymentRow[]> {
  const rows = await query<Record<string, string | number>>(
    `SELECT
       s.class_name AS class_name,
       s.section AS section,
       s.shift AS shift,
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN 1 ELSE 0 END), 0) AS paid,
       COALESCE(SUM(CASE WHEN (SELECT COUNT(*) FROM ticket_prints t WHERE t.student_id = s.id AND t.fair_slug = ?) > 0 THEN 1 ELSE 0 END), 0) AS printed,
       COALESCE(SUM(CASE WHEN (SELECT COUNT(*) FROM scan_logs l WHERE l.subject_type = 'student' AND l.subject_id = s.id AND l.fair_slug = ? AND l.result = 'success') > 0 THEN 1 ELSE 0 END), 0) AS entered,
       COALESCE(SUM((SELECT COUNT(*) FROM guests g WHERE g.related_student_id = s.id AND g.fair_slug = ? AND g.status = 'active')), 0) AS guests
     FROM students s
     LEFT JOIN payments p ON p.student_id = s.id AND p.fair_slug = ?
     GROUP BY s.class_name, s.section, s.shift
     ORDER BY length(s.class_name) ASC, s.class_name ASC, s.section ASC, s.shift ASC`,
    [fairSlug, fairSlug, fairSlug, fairSlug],
  );
  return rows.map((row) => ({
    class_name: String(row.class_name ?? ""),
    section: String(row.section ?? ""),
    shift: String(row.shift ?? ""),
    total: Number(row.total ?? 0),
    paid: Number(row.paid ?? 0),
    unpaid: Math.max(0, Number(row.total ?? 0) - Number(row.paid ?? 0)),
    printed: Number(row.printed ?? 0),
    entered: Number(row.entered ?? 0),
    guests: Number(row.guests ?? 0),
  }));
}

/** How many tickets were sent to the printer, and how many sheets that is. */
export async function ticketPrintSummary(fairSlug: string) {
  const rows = await query<{ prints: number; copies: number; students: number }>(
    `SELECT COUNT(*) AS prints,
            COALESCE(SUM(copies), 0) AS copies,
            COUNT(DISTINCT student_id) AS students
       FROM ticket_prints WHERE fair_slug = ?`,
    [fairSlug],
  );
  const guestRows = await query<{ total: number }>(`SELECT COALESCE(SUM(copies), 0) AS total FROM ticket_prints WHERE fair_slug = ? AND guest_id <> ''`, [fairSlug]);
  const row = rows[0] ?? {};
  return {
    prints: Number(row.prints ?? 0),
    copies: Number(row.copies ?? 0),
    students: Number(row.students ?? 0),
    guestSheets: Number(guestRows[0]?.total ?? 0),
  };
}

/** How many outside guests are registered, grouped by the relation label. */
export async function guestCountsByRelation(fairSlug: string) {
  const rows = await query<{ relation: string; total: number }>(
    `SELECT relation, COUNT(*) AS total FROM guests WHERE fair_slug = ? GROUP BY relation ORDER BY total DESC, relation ASC`,
    [fairSlug],
  );
  return rows.map((row) => ({ relation: String(row.relation || "Other guest"), total: Number(row.total ?? 0) }));
}

/** Scans of the current fair day (Asia/Dhaka) — "today" for the gate. */
export async function scanDaySummary(fairSlug: string, now = new Date()) {
  const since = dhakaDayStartIso(now);
  const until = nextSchoolDayIso(now);
  const rows = await query<{ result: string; total: number }>(
    `SELECT result, COUNT(*) AS total FROM scan_logs WHERE fair_slug = ? AND scanned_at >= ? AND scanned_at < ? GROUP BY result`,
    [fairSlug, since, until],
  );
  const today: Record<string, number> = { success: 0, duplicate: 0, expired: 0, invalid: 0 };
  for (const row of rows) today[String(row.result)] = Number(row.total ?? 0);
  const admitted = await query<{ total: number }>(
    `SELECT COUNT(DISTINCT subject_type || ':' || subject_id) AS total FROM scan_logs WHERE fair_slug = ? AND result = 'success' AND scanned_at >= ? AND scanned_at < ?`,
    [fairSlug, since, until],
  );
  return { since, ...today, admitted: Number(admitted[0]?.total ?? 0) };
}

/** Upserts roster rows keyed by the school ID. Returns how many were new vs updated. */
export async function upsertStudents(records: StudentImportRecord[], batch: string) {
  await ensurePortal();
  const existing = new Set((await query<{ student_code: string }>(`SELECT student_code FROM students`)).map((row) => String(row.student_code)));
  let inserted = 0;
  let updated = 0;
  const stamp = nowIso();
  for (let index = 0; index < records.length; index += 100) {
    const chunk = records.slice(index, index + 100);
    await db.batch(
      chunk.map((record) => ({
        sql: `INSERT INTO students (id, serial_no, student_code, roll, photo_url, name, branch, shift, class_name, section, student_group, sms_contact, father_contact, father_name, mother_name, father_photo_url, mother_photo_url, tags, import_batch, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(student_code) DO UPDATE SET
                serial_no = excluded.serial_no, roll = excluded.roll,
                photo_url = CASE WHEN excluded.photo_url <> '' THEN excluded.photo_url ELSE students.photo_url END,
                name = excluded.name,
                branch = excluded.branch, shift = excluded.shift, class_name = excluded.class_name, section = excluded.section,
                student_group = excluded.student_group, sms_contact = excluded.sms_contact, father_contact = excluded.father_contact,
                father_name = excluded.father_name, mother_name = excluded.mother_name,
                father_photo_url = CASE WHEN excluded.father_photo_url <> '' THEN excluded.father_photo_url ELSE students.father_photo_url END,
                mother_photo_url = CASE WHEN excluded.mother_photo_url <> '' THEN excluded.mother_photo_url ELSE students.mother_photo_url END,
                tags = excluded.tags,
                import_batch = excluded.import_batch, updated_at = excluded.updated_at`,
        args: [
          randomUUID(),
          record.serial_no,
          record.student_code,
          record.roll,
          record.photo_url,
          record.name,
          record.branch,
          record.shift,
          record.class_name,
          record.section,
          record.student_group,
          record.sms_contact,
          record.father_contact,
          record.father_name,
          record.mother_name,
          record.father_photo_url,
          record.mother_photo_url,
          record.tags,
          batch,
          stamp,
          stamp,
        ],
      })),
      "write",
    );
    for (const record of chunk) {
      if (existing.has(record.student_code)) updated += 1;
      else inserted += 1;
    }
  }
  return { inserted, updated };
}

/* ------------------------------------------------------------------ *
 * Payments — every change is written immediately.
 * ------------------------------------------------------------------ */

export async function setPaymentStatus(input: { fair_slug: string; student_ids: string[]; status: PaymentStatus; actor_id: string; actor_name: string }) {
  await ensurePortal();
  const stamp = nowIso();
  const paidAt = input.status === "PAID" ? stamp : "";
  const ids = Array.from(new Set(input.student_ids));
  for (let index = 0; index < ids.length; index += 100) {
    await db.batch(
      ids.slice(index, index + 100).map((studentId) => ({
        sql: `INSERT INTO payments (id, fair_slug, student_id, status, paid_at, updated_by, updated_by_name, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(fair_slug, student_id) DO UPDATE SET
                status = excluded.status, paid_at = excluded.paid_at, updated_by = excluded.updated_by,
                updated_by_name = excluded.updated_by_name, updated_at = excluded.updated_at`,
        args: [randomUUID(), input.fair_slug, studentId, input.status, paidAt, input.actor_id, input.actor_name, stamp, stamp],
      })),
      "write",
    );
  }
  return ids.length;
}

/* ------------------------------------------------------------------ *
 * Guests / guardians
 * ------------------------------------------------------------------ */

/** True for any of the seven relations, exactly as the select in the panel offers them. */
export function isGuestRelation(value: string) {
  return (guestRelations as readonly string[]).includes(value);
}

/**
 * Canonical relation label.
 *
 * The stored value must be one of the seven labels, but a sheet, a CSV or an API
 * caller may say just `Mama`. Matching on the part before the bracket keeps the
 * database consistent without forcing every writer to repeat the parenthetical.
 */
export function guestRelationLabel(value: string) {
  const wanted = String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!wanted) return "";
  for (const label of guestRelations) {
    const head = label.split(" (")[0].toLowerCase();
    if (wanted === label.toLowerCase() || wanted === head || label.toLowerCase().startsWith(`${wanted} `) || wanted.startsWith(`${head} `)) {
      return label;
    }
  }
  return "";
}

const guestSelect = `SELECT g.*, s.name AS related_student_name, s.student_code AS related_student_code,
  s.class_name AS related_student_class, s.section AS related_student_section
  FROM guests g LEFT JOIN students s ON s.id = g.related_student_id`;

export async function listGuests(filter: { fair_slug: string; student_id?: string; limit?: number }) {
  const clauses = ["g.fair_slug = ?"];
  const args: string[] = [filter.fair_slug];
  if (filter.student_id) {
    clauses.push("g.related_student_id = ?");
    args.push(filter.student_id);
  }
  const limit = Math.max(1, Math.min(2000, Math.floor(filter.limit ?? 500)));
  return query<GuestRow>(`${guestSelect} WHERE ${clauses.join(" AND ")} ORDER BY g.created_at DESC LIMIT ${limit}`, args);
}

export async function getGuestById(id: string) {
  const rows = await query<GuestRow>(`${guestSelect} WHERE g.id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function createGuest(values: {
  fair_slug: string;
  name: string;
  contact: string;
  related_student_id: string;
  relation: string;
  photo_url?: string;
  entry_fee: number;
  has_lunch: boolean;
  lunch_fee: number;
  total_fee: number;
  fee_status?: string;
  created_by: string;
  created_by_name: string;
}) {
  await ensurePortal();
  const id = randomUUID();
  const stamp = nowIso();
  await run(
    `INSERT INTO guests (id, fair_slug, name, contact, related_student_id, relation, photo_url, entry_fee, has_lunch, lunch_fee, total_fee, fee_status, status, created_by, created_by_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    [
      id,
      values.fair_slug,
      values.name,
      values.contact,
      values.related_student_id,
      values.relation,
      values.photo_url ?? "",
      values.entry_fee,
      values.has_lunch ? 1 : 0,
      values.lunch_fee,
      values.total_fee,
      values.fee_status === "UNPAID" ? "UNPAID" : "PAID",
      values.created_by,
      values.created_by_name,
      stamp,
      stamp,
    ],
  );
  return getGuestById(id);
}

export async function setGuestStatus(id: string, status: "active" | "revoked") {
  await run(`UPDATE guests SET status = ?, updated_at = ? WHERE id = ?`, [status, nowIso(), id]);
  return getGuestById(id);
}

/** Flip a guest's fee between collected (PAID) and due (UNPAID). */
export async function setGuestFeeStatus(id: string, feeStatus: "PAID" | "UNPAID") {
  await run(`UPDATE guests SET fee_status = ?, updated_at = ? WHERE id = ?`, [feeStatus, nowIso(), id]);
  return getGuestById(id);
}

export interface GuestFeeSummary {
  /** Non-revoked guests who paid the 50 BDT entry fee. */
  entryCount: number;
  entryTotal: number;
  /** Paid guests who also took the 150 BDT lunch box. */
  lunchCount: number;
  lunchTotal: number;
  /** Every non-revoked guest, paid or not. */
  registered: number;
  /** Entry + lunch actually collected. */
  collected: number;
}

/**
 * Guest money for one fair — the dashboard's "guest entry fees" and "lunch box
 * sales" figures. Only non-revoked guests count, and only rows marked PAID are
 * treated as collected; the fee amounts come from the stored row, never from a
 * client payload.
 */
export async function guestFeeSummary(fairSlug: string): Promise<GuestFeeSummary> {
  const rows = await query<{
    registered: number;
    entry_count: number;
    entry_total: number;
    lunch_count: number;
    lunch_total: number;
    collected: number;
  }>(
    `SELECT
       COUNT(*) AS registered,
       COALESCE(SUM(CASE WHEN fee_status = 'PAID' THEN 1 ELSE 0 END), 0) AS entry_count,
       COALESCE(SUM(CASE WHEN fee_status = 'PAID' THEN COALESCE(entry_fee, 0) ELSE 0 END), 0) AS entry_total,
       COALESCE(SUM(CASE WHEN fee_status = 'PAID' AND has_lunch = 1 THEN 1 ELSE 0 END), 0) AS lunch_count,
       COALESCE(SUM(CASE WHEN fee_status = 'PAID' AND has_lunch = 1 THEN COALESCE(lunch_fee, 0) ELSE 0 END), 0) AS lunch_total,
       COALESCE(SUM(CASE WHEN fee_status = 'PAID' THEN COALESCE(total_fee, 0) ELSE 0 END), 0) AS collected
     FROM guests WHERE fair_slug = ? AND status = 'active'`,
    [fairSlug],
  );
  const row = rows[0] ?? { registered: 0, entry_count: 0, entry_total: 0, lunch_count: 0, lunch_total: 0, collected: 0 };
  return {
    registered: Number(row.registered ?? 0),
    entryCount: Number(row.entry_count ?? 0),
    entryTotal: Number(row.entry_total ?? 0),
    lunchCount: Number(row.lunch_count ?? 0),
    lunchTotal: Number(row.lunch_total ?? 0),
    collected: Number(row.collected ?? 0),
  };
}

/**
 * How many students of each class have PAID the fair ticket — the class-wise
 * breakdown behind the dashboard's student-collection figures.
 */
export async function paidStudentsByClass(fairSlug: string) {
  const rows = await query<{ class_name: string; paid: number; total: number }>(
    `SELECT s.class_name,
       COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN 1 ELSE 0 END), 0) AS paid,
       COUNT(*) AS total
     FROM students s LEFT JOIN payments p ON p.student_id = s.id AND p.fair_slug = ?
     GROUP BY s.class_name
     ORDER BY length(s.class_name) ASC, s.class_name ASC`,
    [fairSlug],
  );
  return rows.map((row) => ({
    class_name: String(row.class_name || "—"),
    paid: Number(row.paid ?? 0),
    total: Number(row.total ?? 0),
  }));
}

export async function activeGuestsForStudent(studentId: string, fairSlug: string) {
  return query<GuestRow>(`${guestSelect} WHERE g.related_student_id = ? AND g.fair_slug = ? AND g.status = 'active' ORDER BY g.created_at ASC`, [studentId, fairSlug]);
}

/* ------------------------------------------------------------------ *
 * Ticket prints
 * ------------------------------------------------------------------ */

export interface TicketPrintJob {
  id: string;
  fair_slug: string;
  student_ids: string[];
  class_name: string;
  section: string;
  shift: string;
  rolls: string;
  q: string;
  lang: string;
  created_by: string;
  created_at: string;
  expires_at: string;
}

const TICKET_PRINT_JOB_TTL_MS = 24 * 60 * 60 * 1000;

/** Stores the prepared student IDs server-side so large selections stay out of URLs. */
export async function createTicketPrintJob(input: Omit<TicketPrintJob, "id" | "created_at" | "expires_at">) {
  await ensurePortal();
  const stamp = nowIso();
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + TICKET_PRINT_JOB_TTL_MS).toISOString();
  await run(`DELETE FROM ticket_print_jobs WHERE expires_at <= ?`, [stamp]);
  await run(
    `INSERT INTO ticket_print_jobs
      (id, fair_slug, student_ids_json, class_name, section, shift, rolls, q, lang, created_by, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.fair_slug,
      JSON.stringify(Array.from(new Set(input.student_ids))),
      input.class_name,
      input.section,
      input.shift,
      input.rolls,
      input.q,
      input.lang,
      input.created_by,
      stamp,
      expiresAt,
    ],
  );
  return id;
}

/** Loads a prepared print snapshot. Expired or unknown jobs never fall back to the whole roster. */
export async function getTicketPrintJob(id: string): Promise<TicketPrintJob | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM ticket_print_jobs WHERE id = ? AND expires_at > ? LIMIT 1`,
    [id, nowIso()],
  );
  const row = rows[0];
  if (!row) return null;
  let ids: unknown = [];
  try {
    ids = JSON.parse(String(row.student_ids_json ?? "[]"));
  } catch {
    ids = [];
  }
  return {
    id: String(row.id ?? ""),
    fair_slug: String(row.fair_slug ?? ""),
    student_ids: Array.isArray(ids) ? ids.map(String).filter(Boolean) : [],
    class_name: String(row.class_name ?? ""),
    section: String(row.section ?? ""),
    shift: String(row.shift ?? ""),
    rolls: String(row.rolls ?? ""),
    q: String(row.q ?? ""),
    lang: String(row.lang ?? "en"),
    created_by: String(row.created_by ?? ""),
    created_at: String(row.created_at ?? ""),
    expires_at: String(row.expires_at ?? ""),
  };
}

export async function recordTicketPrint(values: { fair_slug: string; student_id: string; guest_id: string; copies: number; printed_by: string; printed_by_name: string }) {
  await run(
    `INSERT INTO ticket_prints (id, fair_slug, student_id, guest_id, copies, printed_by, printed_by_name, printed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), values.fair_slug, values.student_id, values.guest_id, values.copies, values.printed_by, values.printed_by_name, nowIso()],
  );
}

/**
 * One bulk print job — a row per student, written in `db.batch` chunks.
 *
 * The audit log answers "who printed the whole of Class 8 and when", which is why
 * a bulk job is recorded per student rather than as a single summary row.
 */
export async function recordTicketPrints(values: {
  fair_slug: string;
  student_ids: string[];
  copies?: number;
  printed_by: string;
  printed_by_name: string;
}) {
  await ensurePortal();
  const ids = Array.from(new Set(values.student_ids.filter(Boolean)));
  if (!ids.length) return 0;
  const copies = Math.max(1, Math.floor(values.copies ?? 1));
  const stamp = nowIso();
  for (let index = 0; index < ids.length; index += 200) {
    await db.batch(
      ids.slice(index, index + 200).map((studentId) => ({
        sql: `INSERT INTO ticket_prints (id, fair_slug, student_id, guest_id, copies, printed_by, printed_by_name, printed_at)
              VALUES (?, ?, ?, '', ?, ?, ?, ?)`,
        args: [randomUUID(), values.fair_slug, studentId, copies, values.printed_by, values.printed_by_name, stamp],
      })),
      "write",
    );
  }
  return ids.length;
}

/* ------------------------------------------------------------------ *
 * Entry scans — the audit trail.
 * ------------------------------------------------------------------ */

/** The earliest successful admission for this person in this fair, if any. */
export async function findAdmission(fairSlug: string, subjectType: string, subjectId: string) {
  const rows = await query<{ entry_time: string }>(
    `SELECT entry_time FROM scan_logs WHERE fair_slug = ? AND subject_type = ? AND subject_id = ? AND result = 'success' ORDER BY entry_time ASC LIMIT 1`,
    [fairSlug, subjectType, subjectId],
  );
  return rows[0] ?? null;
}

export async function insertScanLog(values: Omit<ScanLogRow, "id">) {
  await run(
    `INSERT INTO scan_logs (id, fair_slug, subject_type, subject_id, subject_name, subject_code, method, result, entry_time, scanned_at, scanned_by, scanned_by_name, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      values.fair_slug,
      values.subject_type,
      values.subject_id,
      values.subject_name,
      values.subject_code,
      values.method,
      values.result,
      values.entry_time,
      values.scanned_at,
      values.scanned_by,
      values.scanned_by_name,
      values.note,
    ],
  );
}

export async function listScanLogs(filter: { fair_slug: string; limit?: number; today?: boolean }, now = new Date()) {
  const limit = Number.isFinite(filter.limit) ? Math.max(1, Math.min(500, Math.floor(filter.limit!))) : 100;
  const where = `fair_slug = ?${filter.today ? " AND scanned_at >= ? AND scanned_at < ?" : ""}`;
  const args = filter.today ? [filter.fair_slug, dhakaDayStartIso(now), nextSchoolDayIso(now)] : [filter.fair_slug];
  return query<ScanLogRow>(`SELECT * FROM scan_logs WHERE ${where} ORDER BY scanned_at DESC LIMIT ${limit}`, args);
}

export async function scanSummary(fairSlug: string) {
  const rows = await query<{ result: string; total: number }>(`SELECT result, COUNT(*) AS total FROM scan_logs WHERE fair_slug = ? GROUP BY result`, [fairSlug]);
  const summary: Record<string, number> = { success: 0, duplicate: 0, expired: 0, invalid: 0 };
  for (const row of rows) summary[String(row.result)] = Number(row.total ?? 0);
  const admitted = await query<{ total: number }>(
    `SELECT COUNT(DISTINCT subject_type || ':' || subject_id) AS total FROM scan_logs WHERE fair_slug = ? AND result = 'success'`,
    [fairSlug],
  );
  return { ...summary, admitted: Number(admitted[0]?.total ?? 0) };
}

export async function getStudentByCode(code: string) {
  const rows = await query<StudentRow>(`SELECT * FROM students WHERE student_code = ? LIMIT 1`, [code]);
  return rows[0] ?? null;
}

export async function studentsByIds(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean))).slice(0, 2000);
  if (!unique.length) return [] as StudentRow[];
  const placeholders = unique.map(() => "?").join(", ");
  return query<StudentRow>(`SELECT * FROM students WHERE id IN (${placeholders})`, unique);
}

export async function getPaymentStatus(studentId: string, fairSlug: string): Promise<PaymentStatus> {
  const rows = await query<{ status: string }>(`SELECT status FROM payments WHERE student_id = ? AND fair_slug = ? LIMIT 1`, [studentId, fairSlug]);
  return rows[0]?.status === "PAID" ? "PAID" : "UNPAID";
}

export async function lastAdmission(studentId: string, fairSlug: string) {
  const rows = await query<{ entry_time: string }>(
    `SELECT entry_time FROM scan_logs WHERE subject_type = 'student' AND subject_id = ? AND fair_slug = ? AND result = 'success' ORDER BY entry_time ASC LIMIT 1`,
    [studentId, fairSlug],
  );
  return rows[0]?.entry_time ?? "";
}
