/**
 * Relational schema for the student roster, payments, external guests,
 * ticket prints and the entry scan audit log.
 *
 * Kept as plain SQL (no imports) so `lib/portal-db.ts` can run it during the
 * same bootstrap as every other table. Every row here is written by a real
 * request — nothing in this file inserts demo data.
 */
export const studentSchema = [
  /* One row per student from the school roster (.xlsx import). `student_code`
     is the school's ID column and is unique, so re-importing a roster updates
     existing students instead of duplicating them. */
  `CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    serial_no INTEGER NOT NULL DEFAULT 0,
    student_code TEXT NOT NULL,
    roll TEXT NOT NULL DEFAULT '',
    photo_url TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL DEFAULT '',
    shift TEXT NOT NULL DEFAULT '',
    class_name TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    student_group TEXT NOT NULL DEFAULT '',
    sms_contact TEXT NOT NULL DEFAULT '',
    father_contact TEXT NOT NULL DEFAULT '',
    father_name TEXT NOT NULL DEFAULT '',
    mother_name TEXT NOT NULL DEFAULT '',
    father_photo_url TEXT NOT NULL DEFAULT '',
    mother_photo_url TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    import_batch TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS students_code_idx ON students(student_code)`,
  `CREATE INDEX IF NOT EXISTS students_class_idx ON students(class_name, section, shift, roll)`,
  /* Roll lookups: the photo-import sheet may key rows by roll instead of ID. */
  `CREATE INDEX IF NOT EXISTS students_roll_idx ON students(roll)`,
  /* Class-wise roster pages and the bulk ticket sheet both filter class first. */
  `CREATE INDEX IF NOT EXISTS students_class_section_idx ON students(class_name, section)`,

  /* Payment status per student per fair. PAID / UNPAID, saved immediately. */
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    fair_slug TEXT NOT NULL DEFAULT '',
    student_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'UNPAID',
    paid_at TEXT NOT NULL DEFAULT '',
    updated_by TEXT NOT NULL DEFAULT '',
    updated_by_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS payments_student_fair_idx ON payments(fair_slug, student_id)`,
  `CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(fair_slug, status)`,
  /* One student's status without scanning the fair (the ticket page). */
  `CREATE INDEX IF NOT EXISTS payments_student_idx ON payments(student_id)`,
  /* Covering index for "every PAID student of this fair" — the roster table,
     the class summary and the bulk ticket sheet all read through it. */
  `CREATE INDEX IF NOT EXISTS payments_fair_status_student_idx ON payments(fair_slug, status, student_id)`,

  /* External guests / guardians (Mama, Fufa, Chacha, …) linked to a student.
     Guests are photographed at the desk (camera → Cloudinary) and pay the
     mandatory 50 BDT entry fee plus the optional 150 BDT lunch box. */
  `CREATE TABLE IF NOT EXISTS guests (
    id TEXT PRIMARY KEY,
    fair_slug TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    contact TEXT NOT NULL DEFAULT '',
    related_student_id TEXT NOT NULL DEFAULT '',
    relation TEXT NOT NULL DEFAULT 'Other',
    photo_url TEXT NOT NULL DEFAULT '',
    entry_fee REAL NOT NULL DEFAULT 50,
    has_lunch INTEGER NOT NULL DEFAULT 0,
    lunch_fee REAL NOT NULL DEFAULT 0,
    total_fee REAL NOT NULL DEFAULT 50,
    fee_status TEXT NOT NULL DEFAULT 'PAID',
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL DEFAULT '',
    created_by_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS guests_student_idx ON guests(related_student_id, fair_slug)`,
  /* guest_count on the roster is filtered by fair + status first. */
  `CREATE INDEX IF NOT EXISTS guests_fair_status_idx ON guests(fair_slug, status, related_student_id)`,

  /* Every ticket/manual scan, including rejected ones. entry_time is when the
     person was admitted (or the original admission for a duplicate); scanned_at
     is the moment this attempt happened. */
  `CREATE TABLE IF NOT EXISTS scan_logs (
    id TEXT PRIMARY KEY,
    fair_slug TEXT NOT NULL DEFAULT '',
    subject_type TEXT NOT NULL DEFAULT '',
    subject_id TEXT NOT NULL DEFAULT '',
    subject_name TEXT NOT NULL DEFAULT '',
    subject_code TEXT NOT NULL DEFAULT '',
    method TEXT NOT NULL DEFAULT 'qr',
    result TEXT NOT NULL DEFAULT '',
    entry_time TEXT NOT NULL DEFAULT '',
    scanned_at TEXT NOT NULL DEFAULT '',
    scanned_by TEXT NOT NULL DEFAULT '',
    scanned_by_name TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS scan_logs_subject_idx ON scan_logs(fair_slug, subject_type, subject_id, result)`,
  `CREATE INDEX IF NOT EXISTS scan_logs_time_idx ON scan_logs(fair_slug, scanned_at)`,
  /* "When was this person admitted" — subject first, then the fair and result. */
  `CREATE INDEX IF NOT EXISTS scan_logs_admission_idx ON scan_logs(subject_type, subject_id, fair_slug, result, entry_time)`,

  /* Each time a ticket is sent to print (copies, optional guardian). */
  `CREATE TABLE IF NOT EXISTS ticket_prints (
    id TEXT PRIMARY KEY,
    fair_slug TEXT NOT NULL DEFAULT '',
    student_id TEXT NOT NULL DEFAULT '',
    guest_id TEXT NOT NULL DEFAULT '',
    copies INTEGER NOT NULL DEFAULT 1,
    printed_by TEXT NOT NULL DEFAULT '',
    printed_by_name TEXT NOT NULL DEFAULT '',
    printed_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS ticket_prints_student_idx ON ticket_prints(student_id, fair_slug)`,
  /* print_count per student of one fair, and the fair-wide print summary. */
  `CREATE INDEX IF NOT EXISTS ticket_prints_fair_idx ON ticket_prints(fair_slug, student_id)`,

  /* Short-lived snapshot of the exact students prepared for one bulk print.
     Keeping the IDs server-side avoids enormous URLs for 500+ selections. */
  `CREATE TABLE IF NOT EXISTS ticket_print_jobs (
    id TEXT PRIMARY KEY,
    fair_slug TEXT NOT NULL DEFAULT '',
    student_ids_json TEXT NOT NULL DEFAULT '[]',
    class_name TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    shift TEXT NOT NULL DEFAULT '',
    rolls TEXT NOT NULL DEFAULT '',
    q TEXT NOT NULL DEFAULT '',
    lang TEXT NOT NULL DEFAULT 'en',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    expires_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS ticket_print_jobs_expiry_idx ON ticket_print_jobs(expires_at)`,
];

/** Relations accepted for external guests. Stored as the English label. */
export const guestRelations = [
  "Mama (maternal uncle)",
  "Chacha (paternal uncle)",
  "Fufa (aunt's husband)",
  "Khala (maternal aunt)",
  "Phupu (paternal aunt)",
  "Guardian",
  "Other guest",
] as const;
