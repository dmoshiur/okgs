/**
 * Data access for the student roster, payments, external guests, ticket prints
 * and the entry scan audit log. Every function talks to the live database.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { dbQuery as query, dbRun as run, ensurePortal } from "@/lib/portal-db";
import { guestRelations } from "@/lib/student-schema";
import { normalizeRoll } from "@/lib/roll-range";

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

export async function listStudentsWithStatus(filter: {
  fair_slug: string;
  class_name?: string;
  section?: string;
  shift?: string;
  q?: string;
  payment?: "" | "PAID" | "UNPAID";
  limit?: number;
}): Promise<StudentListRow[]> {
  const fair = filter.fair_slug;
  const clauses: string[] = [];
  const args: (string | number)[] = [fair, fair, fair, fair];
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
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(5000, Math.floor(filter.limit ?? 2000)));
  const rows = await query<Record<string, unknown>>(
    `SELECT s.*,
       COALESCE(p.status, 'UNPAID') AS payment_status,
       COALESCE(p.paid_at, '') AS paid_at,
       (SELECT COUNT(*) FROM ticket_prints t WHERE t.student_id = s.id AND t.fair_slug = ?) AS print_count,
       COALESCE((SELECT MIN(l.entry_time) FROM scan_logs l WHERE l.subject_type = 'student' AND l.subject_id = s.id AND l.fair_slug = ? AND l.result = 'success'), '') AS entered_at,
       (SELECT COUNT(*) FROM guests g WHERE g.related_student_id = s.id AND g.fair_slug = ? AND g.status = 'active') AS guest_count
     FROM students s
     LEFT JOIN payments p ON p.student_id = s.id AND p.fair_slug = ?
     ${where}
     ORDER BY s.class_name ASC, s.section ASC, s.shift ASC, CAST(s.roll AS INTEGER) ASC, s.roll ASC, s.name ASC
     LIMIT ${limit}`,
    args,
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

export async function getStudentById(id: string) {
  const rows = await query<StudentRow>(`SELECT * FROM students WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

/** Students matching a class/section/shift scope (roll filtering happens in the caller). */
export async function scopedStudents(scope: { class_name: string; section?: string; shift?: string }) {
  const clauses = ["class_name = ?"];
  const args: string[] = [scope.class_name];
  if (scope.section) {
    clauses.push("section = ?");
    args.push(scope.section);
  }
  if (scope.shift) {
    clauses.push("shift = ?");
    args.push(scope.shift);
  }
  return query<StudentRow>(`SELECT * FROM students WHERE ${clauses.join(" AND ")} ORDER BY CAST(roll AS INTEGER) ASC, roll ASC`, args);
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
        sql: `INSERT INTO students (id, serial_no, student_code, roll, photo_url, name, branch, shift, class_name, section, student_group, sms_contact, father_contact, father_name, mother_name, tags, import_batch, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(student_code) DO UPDATE SET
                serial_no = excluded.serial_no, roll = excluded.roll, photo_url = excluded.photo_url, name = excluded.name,
                branch = excluded.branch, shift = excluded.shift, class_name = excluded.class_name, section = excluded.section,
                student_group = excluded.student_group, sms_contact = excluded.sms_contact, father_contact = excluded.father_contact,
                father_name = excluded.father_name, mother_name = excluded.mother_name, tags = excluded.tags,
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

export function isGuestRelation(value: string) {
  return (guestRelations as readonly string[]).includes(value);
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
  created_by: string;
  created_by_name: string;
}) {
  await ensurePortal();
  const id = randomUUID();
  const stamp = nowIso();
  await run(
    `INSERT INTO guests (id, fair_slug, name, contact, related_student_id, relation, status, created_by, created_by_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    [id, values.fair_slug, values.name, values.contact, values.related_student_id, values.relation, values.created_by, values.created_by_name, stamp, stamp],
  );
  return getGuestById(id);
}

export async function setGuestStatus(id: string, status: "active" | "revoked") {
  await run(`UPDATE guests SET status = ?, updated_at = ? WHERE id = ?`, [status, nowIso(), id]);
  return getGuestById(id);
}

export async function activeGuestsForStudent(studentId: string, fairSlug: string) {
  return query<GuestRow>(`${guestSelect} WHERE g.related_student_id = ? AND g.fair_slug = ? AND g.status = 'active' ORDER BY g.created_at ASC`, [studentId, fairSlug]);
}

/* ------------------------------------------------------------------ *
 * Ticket prints
 * ------------------------------------------------------------------ */

export async function recordTicketPrint(values: { fair_slug: string; student_id: string; guest_id: string; copies: number; printed_by: string; printed_by_name: string }) {
  await run(
    `INSERT INTO ticket_prints (id, fair_slug, student_id, guest_id, copies, printed_by, printed_by_name, printed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), values.fair_slug, values.student_id, values.guest_id, values.copies, values.printed_by, values.printed_by_name, nowIso()],
  );
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

export async function listScanLogs(filter: { fair_slug: string; limit?: number }) {
  const limit = Math.max(1, Math.min(500, Math.floor(filter.limit ?? 100)));
  return query<ScanLogRow>(`SELECT * FROM scan_logs WHERE fair_slug = ? ORDER BY scanned_at DESC LIMIT ${limit}`, [filter.fair_slug]);
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
