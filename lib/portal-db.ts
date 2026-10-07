/**
 * Portal data layer — the *transactional* half of OKGS.
 *
 * The content tables (clubs, news, fairs, gallery …) are generated from
 * lib/content-config.ts. Everything that moves money or identifies a person
 * lives here: users, classes, funds, dues, expenses, QR passes and scans.
 *
 * All tables are created on first use (`ensurePortal`), so a fresh local.db or a
 * brand-new Turso database bootstraps itself without a migration step.
 */
import { randomUUID } from "node:crypto";
import { db, ensureDatabase } from "@/lib/db";
import type { PortalRole } from "@/lib/roles";

export {
  roleLabels,
  roleLabelsEn,
  allRoles,
  adminRoles,
  assignableRoles,
  staffRoles,
  isStaffRole,
  isAdminRole,
  isSuperAdminRole,
  isPortalRole,
  dashboardPathForRole,
} from "@/lib/roles";
export type { PortalRole } from "@/lib/roles";

export interface PortalUser {
  id: string;
  role: PortalRole;
  name: string;
  name_en: string;
  email: string;
  student_id: string;
  class_level: string;
  section: string;
  roll: string;
  phone: string;
  photo_url: string;
  club_slug: string;
  designation: string;
  session_year: string;
  blood_group: string;
  address: string;
  guardian_name: string;
  guardian_phone: string;
  password_hash: string;
  password_salt: string;
  must_change_password: number;
  is_active: number;
  last_login_at: string;
  created_at: string;
  updated_at: string;
}

export type PublicUser = Omit<PortalUser, "password_hash" | "password_salt">;

export function publicUser(user: PortalUser): PublicUser {
  const { password_hash: _hash, password_salt: _salt, ...rest } = user;
  return rest;
}

export interface PortalClass {
  id: string;
  name: string;
  level: number;
  sections: string;
  note: string;
  fee_amount: number;
  fee_title: string;
  fee_session: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface FundRow {
  id: string;
  fair_slug: string;
  user_id: string;
  payer_name: string;
  payer_role: string;
  class_level: string;
  section: string;
  student_id: string;
  phone: string;
  due_id: string;
  receipt_no: string;
  amount: number;
  method: string;
  trx_id: string;
  purpose: string;
  status: string;
  note: string;
  collected_by: string;
  verified_by: string;
  verified_at: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseRow {
  id: string;
  fair_slug: string;
  title: string;
  category: string;
  amount: number;
  paid_to: string;
  paid_at: string;
  method: string;
  voucher_no: string;
  memo_no: string;
  note: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DueRow {
  id: string;
  fair_slug: string;
  user_id: string;
  student_name: string;
  student_id: string;
  class_level: string;
  section: string;
  title: string;
  class_fee_id: string;
  amount: number;
  paid_amount: number;
  pending_amount?: number;
  due_date: string;
  status: string;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PassRow {
  id: string;
  fair_slug: string;
  user_id: string;
  holder_name: string;
  holder_role: string;
  student_id: string;
  class_level: string;
  section: string;
  email: string;
  phone: string;
  token: string;
  status: string;
  scan_count: number;
  last_scan_at: string;
  parent_pass_id: string;
  guest_index: number;
  guest_limit: number;
  expires_at: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface ScanRow {
  id: string;
  pass_id: string;
  token: string;
  fair_slug: string;
  scanned_by: string;
  scanned_by_name: string;
  result: string;
  note: string;
  created_at: string;
}

/* ------------------------------------------------------------------ *
 * Schema
 * ------------------------------------------------------------------ */

const schema = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'student',
    name TEXT NOT NULL DEFAULT '',
    name_en TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    student_id TEXT NOT NULL DEFAULT '',
    class_level TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    roll TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    photo_url TEXT NOT NULL DEFAULT '',
    club_slug TEXT NOT NULL DEFAULT '',
    designation TEXT NOT NULL DEFAULT '',
    session_year TEXT NOT NULL DEFAULT '',
    blood_group TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    guardian_name TEXT NOT NULL DEFAULT '',
    guardian_phone TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL DEFAULT '',
    password_salt TEXT NOT NULL DEFAULT '',
    must_change_password INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email) WHERE email <> ''`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_sid_idx ON users(student_id) WHERE student_id <> ''`,
  `CREATE INDEX IF NOT EXISTS users_class_idx ON users(class_level, section)`,
  `CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    level INTEGER NOT NULL DEFAULT 0,
    sections TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    fee_amount REAL NOT NULL DEFAULT 0,
    fee_title TEXT NOT NULL DEFAULT 'শ্রেণি ফি',
    fee_session TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS funds (
    id TEXT PRIMARY KEY,
    fair_slug TEXT NOT NULL DEFAULT '',
    user_id TEXT NOT NULL DEFAULT '',
    payer_name TEXT NOT NULL DEFAULT '',
    payer_role TEXT NOT NULL DEFAULT 'student',
    class_level TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    student_id TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    due_id TEXT NOT NULL DEFAULT '',
    receipt_no TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    method TEXT NOT NULL DEFAULT 'নগদ',
    trx_id TEXT NOT NULL DEFAULT '',
    purpose TEXT NOT NULL DEFAULT 'বিজ্ঞান মেলা ফান্ড',
    status TEXT NOT NULL DEFAULT 'verified',
    note TEXT NOT NULL DEFAULT '',
    collected_by TEXT NOT NULL DEFAULT '',
    verified_by TEXT NOT NULL DEFAULT '',
    verified_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS funds_status_idx ON funds(status, fair_slug)`,
  `CREATE INDEX IF NOT EXISTS funds_class_idx ON funds(class_level, section)`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    fair_slug TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'সাধারণ',
    amount REAL NOT NULL DEFAULT 0,
    paid_to TEXT NOT NULL DEFAULT '',
    paid_at TEXT NOT NULL DEFAULT '',
    method TEXT NOT NULL DEFAULT 'নগদ',
    voucher_no TEXT NOT NULL DEFAULT '',
    memo_no TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'approved',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS dues (
    id TEXT PRIMARY KEY,
    fair_slug TEXT NOT NULL DEFAULT '',
    user_id TEXT NOT NULL DEFAULT '',
    student_name TEXT NOT NULL DEFAULT '',
    student_id TEXT NOT NULL DEFAULT '',
    class_level TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    class_fee_id TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    paid_amount REAL NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'due',
    note TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS dues_status_idx ON dues(status, fair_slug)`,
  `CREATE TABLE IF NOT EXISTS passes (
    id TEXT PRIMARY KEY,
    fair_slug TEXT NOT NULL DEFAULT '',
    user_id TEXT NOT NULL DEFAULT '',
    holder_name TEXT NOT NULL DEFAULT '',
    holder_role TEXT NOT NULL DEFAULT 'student',
    student_id TEXT NOT NULL DEFAULT '',
    class_level TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    token TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    scan_count INTEGER NOT NULL DEFAULT 0,
    last_scan_at TEXT NOT NULL DEFAULT '',
    parent_pass_id TEXT NOT NULL DEFAULT '',
    guest_index INTEGER NOT NULL DEFAULT 0,
    guest_limit INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS passes_token_idx ON passes(token) WHERE token <> ''`,
  `CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    pass_id TEXT NOT NULL DEFAULT '',
    token TEXT NOT NULL DEFAULT '',
    fair_slug TEXT NOT NULL DEFAULT '',
    scanned_by TEXT NOT NULL DEFAULT '',
    scanned_by_name TEXT NOT NULL DEFAULT '',
    result TEXT NOT NULL DEFAULT 'ok',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS tickers (
    id TEXT PRIMARY KEY,
    fair_slug TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    class_level TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'notice',
    audience TEXT NOT NULL DEFAULT 'all',
    target_role TEXT NOT NULL DEFAULT '',
    payment_segment TEXT NOT NULL DEFAULT '',
    starts_at TEXT NOT NULL DEFAULT '',
    ends_at TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS tickers_fair_idx ON tickers(fair_slug, sort_order)`,
  `CREATE TABLE IF NOT EXISTS smtp_settings (
    id TEXT PRIMARY KEY,
    host TEXT NOT NULL DEFAULT '',
    port INTEGER NOT NULL DEFAULT 587,
    secure INTEGER NOT NULL DEFAULT 0,
    username TEXT NOT NULL DEFAULT '',
    password_encrypted TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT 'OKGS',
    from_email TEXT NOT NULL DEFAULT '',
    reply_to TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL DEFAULT '',
    actor_name TEXT NOT NULL DEFAULT '',
    actor_role TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL DEFAULT '',
    entity TEXT NOT NULL DEFAULT '',
    entity_id TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ''
  )`,
  /* Email verification tokens for the "Forgot password" flow. Only the SHA-256
     hash of the token is stored, so a leaked database cannot be used to reset
     anybody's password. Each token is single-use and expires after 60 minutes. */
  `CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    token_hash TEXT NOT NULL DEFAULT '',
    purpose TEXT NOT NULL DEFAULT 'reset',
    expires_at TEXT NOT NULL DEFAULT '',
    used_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS password_resets_hash_idx ON password_resets(token_hash)`,
  `CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id, purpose)`,
];

const portalMigrations: Record<string, Record<string, string>> = {
  classes: {
    fee_amount: "REAL NOT NULL DEFAULT 0",
    fee_title: "TEXT NOT NULL DEFAULT 'শ্রেণি ফি'",
    fee_session: "TEXT NOT NULL DEFAULT ''",
  },
  funds: {
    due_id: "TEXT NOT NULL DEFAULT ''",
    receipt_no: "TEXT NOT NULL DEFAULT ''",
  },
  expenses: { memo_no: "TEXT NOT NULL DEFAULT ''" },
  dues: { class_fee_id: "TEXT NOT NULL DEFAULT ''" },
  passes: {
    parent_pass_id: "TEXT NOT NULL DEFAULT ''",
    guest_index: "INTEGER NOT NULL DEFAULT 0",
    guest_limit: "INTEGER NOT NULL DEFAULT 0",
  },
  tickers: {
    audience: "TEXT NOT NULL DEFAULT 'all'",
    target_role: "TEXT NOT NULL DEFAULT ''",
    payment_segment: "TEXT NOT NULL DEFAULT ''",
    starts_at: "TEXT NOT NULL DEFAULT ''",
    ends_at: "TEXT NOT NULL DEFAULT ''",
  },
};

const portalIndexes = [
  `CREATE INDEX IF NOT EXISTS funds_due_idx ON funds(due_id, status)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS funds_receipt_no_idx ON funds(receipt_no) WHERE receipt_no <> ''`,
  `CREATE UNIQUE INDEX IF NOT EXISTS expenses_memo_no_idx ON expenses(memo_no) WHERE memo_no <> ''`,
  `CREATE INDEX IF NOT EXISTS dues_fee_idx ON dues(class_fee_id, user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS dues_fee_student_idx ON dues(class_fee_id, user_id) WHERE class_fee_id <> ''`,
  `CREATE INDEX IF NOT EXISTS passes_guest_parent_idx ON passes(parent_pass_id, guest_index)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS passes_guest_slot_idx ON passes(parent_pass_id, guest_index) WHERE parent_pass_id <> ''`,
  `CREATE TRIGGER IF NOT EXISTS passes_guest_slot_limit_insert BEFORE INSERT ON passes WHEN NEW.parent_pass_id <> '' AND (SELECT COUNT(*) FROM passes WHERE parent_pass_id = NEW.parent_pass_id) >= COALESCE((SELECT guest_limit FROM passes WHERE id = NEW.parent_pass_id), 0) BEGIN SELECT RAISE(ABORT, 'GUEST_LIMIT_EXCEEDED'); END`,
  `CREATE TRIGGER IF NOT EXISTS passes_guest_limit_update BEFORE UPDATE OF guest_limit ON passes WHEN NEW.parent_pass_id = '' AND (NEW.guest_limit < 0 OR NEW.guest_limit > 4 OR NEW.guest_limit < (SELECT COUNT(*) FROM passes WHERE parent_pass_id = OLD.id)) BEGIN SELECT RAISE(ABORT, 'GUEST_LIMIT_BELOW_ISSUED'); END`,
  `CREATE INDEX IF NOT EXISTS tickers_window_idx ON tickers(is_active, starts_at, ends_at)`,
];

async function repairLegacyUniqueRows() {
  const duplicateDues = await db.execute(`SELECT class_fee_id, user_id, MIN(id) AS keep_id FROM dues WHERE class_fee_id <> '' GROUP BY class_fee_id, user_id HAVING COUNT(*) > 1`);
  for (const row of duplicateDues.rows) {
    const feeId = String(row.class_fee_id ?? "");
    const userId = String(row.user_id ?? "");
    const keepId = String(row.keep_id ?? "");
    if (!feeId || !keepId) continue;
    await db.execute({ sql: `UPDATE dues SET amount = (SELECT MAX(other.amount) FROM dues other WHERE other.class_fee_id = ? AND other.user_id = ?) WHERE id = ?`, args: [feeId, userId, keepId] });
    await db.execute({ sql: `UPDATE funds SET due_id = ? WHERE due_id IN (SELECT id FROM dues WHERE class_fee_id = ? AND user_id = ? AND id <> ?)`, args: [keepId, feeId, userId, keepId] });
    await db.execute({ sql: `DELETE FROM dues WHERE class_fee_id = ? AND user_id = ? AND id <> ?`, args: [feeId, userId, keepId] });
    await db.execute({ sql: `UPDATE dues SET paid_amount = (SELECT COALESCE(SUM(amount),0) FROM funds WHERE due_id = ? AND status = 'verified'), status = CASE WHEN (SELECT COALESCE(SUM(amount),0) FROM funds WHERE due_id = ? AND status = 'verified') >= amount THEN 'paid' WHEN (SELECT COALESCE(SUM(amount),0) FROM funds WHERE due_id = ? AND status = 'verified') > 0 THEN 'partial' ELSE 'due' END WHERE id = ?`, args: [keepId, keepId, keepId, keepId] });
  }

  const duplicateGuestSlots = await db.execute(`SELECT parent_pass_id, guest_index, MIN(id) AS keep_id FROM passes WHERE parent_pass_id <> '' GROUP BY parent_pass_id, guest_index HAVING COUNT(*) > 1`);
  for (const row of duplicateGuestSlots.rows) {
    const parentId = String(row.parent_pass_id ?? "");
    const guestIndex = Number(row.guest_index ?? 0);
    const keepId = String(row.keep_id ?? "");
    if (!parentId || !keepId) continue;
    await db.execute({ sql: `UPDATE passes SET status = 'revoked', parent_pass_id = '', guest_index = 0, guest_limit = 0, note = CASE WHEN note = '' THEN 'duplicate guest slot revoked during migration' ELSE note || ' · duplicate guest slot revoked during migration' END WHERE parent_pass_id = ? AND guest_index = ? AND id <> ?`, args: [parentId, guestIndex, keepId] });
  }
}

async function migratePortalColumns() {
  for (const [table, columns] of Object.entries(portalMigrations)) {
    const result = await db.execute(`PRAGMA table_info("${table}")`);
    const present = new Set(result.rows.map((row) => String(row.name)));
    for (const [name, declaration] of Object.entries(columns)) {
      if (!present.has(name)) await db.execute(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${declaration}`);
    }
  }
  await repairLegacyUniqueRows();
  for (const statement of portalIndexes) await db.execute(statement);
}

const globalForPortal = globalThis as unknown as { okgsPortalReady?: Promise<void> };

/**
 * True while the bootstrap itself is running. The seed helpers call the same
 * query/run functions below, and without this flag they would await the very
 * promise they are part of — a deadlock that hangs the request instead of failing.
 */
let bootstrapping = false;

export function ensurePortal() {
  if (!globalForPortal.okgsPortalReady) {
    globalForPortal.okgsPortalReady = (async () => {
      bootstrapping = true;
      try {
        await ensureDatabase();
        for (const statement of schema) await db.execute(statement);
        await migratePortalColumns();
        await seedPortal();
      } finally {
        bootstrapping = false;
      }
    })().catch((error) => {
      globalForPortal.okgsPortalReady = undefined;
      bootstrapping = false;
      throw error;
    });
  }
  return globalForPortal.okgsPortalReady;
}

const nowIso = () => new Date().toISOString();
const documentNumber = (prefix: string) => `${prefix}-${nowIso().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 6).toUpperCase()}`;

/* ------------------------------------------------------------------ *
 * Tiny query helpers
 * ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function query<T = Record<string, unknown>>(sql: string, args: (string | number)[] = []): Promise<T[]> {
  if (!bootstrapping) await ensurePortal();
  const result = await db.execute({ sql, args });
  return result.rows.map((row) => {
    const plain: Record<string, unknown> = {};
    for (const key of Object.keys(row)) plain[key] = row[key as keyof typeof row];
    return plain as T;
  });
}

async function run(sql: string, args: (string | number)[] = []) {
  if (!bootstrapping) await ensurePortal();
  return db.execute({ sql, args });
}

function insertStatement(table: string, values: Record<string, string | number>) {
  const columns = Object.keys(values);
  return {
    sql: `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    args: columns.map((column) => values[column]),
  };
}

function updateStatement(table: string, id: string, values: Record<string, string | number>) {
  const entries = Object.entries(values);
  return {
    sql: `UPDATE ${table} SET ${entries.map(([column]) => `"${column}" = ?`).join(", ")} WHERE id = ?`,
    args: [...entries.map(([, value]) => value), id],
  };
}

export async function logActivity(entry: {
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  action: string;
  entity?: string;
  entity_id?: string;
  detail?: string;
}) {
  await run(
    `INSERT INTO activity (id, actor_id, actor_name, actor_role, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      entry.actor_id ?? "",
      entry.actor_name ?? "",
      entry.actor_role ?? "",
      entry.action,
      entry.entity ?? "",
      entry.entity_id ?? "",
      entry.detail ?? "",
      nowIso(),
    ],
  );
}

export async function recentActivity(limit = 30) {
  return query<Record<string, string>>(
    `SELECT * FROM activity ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(200, Math.floor(limit)))}`,
  ) as Promise<
    { id: string; actor_name: string; actor_role: string; action: string; entity: string; detail: string; created_at: string }[]
  >;
}

/* ------------------------------------------------------------------ *
 * Users
 * ------------------------------------------------------------------ */

const userWritable = [
  "role",
  "name",
  "name_en",
  "email",
  "student_id",
  "class_level",
  "section",
  "roll",
  "phone",
  "photo_url",
  "club_slug",
  "designation",
  "session_year",
  "blood_group",
  "address",
  "guardian_name",
  "guardian_phone",
  "password_hash",
  "password_salt",
  "must_change_password",
  "is_active",
] as const;

export async function listUsers(filter: { role?: string; class_level?: string; section?: string; search?: string; payment_status?: "paid" | "unpaid"; payment_fair_slug?: string; limit?: number } = {}) {
  const clauses: string[] = [];
  const args: string[] = [];
  if (filter.role) {
    clauses.push("role = ?");
    args.push(filter.role);
  }
  if (filter.class_level) {
    clauses.push("class_level = ?");
    args.push(filter.class_level);
  }
  if (filter.section) {
    clauses.push("section = ?");
    args.push(filter.section);
  }
  if (filter.search) {
    clauses.push("(name LIKE ? OR email LIKE ? OR student_id LIKE ? OR phone LIKE ? OR designation LIKE ?)");
    const like = `%${filter.search}%`;
    args.push(like, like, like, like, like);
  }
  if (filter.payment_status) {
    const fairClause = filter.payment_fair_slug ? " AND d.fair_slug = ?" : "";
    if (filter.payment_status === "paid") {
      clauses.push(`EXISTS (SELECT 1 FROM dues d WHERE d.user_id = users.id${fairClause}) AND NOT EXISTS (SELECT 1 FROM dues d WHERE d.user_id = users.id${fairClause} AND d.status IN ('due','partial') AND d.amount > d.paid_amount)`);
      if (filter.payment_fair_slug) args.push(filter.payment_fair_slug, filter.payment_fair_slug);
    } else {
      clauses.push(`EXISTS (SELECT 1 FROM dues d WHERE d.user_id = users.id${fairClause} AND d.status IN ('due','partial') AND d.amount > d.paid_amount)`);
      if (filter.payment_fair_slug) args.push(filter.payment_fair_slug);
    }
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(5000, Math.floor(filter.limit ?? 500)));
  const rows = await query<PortalUser>(`SELECT * FROM users ${where} ORDER BY role ASC, class_level ASC, section ASC, name ASC LIMIT ${limit}`, args);
  return rows;
}

export async function getUser(id: string) {
  const rows = await query<PortalUser>(`SELECT * FROM users WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function findUserByLogin(identifier: string) {
  const value = identifier.trim();
  if (!value) return null;
  const rows = await query<PortalUser>(
    `SELECT * FROM users WHERE (lower(email) = lower(?) OR upper(student_id) = upper(?)) LIMIT 1`,
    [value, value],
  );
  return rows[0] ?? null;
}

export async function findUserByEmail(email: string) {
  const rows = await query<PortalUser>(`SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1`, [email.trim()]);
  return rows[0] ?? null;
}

export async function createUser(values: Partial<PortalUser> & { name: string; role?: PortalRole }) {
  const id = values.id || randomUUID();
  const record: Record<string, string | number> = {
    id,
    role: values.role ?? "student",
    name: values.name ?? "",
    name_en: values.name_en ?? "",
    email: (values.email ?? "").trim().toLowerCase(),
    student_id: (values.student_id ?? "").trim(),
    class_level: values.class_level ?? "",
    section: values.section ?? "",
    roll: values.roll ?? "",
    phone: values.phone ?? "",
    photo_url: values.photo_url ?? "",
    club_slug: values.club_slug ?? "",
    designation: values.designation ?? "",
    session_year: values.session_year ?? "",
    blood_group: values.blood_group ?? "",
    address: values.address ?? "",
    guardian_name: values.guardian_name ?? "",
    guardian_phone: values.guardian_phone ?? "",
    password_hash: values.password_hash ?? "",
    password_salt: values.password_salt ?? "",
    must_change_password: values.must_change_password ?? 0,
    is_active: values.is_active ?? 1,
    last_login_at: values.last_login_at ?? "",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await run(insertStatement("users", record).sql, insertStatement("users", record).args as (string | number)[]);
  return (await getUser(id))!;
}

export async function updateUser(id: string, values: Partial<PortalUser>) {
  const clean: Record<string, string | number> = {};
  for (const key of userWritable) {
    if (key in values && values[key] !== undefined) clean[key] = values[key] as string | number;
  }
  if (!Object.keys(clean).length) return getUser(id);
  clean.updated_at = nowIso();
  const statement = updateStatement("users", id, clean);
  await run(statement.sql, statement.args as (string | number)[]);
  return getUser(id);
}

export async function deleteUser(id: string) {
  const result = await run(`DELETE FROM users WHERE id = ?`, [id]);
  return Number(result.rowsAffected ?? 0) > 0;
}

export async function touchLogin(id: string) {
  await run(`UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`, [nowIso(), nowIso(), id]);
}

/* ------------------------------------------------------------------ *
 * Email-based accounts
 *
 * Every account that carries an email address is written to the users
 * table with the address normalised (trimmed + lower-cased) and the
 * UNIQUE index on `email` guarantees one account per address. These
 * helpers are the single writer for that column, so the admin studio,
 * the fair console and the SuperAdmin user manager all stay in sync.
 * ------------------------------------------------------------------ */

/** Normalise an address before it ever reaches the database. */
export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

/** A pragmatic address check — enough to stop typos, never a full RFC parser. */
export function isEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * Creates an account keyed by email address and returns it. The address is
 * stored in the primary database (users.email) — that row is what the login
 * page, the password-reset flow and the mailer all read.
 */
export async function createEmailAccount(values: {
  email: string;
  name?: string;
  role?: PortalRole;
  password_hash?: string;
  password_salt?: string;
  [key: string]: unknown;
}) {
  const email = normalizeEmail(values.email);
  if (!email) throw new Error("EMAIL_REQUIRED");
  const existing = await findUserByEmail(email);
  if (existing) throw new Error("EMAIL_TAKEN");
  return createUser({
    ...(values as Partial<PortalUser>),
    name: values.name || email.split("@")[0],
    email,
    role: values.role ?? "student",
  });
}

/** Re-points an account to a new address (and keeps the row in sync). */
export async function syncUserEmail(userId: string, email: string) {
  const next = normalizeEmail(email);
  if (!next) throw new Error("EMAIL_REQUIRED");
  const owner = await findUserByEmail(next);
  if (owner && owner.id !== userId) throw new Error("EMAIL_TAKEN");
  return updateUser(userId, { email: next });
}

/** Writes a brand-new password (used by the reset flow and the user manager). */
export async function setUserPassword(userId: string, passwordHash: string, passwordSalt: string, options: { mustChange?: boolean } = {}) {
  return updateUser(userId, {
    password_hash: passwordHash,
    password_salt: passwordSalt,
    must_change_password: options.mustChange ? 1 : 0,
  });
}

/* ------------------------------------------------------------------ *
 * Password-reset tokens
 * ------------------------------------------------------------------ */

export interface PasswordResetRow {
  id: string;
  user_id: string;
  email: string;
  token_hash: string;
  purpose: string;
  expires_at: string;
  used_at: string;
  created_at: string;
}

export async function createPasswordReset(values: {
  userId: string;
  email: string;
  tokenHash: string;
  purpose?: string;
  ttlMinutes?: number;
}) {
  const ttl = Math.max(5, Math.min(24 * 60, values.ttlMinutes ?? 60));
  // One live token per account and purpose — older links stop working.
  await run(`DELETE FROM password_resets WHERE user_id = ? AND purpose = ? AND used_at = ''`, [
    values.userId,
    values.purpose ?? "reset",
  ]);
  const record = {
    id: randomUUID(),
    user_id: values.userId,
    email: normalizeEmail(values.email),
    token_hash: values.tokenHash,
    purpose: values.purpose ?? "reset",
    expires_at: new Date(Date.now() + ttl * 60_000).toISOString(),
    used_at: "",
    created_at: nowIso(),
  };
  const statement = insertStatement("password_resets", record);
  await run(statement.sql, statement.args as (string | number)[]);
  return record;
}

export async function findPasswordReset(tokenHash: string) {
  const rows = await query<PasswordResetRow>(
    `SELECT * FROM password_resets WHERE token_hash = ? ORDER BY created_at DESC LIMIT 1`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function consumePasswordReset(id: string) {
  await run(`UPDATE password_resets SET used_at = ? WHERE id = ?`, [nowIso(), id]);
}

export async function recentResetRequests(email: string, sinceMinutes = 15) {
  const since = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM password_resets WHERE email = ? AND created_at >= ?`,
    [normalizeEmail(email), since],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function userCountsByRole() {
  const rows = await query<{ role: string; total: number }>(`SELECT role, COUNT(*) as total FROM users WHERE is_active = 1 GROUP BY role`);
  const out: Record<string, number> = {};
  for (const row of rows) out[String(row.role)] = Number(row.total ?? 0);
  out.total = rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  return out;
}

/* ------------------------------------------------------------------ *
 * Classes & sections
 * ------------------------------------------------------------------ */

export function sectionList(value: string) {
  return String(value ?? "")
    .split(/[,\u0964|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function listClasses(activeOnly = false) {
  const rows = await query<PortalClass>(`SELECT * FROM classes ${activeOnly ? "WHERE is_active = 1" : ""} ORDER BY sort_order ASC, level ASC, name ASC`);
  return rows;
}

export async function createClass(values: { name: string; level?: number; sections?: string; note?: string; fee_amount?: number; fee_title?: string; fee_session?: string; sort_order?: number; is_active?: number }) {
  const id = randomUUID();
  const record = {
    id,
    name: values.name,
    level: values.level ?? 0,
    sections: values.sections ?? "",
    note: values.note ?? "",
    fee_amount: Math.max(0, Number(values.fee_amount) || 0),
    fee_title: values.fee_title ?? "শ্রেণি ফি",
    fee_session: values.fee_session ?? String(new Date().getFullYear()),
    sort_order: values.sort_order ?? 0,
    is_active: values.is_active ?? 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  const statement = insertStatement("classes", record);
  await run(statement.sql, statement.args as (string | number)[]);
  return id;
}

export async function updateClass(id: string, values: Partial<PortalClass>) {
  const clean: Record<string, string | number> = {};
  for (const key of ["name", "level", "sections", "note", "fee_amount", "fee_title", "fee_session", "sort_order", "is_active"] as const) {
    if (key in values && values[key] !== undefined) clean[key] = values[key] as string | number;
  }
  if (!Object.keys(clean).length) return;
  clean.updated_at = nowIso();
  const statement = updateStatement("classes", id, clean);
  await run(statement.sql, statement.args as (string | number)[]);
}

export async function deleteClass(id: string) {
  const result = await run(`DELETE FROM classes WHERE id = ?`, [id]);
  return Number(result.rowsAffected ?? 0) > 0;
}

/** Students grouped by class + section — powers the dashboard breakdown. */
export async function studentsByClass() {
  const rows = await query<{ class_level: string; section: string; total: number }>(
    `SELECT class_level, section, COUNT(*) as total FROM users
     WHERE role = 'student' AND is_active = 1
     GROUP BY class_level, section
     ORDER BY class_level ASC, section ASC`,
  );
  return rows.map((row) => ({
    class_level: String(row.class_level || "শ্রেণি উল্লেখ নেই"),
    section: String(row.section || "—"),
    total: Number(row.total ?? 0),
  }));
}

export async function classOptions() {
  const [classes, grouped] = await Promise.all([listClasses(true), studentsByClass()]);
  const names = new Set<string>();
  for (const item of classes) names.add(item.name);
  for (const item of grouped) names.add(item.class_level);
  return Array.from(names).filter(Boolean);
}

export function classFeeId(classId: string, sessionYear: string, fairSlug = "") {
  return `${classId}:${sessionYear || new Date().getFullYear()}:${fairSlug}`;
}

/** Keep the configured class fee represented by one live due row per student. */
export async function syncClassFeeDues(classInfo: PortalClass, fairSlug = "", createdBy = "") {
  const amount = Math.max(0, Number(classInfo.fee_amount) || 0);
  const feeId = classFeeId(classInfo.id, classInfo.fee_session, fairSlug);
  const [students, dues] = await Promise.all([
    listUsers({ role: "student", class_level: classInfo.name, limit: 5000 }),
    listDues({ class_fee_id: feeId, limit: 5000 }),
  ]);
  const byUser = new Map(dues.map((due) => [due.user_id, due]));
  let created = 0;
  let updated = 0;

  // A zero fee stops new dues but does not erase or silently waive historical obligations.
  if (!amount) return { created, updated, fee_id: feeId };

  for (const student of students.filter((item) => Number(item.is_active) === 1)) {
    const current = byUser.get(student.id);
    if (current) {
      await updateDue(current.id, {
        amount,
        title: classInfo.fee_title || "শ্রেণি ফি",
        student_name: student.name,
        student_id: student.student_id,
        class_level: student.class_level,
        section: student.section,
      });
      await syncDuePayment(current.id);
      updated += 1;
    } else {
      try {
        await createDue({
          fair_slug: fairSlug,
          user_id: student.id,
          student_name: student.name,
          student_id: student.student_id,
          class_level: student.class_level,
          section: student.section,
          title: classInfo.fee_title || "শ্রেণি ফি",
          class_fee_id: feeId,
          amount,
          due_date: "",
          status: "due",
          note: `স্বয়ংক্রিয় শ্রেণি ফি · ${classInfo.fee_session || new Date().getFullYear()}`,
          created_by: createdBy,
        });
        created += 1;
      } catch (error) {
        if (!/unique|constraint/i.test(error instanceof Error ? error.message : String(error))) throw error;
        const raced = (await listDues({ class_fee_id: feeId, limit: 5000 })).find((item) => item.user_id === student.id);
        if (!raced) throw error;
        await updateDue(raced.id, { amount, title: classInfo.fee_title || "শ্রেণি ফি", student_name: student.name, student_id: student.student_id, class_level: student.class_level, section: student.section });
        await syncDuePayment(raced.id);
        updated += 1;
      }
    }
  }
  return { created, updated, fee_id: feeId };
}

export async function classFeeTotals(fairSlug?: string) {
  const [classes, studentGroups, allDues] = await Promise.all([
    listClasses(true),
    studentsByClass(),
    listDues({ fair_slug: fairSlug, limit: 5000 }),
  ]);
  const grouped = new Map(studentGroups.map((row) => [row.class_level, row.total]));
  const rows = classes.filter((item) => Number(item.fee_amount) > 0).map((item) => {
    const feeId = classFeeId(item.id, item.fee_session, fairSlug ?? "");
    const students = Number(grouped.get(item.name) ?? 0);
    const expected = students * Number(item.fee_amount);
    const collected = allDues.filter((due) => due.class_fee_id === feeId).reduce((sum, due) => sum + Number(due.paid_amount), 0);
    return {
      class_level: item.name,
      title: item.fee_title || "শ্রেণি ফি",
      session_year: item.fee_session || String(new Date().getFullYear()),
      fee_amount: Number(item.fee_amount),
      students,
      expected,
      collected,
      pending: Math.max(0, expected - collected),
    };
  });
  return {
    rows,
    expected: rows.reduce((sum, row) => sum + row.expected, 0),
    collected: rows.reduce((sum, row) => sum + row.collected, 0),
    pending: rows.reduce((sum, row) => sum + row.pending, 0),
  };
}

/* ------------------------------------------------------------------ *
 * Funds / dues / expenses
 * ------------------------------------------------------------------ */

export interface FundInput {
  fair_slug?: string;
  user_id?: string;
  payer_name: string;
  payer_role?: string;
  class_level?: string;
  section?: string;
  student_id?: string;
  phone?: string;
  due_id?: string;
  receipt_no?: string;
  amount: number;
  method?: string;
  trx_id?: string;
  purpose?: string;
  status?: string;
  note?: string;
  collected_by?: string;
}

export async function createFund(input: FundInput) {
  const id = randomUUID();
  const record: Record<string, string | number> = {
    id,
    fair_slug: input.fair_slug ?? "",
    user_id: input.user_id ?? "",
    payer_name: input.payer_name ?? "",
    payer_role: input.payer_role ?? "student",
    class_level: input.class_level ?? "",
    section: input.section ?? "",
    student_id: input.student_id ?? "",
    phone: input.phone ?? "",
    due_id: input.due_id ?? "",
    receipt_no: input.receipt_no || documentNumber("RCT"),
    amount: Number(input.amount) || 0,
    method: input.method ?? "নগদ",
    trx_id: input.trx_id ?? "",
    purpose: input.purpose ?? "বিজ্ঞান মেলা ফান্ড",
    status: input.status ?? "verified",
    note: input.note ?? "",
    collected_by: input.collected_by ?? "",
    verified_by: input.status === "verified" || !input.status ? input.collected_by ?? "" : "",
    verified_at: input.status === "verified" || !input.status ? nowIso() : "",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  const statement = insertStatement("funds", record);
  await run(statement.sql, statement.args as (string | number)[]);
  return id;
}

export async function getFundById(id: string) {
  const rows = await query<FundRow>(`SELECT * FROM funds WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function listFunds(filter: { fair_slug?: string; status?: string; class_level?: string; user_id?: string; limit?: number } = {}) {
  const clauses: string[] = [];
  const args: string[] = [];
  if (filter.fair_slug) {
    clauses.push("fair_slug = ?");
    args.push(filter.fair_slug);
  }
  if (filter.status) {
    clauses.push("status = ?");
    args.push(filter.status);
  }
  if (filter.class_level) {
    clauses.push("class_level = ?");
    args.push(filter.class_level);
  }
  if (filter.user_id) {
    clauses.push("user_id = ?");
    args.push(filter.user_id);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(2000, Math.floor(filter.limit ?? 400)));
  return query<FundRow>(`SELECT * FROM funds ${where} ORDER BY created_at DESC LIMIT ${limit}`, args);
}

export async function updateFund(id: string, values: Record<string, string | number>) {
  const allowed = ["status", "amount", "method", "trx_id", "purpose", "note", "verified_by", "verified_at", "payer_name", "class_level", "section", "student_id", "phone", "user_id", "due_id", "receipt_no"];
  const clean: Record<string, string | number> = {};
  for (const key of allowed) if (key in values && values[key] !== undefined) clean[key] = values[key];
  if (!Object.keys(clean).length) return;
  clean.updated_at = nowIso();
  const statement = updateStatement("funds", id, clean);
  await run(statement.sql, statement.args as (string | number)[]);
}

export async function deleteFund(id: string) {
  const result = await run(`DELETE FROM funds WHERE id = ?`, [id]);
  return Number(result.rowsAffected ?? 0) > 0;
}

export interface MoneyTotals {
  total: number;
  pending: number;
  verified: number;
  count: number;
  today: number;
}

export async function fundTotals(fairSlug?: string) {
  const args: string[] = [];
  let where = "";
  if (fairSlug) {
    where = "WHERE fair_slug = ?";
    args.push(fairSlug);
  }
  const rows = await query<{ status: string; kind: string; total: number; count: number }>(
    `SELECT status, 'total' as kind, COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM funds ${where} GROUP BY status`,
    args,
  );
  const today = await query<{ total: number }>(
    `SELECT COALESCE(SUM(amount),0) as total FROM funds ${where ? `${where} AND` : "WHERE"} substr(verified_at,1,10) = ? AND status = 'verified'`,
    [...args, nowIso().slice(0, 10)],
  );
  const totals: MoneyTotals = { total: 0, pending: 0, verified: 0, count: 0, today: Number(today[0]?.total ?? 0) };
  for (const row of rows) {
    const amount = Number(row.total ?? 0);
    const count = Number(row.count ?? 0);
    totals.count += count;
    if (row.status === "pending") totals.pending += amount;
    else if (row.status === "verified") totals.verified += amount;
    else totals.total += amount;
  }
  totals.total += totals.pending + totals.verified;
  return totals;
}

export async function fundTotalsByClass(fairSlug?: string) {
  const args: string[] = [];
  let where = "WHERE status = 'verified'";
  if (fairSlug) {
    where += " AND fair_slug = ?";
    args.push(fairSlug);
  }
  const rows = await query<{ class_level: string; section: string; total: number; students: number }>(
    `SELECT class_level, section, COALESCE(SUM(amount),0) as total, COUNT(DISTINCT student_id) as students
     FROM funds ${where} GROUP BY class_level, section ORDER BY class_level ASC, section ASC`,
    args,
  );
  return rows.map((row) => ({
    class_level: String(row.class_level || "শ্রেণি উল্লেখ নেই"),
    section: String(row.section || "—"),
    total: Number(row.total ?? 0),
    students: Number(row.students ?? 0),
  }));
}

export async function fundTotalsByMethod(fairSlug?: string) {
  const args: string[] = [];
  let where = "WHERE status = 'verified'";
  if (fairSlug) {
    where += " AND fair_slug = ?";
    args.push(fairSlug);
  }
  const rows = await query<{ method: string; total: number }>(
    `SELECT method, COALESCE(SUM(amount),0) as total FROM funds ${where} GROUP BY method ORDER BY total DESC`,
    args,
  );
  return rows.map((row) => ({ method: String(row.method || "নগদ"), total: Number(row.total ?? 0) }));
}

export async function expenseTotals(fairSlug?: string) {
  const args: string[] = [];
  let where = "";
  if (fairSlug) {
    where = "WHERE fair_slug = ?";
    args.push(fairSlug);
  }
  const rows = await query<{ total: number; count: number }>(`SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM expenses ${where}`, args);
  return { total: Number(rows[0]?.total ?? 0), count: Number(rows[0]?.count ?? 0) };
}

export async function expenseTotalsByCategory(fairSlug?: string) {
  const args: string[] = [];
  let where = "";
  if (fairSlug) {
    where = "WHERE fair_slug = ?";
    args.push(fairSlug);
  }
  const rows = await query<{ category: string; total: number }>(
    `SELECT category, COALESCE(SUM(amount),0) as total FROM expenses ${where} GROUP BY category ORDER BY total DESC`,
    args,
  );
  return rows.map((row) => ({ category: String(row.category || "সাধারণ"), total: Number(row.total ?? 0) }));
}

export async function getExpenseById(id: string) {
  const rows = await query<ExpenseRow>(`SELECT * FROM expenses WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function listExpenses(fairSlug?: string, limit = 400) {
  const args: string[] = [];
  let where = "";
  if (fairSlug) {
    where = "WHERE fair_slug = ?";
    args.push(fairSlug);
  }
  return query<ExpenseRow>(`SELECT * FROM expenses ${where} ORDER BY COALESCE(paid_at, created_at) DESC LIMIT ${Math.max(1, Math.min(2000, limit))}`, args);
}

export async function createExpense(values: Partial<ExpenseRow>) {
  const id = randomUUID();
  const memoNo = values.memo_no || documentNumber("EXP");
  const record: Record<string, string | number> = {
    id,
    fair_slug: values.fair_slug ?? "",
    title: values.title ?? "",
    category: values.category ?? "সাধারণ",
    amount: Number(values.amount) || 0,
    paid_to: values.paid_to ?? "",
    paid_at: values.paid_at ?? nowIso().slice(0, 10),
    method: values.method ?? "নগদ",
    voucher_no: values.voucher_no || memoNo,
    memo_no: memoNo,
    note: values.note ?? "",
    status: values.status ?? "approved",
    created_by: values.created_by ?? "",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  const statement = insertStatement("expenses", record);
  await run(statement.sql, statement.args as (string | number)[]);
  return id;
}

export async function updateExpense(id: string, values: Partial<ExpenseRow>) {
  const clean: Record<string, string | number> = {};
  for (const key of ["title", "category", "amount", "paid_to", "paid_at", "method", "voucher_no", "memo_no", "note", "status", "fair_slug"] as const) {
    if (key in values && values[key] !== undefined) clean[key] = values[key] as string | number;
  }
  if (!Object.keys(clean).length) return;
  clean.updated_at = nowIso();
  const statement = updateStatement("expenses", id, clean);
  await run(statement.sql, statement.args as (string | number)[]);
}

export async function deleteExpense(id: string) {
  const result = await run(`DELETE FROM expenses WHERE id = ?`, [id]);
  return Number(result.rowsAffected ?? 0) > 0;
}

export async function listDues(filter: { fair_slug?: string; class_level?: string; status?: string; user_id?: string; student_id?: string; class_fee_id?: string; limit?: number } = {}) {
  const clauses: string[] = [];
  const args: string[] = [];
  if (filter.fair_slug) {
    clauses.push("fair_slug = ?");
    args.push(filter.fair_slug);
  }
  if (filter.class_level) {
    clauses.push("class_level = ?");
    args.push(filter.class_level);
  }
  if (filter.status) {
    clauses.push("status = ?");
    args.push(filter.status);
  }
  if (filter.user_id) {
    clauses.push("user_id = ?");
    args.push(filter.user_id);
  }
  if (filter.student_id) {
    clauses.push("upper(student_id) = upper(?)");
    args.push(filter.student_id);
  }
  if (filter.class_fee_id) {
    clauses.push("class_fee_id = ?");
    args.push(filter.class_fee_id);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(3000, Math.floor(filter.limit ?? 500)));
  return query<DueRow>(`SELECT dues.*, COALESCE((SELECT SUM(funds.amount) FROM funds WHERE funds.due_id = dues.id AND funds.status = 'pending'),0) as pending_amount FROM dues ${where} ORDER BY due_date DESC, created_at DESC LIMIT ${limit}`, args);
}

export async function createDue(values: Partial<DueRow>) {
  const id = randomUUID();
  const record: Record<string, string | number> = {
    id,
    fair_slug: values.fair_slug ?? "",
    user_id: values.user_id ?? "",
    student_name: values.student_name ?? "",
    student_id: values.student_id ?? "",
    class_level: values.class_level ?? "",
    section: values.section ?? "",
    title: values.title ?? "বিজ্ঞান মেলা ফি",
    class_fee_id: values.class_fee_id ?? "",
    amount: Number(values.amount) || 0,
    paid_amount: Number(values.paid_amount) || 0,
    due_date: values.due_date ?? nowIso().slice(0, 10),
    status: values.status ?? "due",
    note: values.note ?? "",
    created_by: values.created_by ?? "",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  const statement = insertStatement("dues", record);
  await run(statement.sql, statement.args as (string | number)[]);
  return id;
}

export async function updateDue(id: string, values: Partial<DueRow>) {
  const clean: Record<string, string | number> = {};
  for (const key of ["student_name", "student_id", "class_level", "section", "title", "class_fee_id", "amount", "paid_amount", "due_date", "status", "note", "fair_slug"] as const) {
    if (key in values && values[key] !== undefined) clean[key] = values[key] as string | number;
  }
  if (!Object.keys(clean).length) return;
  clean.updated_at = nowIso();
  const statement = updateStatement("dues", id, clean);
  await run(statement.sql, statement.args as (string | number)[]);
}

export async function getDueById(id: string) {
  const rows = await query<DueRow>(`SELECT * FROM dues WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

/** Verified receipts count as paid; pending receipts reserve balance until reviewed. */
export async function dueReceiptTotals(dueId: string, excludeFundId = "") {
  const rows = await query<{ verified: number; pending: number; count: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END),0) as verified,
       COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END),0) as pending,
       COUNT(*) as count
     FROM funds WHERE due_id = ?${excludeFundId ? " AND id <> ?" : ""}`,
    excludeFundId ? [dueId, excludeFundId] : [dueId],
  );
  return { verified: Number(rows[0]?.verified ?? 0), pending: Number(rows[0]?.pending ?? 0), count: Number(rows[0]?.count ?? 0) };
}

/** Recompute a due's paid balance exclusively from verified linked receipts. */
export async function syncDuePayment(dueId: string) {
  const due = await getDueById(dueId);
  if (!due) return false;
  const rows = await query<{ total: number }>(
    `SELECT COALESCE(SUM(amount),0) as total FROM funds WHERE due_id = ? AND status = 'verified'`,
    [dueId],
  );
  const paid = Number(rows[0]?.total ?? 0);
  const amount = Number(due.amount ?? 0);
  await updateDue(dueId, { paid_amount: paid, status: paid >= amount ? "paid" : paid > 0 ? "partial" : "due" });
  return true;
}

export async function deleteDue(id: string) {
  const result = await run(`DELETE FROM dues WHERE id = ?`, [id]);
  return Number(result.rowsAffected ?? 0) > 0;
}

export async function dueTotals(fairSlug?: string) {
  const args: string[] = [];
  let where = "";
  if (fairSlug) {
    where = "WHERE fair_slug = ?";
    args.push(fairSlug);
  }
  const rows = await query<{ status: string; amount: number; paid: number; count: number }>(
    `SELECT status, COALESCE(SUM(amount),0) as amount, COALESCE(SUM(paid_amount),0) as paid, COUNT(*) as count FROM dues ${where} GROUP BY status`,
    args,
  );
  const totals = { amount: 0, paid: 0, outstanding: 0, count: 0, paidCount: 0, dueCount: 0 };
  for (const row of rows) {
    const amount = Number(row.amount ?? 0);
    const paid = Number(row.paid ?? 0);
    totals.amount += amount;
    totals.paid += paid;
    totals.count += Number(row.count ?? 0);
    if (row.status === "paid") totals.paidCount += Number(row.count ?? 0);
    else if (row.status === "due" || row.status === "partial") totals.dueCount += Number(row.count ?? 0);
  }
  totals.outstanding = Math.max(0, totals.amount - totals.paid);
  return totals;
}

/* ------------------------------------------------------------------ *
 * QR passes & scans
 * ------------------------------------------------------------------ */

export async function listPasses(filter: { fair_slug?: string; status?: string; user_id?: string; parent_pass_id?: string; limit?: number } = {}) {
  const clauses: string[] = [];
  const args: string[] = [];
  if (filter.fair_slug) {
    clauses.push("fair_slug = ?");
    args.push(filter.fair_slug);
  }
  if (filter.status) {
    clauses.push("status = ?");
    args.push(filter.status);
  }
  if (filter.user_id) {
    clauses.push("user_id = ?");
    args.push(filter.user_id);
  }
  if (filter.parent_pass_id) {
    clauses.push("parent_pass_id = ?");
    args.push(filter.parent_pass_id);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(5000, Math.floor(filter.limit ?? 500)));
  return query<PassRow>(`SELECT * FROM passes ${where} ORDER BY created_at DESC LIMIT ${limit}`, args);
}

export async function getPassById(id: string) {
  const rows = await query<PassRow>(`SELECT * FROM passes WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function getPassByToken(token: string) {
  const rows = await query<PassRow>(`SELECT * FROM passes WHERE token = ? LIMIT 1`, [token]);
  return rows[0] ?? null;
}

export async function getGuestPass(parentPassId: string, guestIndex: number) {
  const rows = await query<PassRow>(`SELECT * FROM passes WHERE parent_pass_id = ? AND guest_index = ? LIMIT 1`, [parentPassId, guestIndex]);
  return rows[0] ?? null;
}

export async function findPassForUser(userId: string, fairSlug: string) {
  const rows = await query<PassRow>(`SELECT * FROM passes WHERE user_id = ? AND fair_slug = ? ORDER BY created_at DESC LIMIT 1`, [userId, fairSlug]);
  return rows[0] ?? null;
}

export async function createPass(values: Partial<PassRow> & { token: string }) {
  const id = randomUUID();
  const record: Record<string, string | number> = {
    id,
    fair_slug: values.fair_slug ?? "",
    user_id: values.user_id ?? "",
    holder_name: values.holder_name ?? "",
    holder_role: values.holder_role ?? "student",
    student_id: values.student_id ?? "",
    class_level: values.class_level ?? "",
    section: values.section ?? "",
    email: values.email ?? "",
    phone: values.phone ?? "",
    token: values.token,
    status: "active",
    scan_count: 0,
    last_scan_at: "",
    parent_pass_id: values.parent_pass_id ?? "",
    guest_index: Number(values.guest_index ?? 0),
    guest_limit: Math.max(0, Math.min(4, Number(values.guest_limit ?? 0))),
    expires_at: values.expires_at ?? "",
    note: values.note ?? "",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  const statement = insertStatement("passes", record);
  await run(statement.sql, statement.args as (string | number)[]);
  return (await getPassById(id))!;
}

export async function updatePass(id: string, values: Partial<PassRow>) {
  const clean: Record<string, string | number> = {};
  for (const key of ["status", "note", "expires_at", "scan_count", "last_scan_at", "holder_name", "class_level", "section", "phone", "guest_limit", "parent_pass_id", "guest_index"] as const) {
    if (key in values && values[key] !== undefined) clean[key] = values[key] as string | number;
  }
  if (!Object.keys(clean).length) return;
  clean.updated_at = nowIso();
  const statement = updateStatement("passes", id, clean);
  await run(statement.sql, statement.args as (string | number)[]);
}

export async function deletePass(id: string) {
  const result = await run(`DELETE FROM passes WHERE id = ?`, [id]);
  return Number(result.rowsAffected ?? 0) > 0;
}

export async function recordScan(entry: { pass_id?: string; token: string; fair_slug?: string; scanned_by?: string; scanned_by_name?: string; result: string; note?: string }) {
  await run(
    `INSERT INTO scans (id, pass_id, token, fair_slug, scanned_by, scanned_by_name, result, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      entry.pass_id ?? "",
      entry.token,
      entry.fair_slug ?? "",
      entry.scanned_by ?? "",
      entry.scanned_by_name ?? "",
      entry.result,
      entry.note ?? "",
      nowIso(),
    ],
  );
}

export async function listScans(filter: { fair_slug?: string; limit?: number } = {}) {
  const args: string[] = [];
  let where = "";
  if (filter.fair_slug) {
    where = "WHERE fair_slug = ?";
    args.push(filter.fair_slug);
  }
  return query<ScanRow>(`SELECT * FROM scans ${where} ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(500, filter.limit ?? 60))}`, args);
}

export async function scanStats(fairSlug?: string) {
  const args: string[] = [];
  let where = "";
  if (fairSlug) {
    where = "WHERE fair_slug = ?";
    args.push(fairSlug);
  }
  const rows = await query<{ result: string; total: number }>(`SELECT result, COUNT(*) as total FROM scans ${where} GROUP BY result`, args);
  const stats: Record<string, number> = { ok: 0, duplicate: 0, invalid: 0, expired: 0, revoked: 0 };
  for (const row of rows) stats[String(row.result)] = Number(row.total ?? 0);
  stats.total = Object.values(stats).reduce((sum, value) => sum + value, 0);
  return stats;
}

export async function passStats(fairSlug?: string) {
  const args: string[] = [];
  let where = "";
  if (fairSlug) {
    where = "WHERE fair_slug = ?";
    args.push(fairSlug);
  }
  const rows = await query<{ status: string; total: number }>(`SELECT status, COUNT(*) as total FROM passes ${where} GROUP BY status`, args);
  const out: Record<string, number> = { active: 0, used: 0, revoked: 0 };
  for (const row of rows) out[String(row.status)] = Number(row.total ?? 0);
  out.total = Object.entries(out).filter(([key]) => key !== "total").reduce((sum, [, value]) => sum + value, 0);
  return out;
}

/* ------------------------------------------------------------------ *
 * Fair ticker — short notices that scroll on the fair site, tagged with the
 * category/name/class/section/email of whoever they belong to.
 * ------------------------------------------------------------------ */

export interface TickerRow {
  id: string;
  fair_slug: string;
  category: string;
  name: string;
  class_level: string;
  section: string;
  email: string;
  phone: string;
  message: string;
  kind: string;
  audience: string;
  target_role: string;
  payment_segment: string;
  starts_at: string;
  ends_at: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface SmtpSettingsRow {
  id: string;
  host: string;
  port: number;
  secure: number;
  username: string;
  password_encrypted: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  enabled: number;
  updated_at: string;
}

export async function listTickers(filter: { fair_slug?: string; activeOnly?: boolean; publicOnly?: boolean; limit?: number } = {}) {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.fair_slug) {
    where.push("fair_slug = ?");
    args.push(filter.fair_slug);
  }
  if (filter.activeOnly) {
    const now = nowIso();
    where.push("is_active = 1", "(starts_at = '' OR starts_at <= ?)", "(ends_at = '' OR ends_at > ?)");
    args.push(now, now);
  }
  if (filter.publicOnly) where.push("audience = 'public'", "target_role = ''", "payment_segment = ''");
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return query<TickerRow>(`SELECT * FROM tickers ${clause} ORDER BY sort_order ASC, created_at DESC LIMIT ?`, [...args, filter.limit ?? 200]);
}

export async function createTicker(values: Partial<TickerRow>) {
  const id = randomUUID();
  const stamp = nowIso();
  const insert = insertStatement("tickers", {
      id,
      fair_slug: values.fair_slug ?? "",
      category: values.category ?? "",
      name: values.name ?? "",
      class_level: values.class_level ?? "",
      section: values.section ?? "",
      email: values.email ?? "",
      phone: values.phone ?? "",
      message: values.message ?? "",
      kind: values.kind ?? "notice",
      audience: values.audience ?? "all",
      target_role: values.target_role ?? "",
      payment_segment: values.payment_segment ?? "",
      starts_at: values.starts_at ?? "",
      ends_at: values.ends_at ?? "",
      sort_order: Number(values.sort_order ?? 0),
      is_active: Number(values.is_active ?? 1),
      created_at: stamp,
      updated_at: stamp,
    });
  await run(insert.sql, insert.args);
  return id;
}

export async function updateTicker(id: string, values: Partial<TickerRow>) {
  const clean: Record<string, string | number> = {};
  for (const key of ["fair_slug", "category", "name", "class_level", "section", "email", "phone", "message", "kind", "audience", "target_role", "payment_segment", "starts_at", "ends_at"] as const) {
    if (values[key] !== undefined) clean[key] = String(values[key] ?? "");
  }
  if (values.sort_order !== undefined) clean.sort_order = Number(values.sort_order);
  if (values.is_active !== undefined) clean.is_active = Number(values.is_active);
  if (!Object.keys(clean).length) return;
  clean.updated_at = nowIso();
  const update = updateStatement("tickers", id, clean);
  await run(update.sql, update.args);
}

export async function deleteTicker(id: string) {
  await run("DELETE FROM tickers WHERE id = ?", [id]);
}

export async function getSmtpSettings() {
  const rows = await query<SmtpSettingsRow>(`SELECT * FROM smtp_settings WHERE id = 'primary' LIMIT 1`);
  return rows[0] ?? null;
}

export async function saveSmtpSettings(values: Partial<SmtpSettingsRow>) {
  const current = await getSmtpSettings();
  const record = {
    id: "primary",
    host: values.host ?? current?.host ?? "",
    port: Math.max(1, Math.min(65535, Math.floor(Number(values.port ?? current?.port ?? 587)))),
    secure: Number(values.secure ?? current?.secure ?? 0) ? 1 : 0,
    username: values.username ?? current?.username ?? "",
    password_encrypted: values.password_encrypted ?? current?.password_encrypted ?? "",
    from_name: values.from_name ?? current?.from_name ?? "OKGS",
    from_email: values.from_email ?? current?.from_email ?? "",
    reply_to: values.reply_to ?? current?.reply_to ?? "",
    enabled: Number(values.enabled ?? current?.enabled ?? 0) ? 1 : 0,
    updated_at: nowIso(),
  };
  await run(
    `INSERT INTO smtp_settings (id,host,port,secure,username,password_encrypted,from_name,from_email,reply_to,enabled,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET host=excluded.host, port=excluded.port, secure=excluded.secure,
       username=excluded.username, password_encrypted=excluded.password_encrypted, from_name=excluded.from_name,
       from_email=excluded.from_email, reply_to=excluded.reply_to, enabled=excluded.enabled, updated_at=excluded.updated_at`,
    [record.id, record.host, record.port, record.secure, record.username, record.password_encrypted, record.from_name, record.from_email, record.reply_to, record.enabled, record.updated_at],
  );
  return record;
}

/* ------------------------------------------------------------------ *
 * Seeding
 * ------------------------------------------------------------------ */

const seedClasses = [
  { name: "প্লে", level: 0, sections: "ক" },
  { name: "নার্সারি", level: 1, sections: "ক, খ" },
  { name: "প্রথম শ্রেণি", level: 2, sections: "ক, খ" },
  { name: "দ্বিতীয় শ্রেণি", level: 3, sections: "ক, খ" },
  { name: "তৃতীয় শ্রেণি", level: 4, sections: "ক, খ" },
  { name: "চতুর্থ শ্রেণি", level: 5, sections: "ক, খ" },
  { name: "পঞ্চম শ্রেণি", level: 6, sections: "ক, খ" },
  { name: "ষষ্ঠ শ্রেণি", level: 7, sections: "ক, খ" },
  { name: "সপ্তম শ্রেণি", level: 8, sections: "ক, খ" },
  { name: "অষ্টম শ্রেণি", level: 9, sections: "ক, খ" },
  { name: "নবম শ্রেণি", level: 10, sections: "ক, খ" },
  { name: "দশম শ্রেণি", level: 11, sections: "ক, খ" },
];

async function seedPortal() {
  const classCount = await query<{ total: number }>(`SELECT COUNT(*) as total FROM classes`);
  if (Number(classCount[0]?.total ?? 0) === 0) {
    let order = 1;
    for (const item of seedClasses) {
      await createClass({ ...item, sort_order: order });
      order += 1;
    }
  }

  // One club admin per club, so every club sub-site (/clubs/<slug>/admin, or the
  // club's own subdomain) can be managed without touching the fair console.
  const clubAdmins = await query<{ total: number }>(`SELECT COUNT(*) as total FROM users WHERE role = 'club'`);
  if (Number(clubAdmins[0]?.total ?? 0) === 0) {
    const { hashPassword } = await import("@/lib/portal-auth");
    const { DEFAULT_CLUB_SLUGS } = await import("@/lib/club-slugs");
    const password = process.env.CLUB_ADMIN_PASSWORD || "okgs1234";
    for (const slug of DEFAULT_CLUB_SLUGS) {
      const { hash, salt } = hashPassword(password);
      await createUser({
        role: "club",
        name: `${slug.toUpperCase()} ক্লাব অ্যাডমিন`,
        email: `${slug}@okgs.info`,
        club_slug: slug,
        designation: "ক্লাব অ্যাডমিন",
        password_hash: hash,
        password_salt: salt,
        is_active: 1,
      });
    }
  }

  // One administrator, so /sf/login works the moment the site is deployed.
  // The same credentials as the studio (ADMIN_EMAIL / ADMIN_PASSWORD) — and the
  // primary administrator is a *SuperAdmin*: only that role may edit site
  // settings or flip the emergency maintenance switch.
  const superadmins = await query<{ total: number }>(`SELECT COUNT(*) as total FROM users WHERE role = 'superadmin'`);
  if (Number(superadmins[0]?.total ?? 0) === 0) {
    const { hashPassword } = await import("@/lib/portal-auth");
    const email = normalizeEmail(process.env.ADMIN_EMAIL || "admin@okgs.info");
    const password = process.env.ADMIN_PASSWORD || "change-this-password";

    // Upgrade the oldest admin in place (so an existing installation keeps its
    // history and password) instead of creating a second account.
    const existingAdmins = await query<PortalUser>(`SELECT * FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 5`);
    const byEnvEmail = existingAdmins.find((user) => normalizeEmail(user.email) === email);
    const target = byEnvEmail ?? existingAdmins[0];
    if (target) {
      await updateUser(target.id, { role: "superadmin" });
    } else {
      const { hash, salt } = hashPassword(password);
      await createUser({
        role: "superadmin",
        name: "Super Admin",
        name_en: "Super Admin",
        email,
        designation: "System Administrator",
        password_hash: hash,
        password_salt: salt,
        is_active: 1,
      });
    }
  }
}
