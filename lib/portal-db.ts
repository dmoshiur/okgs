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

export { roleLabels, allRoles, staffRoles, isStaffRole, isAdminRole } from "@/lib/roles";
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
  amount: number;
  paid_amount: number;
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
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS tickers_fair_idx ON tickers(fair_slug, sort_order)`,
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
];

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

export async function listUsers(filter: { role?: string; class_level?: string; section?: string; search?: string; limit?: number } = {}) {
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
    email: (values.email ?? "").trim(),
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

export async function createClass(values: { name: string; level?: number; sections?: string; note?: string; sort_order?: number; is_active?: number }) {
  const id = randomUUID();
  const record = {
    id,
    name: values.name,
    level: values.level ?? 0,
    sections: values.sections ?? "",
    note: values.note ?? "",
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
  for (const key of ["name", "level", "sections", "note", "sort_order", "is_active"] as const) {
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
    amount: Number(input.amount) || 0,
    method: input.method ?? "নগদ",
    trx_id: input.trx_id ?? "",
    purpose: input.purpose ?? "বিজ্ঞান মেলা ফান্ড",
    status: input.status ?? "verified",
    note: input.note ?? "",
    collected_by: input.collected_by ?? "",
    verified_by: input.status === "pending" ? "" : input.collected_by ?? "",
    verified_at: input.status === "pending" ? "" : nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  const statement = insertStatement("funds", record);
  await run(statement.sql, statement.args as (string | number)[]);
  return id;
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
  const allowed = ["status", "amount", "method", "trx_id", "purpose", "note", "verified_by", "verified_at", "payer_name", "class_level", "section", "student_id", "phone"];
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
  const record: Record<string, string | number> = {
    id,
    fair_slug: values.fair_slug ?? "",
    title: values.title ?? "",
    category: values.category ?? "সাধারণ",
    amount: Number(values.amount) || 0,
    paid_to: values.paid_to ?? "",
    paid_at: values.paid_at ?? nowIso().slice(0, 10),
    method: values.method ?? "নগদ",
    voucher_no: values.voucher_no ?? "",
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
  for (const key of ["title", "category", "amount", "paid_to", "paid_at", "method", "voucher_no", "note", "status", "fair_slug"] as const) {
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

export async function listDues(filter: { fair_slug?: string; class_level?: string; status?: string; user_id?: string; student_id?: string; limit?: number } = {}) {
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
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(3000, Math.floor(filter.limit ?? 500)));
  return query<DueRow>(`SELECT * FROM dues ${where} ORDER BY due_date DESC, created_at DESC LIMIT ${limit}`, args);
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
  for (const key of ["student_name", "student_id", "class_level", "section", "title", "amount", "paid_amount", "due_date", "status", "note", "fair_slug"] as const) {
    if (key in values && values[key] !== undefined) clean[key] = values[key] as string | number;
  }
  if (!Object.keys(clean).length) return;
  clean.updated_at = nowIso();
  const statement = updateStatement("dues", id, clean);
  await run(statement.sql, statement.args as (string | number)[]);
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

export async function listPasses(filter: { fair_slug?: string; status?: string; user_id?: string; limit?: number } = {}) {
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
  for (const key of ["status", "note", "expires_at", "scan_count", "last_scan_at", "holder_name", "class_level", "section", "phone"] as const) {
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
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export async function listTickers(filter: { fair_slug?: string; activeOnly?: boolean; limit?: number } = {}) {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.fair_slug) {
    where.push("fair_slug = ?");
    args.push(filter.fair_slug);
  }
  if (filter.activeOnly) where.push("is_active = 1");
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
  for (const key of ["fair_slug", "category", "name", "class_level", "section", "email", "phone", "message", "kind"] as const) {
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
  // The same credentials as the studio (ADMIN_EMAIL / ADMIN_PASSWORD).
  const admins = await query<{ total: number }>(`SELECT COUNT(*) as total FROM users WHERE role = 'admin'`);
  if (Number(admins[0]?.total ?? 0) === 0) {
    const email = (process.env.ADMIN_EMAIL || "admin@okgs.info").toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "change-this-password";
    const { hashPassword } = await import("@/lib/portal-auth");
    const { hash, salt } = hashPassword(password);
    await createUser({
      role: "admin",
      name: "প্রধান অ্যাডমিন",
      email,
      designation: "সিস্টেম অ্যাডমিন",
      password_hash: hash,
      password_salt: salt,
      is_active: 1,
    });
  }
}
