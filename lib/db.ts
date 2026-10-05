import { createClient, type Client, type Row, type InStatement } from "@libsql/client";
import { randomUUID } from "node:crypto";
import {
  asciiSlug,
  coerceFieldValue,
  columnSql,
  defaultValueFor,
  fieldDef,
  fieldsFor,
  normalizeRowFlags,
  resourceSchema,
  slugify,
} from "@/lib/content-config";
import { seeds, type SeedPlan } from "@/lib/seed-content";
import type {
  Club,
  ClubAchievement,
  ClubEvent,
  ClubGalleryItem,
  ClubMember,
  ClubPost,
  PublicContent,
  ResourceName,
} from "@/lib/types";

const localDatabaseUrl = "file:local.db";

const globalForDb = globalThis as unknown as {
  okgsDb?: Client;
  okgsDbReady?: Promise<void>;
};

export const db =
  globalForDb.okgsDb ??
  createClient({
    url: process.env.TURSO_DATABASE_URL || process.env.TURSO_URL || localDatabaseUrl,
    ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.okgsDb = db;
}

const now = () => new Date().toISOString();

/* ---------------------------------------------------------------- *
 * Schema — generated from lib/content-config.ts so a new field only
 * ever needs to be declared once.
 * ---------------------------------------------------------------- */

export const resourceTables: Record<ResourceName, string> = {
  slides: "slides",
  notices: "notices",
  banners: "banners",
  news: "news",
  updates: "updates",
  clubs: "clubs",
  club_events: "club_events",
  club_posts: "club_posts",
  club_gallery: "club_gallery",
  club_members: "club_members",
  club_achievements: "club_achievements",
  teachers: "teachers",
  facilities: "facilities",
  gallery: "site_gallery",
  stats: "stats",
  fairs: "fairs",
  fair_categories: "fair_categories",
  fair_schedule: "fair_schedule",
  fair_collections: "fair_collections",
  themes: "themes",
  settings: "settings",
};

export const resourceOrder: ResourceName[] = Object.keys(resourceTables) as ResourceName[];

const orderBy: Record<ResourceName, string> = {
  slides: "sort_order ASC, created_at DESC",
  notices: "published_at DESC",
  banners: "sort_order ASC, created_at DESC",
  news: "published_at DESC",
  updates: "date DESC",
  clubs: "sort_order ASC, created_at DESC",
  club_events: "event_date DESC, sort_order ASC",
  club_posts: "published_at DESC",
  club_gallery: "sort_order ASC, created_at DESC",
  club_members: "sort_order ASC, name ASC",
  club_achievements: "achieved_on DESC, sort_order ASC",
  teachers: "sort_order ASC, name ASC",
  facilities: "sort_order ASC",
  gallery: "sort_order ASC, created_at DESC",
  stats: "sort_order ASC",
  fairs: "sort_order ASC, starts_on DESC",
  fair_categories: "sort_order ASC, name ASC",
  fair_schedule: "starts_at ASC, sort_order ASC",
  fair_collections: "sort_order ASC, created_at DESC",
  themes: "name ASC",
  settings: "label ASC",
};

/** Extra SQL constraints that cannot be expressed by field type alone. */
const uniqueColumns: Partial<Record<ResourceName, string[]>> = {
  settings: ["key"],
};

function columnsFor(resource: ResourceName) {
  return fieldsFor(resource).map((field) => ({ name: field.name, sql: columnSql(field) }));
}

function createTableSql(resource: ResourceName) {
  const parts = ["id TEXT PRIMARY KEY"];
  for (const column of columnsFor(resource)) parts.push(`${wrap(column.name)} ${column.sql}`);
  parts.push("created_at TEXT NOT NULL DEFAULT ''", "updated_at TEXT NOT NULL DEFAULT ''");
  // Table constraints have to come after every column definition in libSQL's parser.
  for (const column of uniqueColumns[resource] ?? []) parts.push(`UNIQUE (${wrap(column)})`);
  return `CREATE TABLE IF NOT EXISTS ${wrap(resourceTables[resource])} (\n  ${parts.join(",\n  ")}\n)`;
}

/** Quote every identifier we generate (`key`, `value` … are SQL keywords). */
function wrap(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe column name: ${name}`);
  }
  return `"${name}"`;
}

export function schemaStatements() {
  return resourceOrder.map(createTableSql);
}

/* ---------------------------------------------------------------- *
 * Migrations — add columns that were introduced after a table existed.
 * ---------------------------------------------------------------- */

async function existingColumns(table: string) {
  const result = await db.execute(`PRAGMA table_info(${wrap(table)})`);
  return new Set(result.rows.map((row) => String(row.name)));
}

async function migrateTable(resource: ResourceName) {
  const table = resourceTables[resource];
  const present = await existingColumns(table);
  for (const column of columnsFor(resource)) {
    if (!present.has(column.name)) {
      await db.execute(`ALTER TABLE ${wrap(table)} ADD COLUMN ${wrap(column.name)} ${column.sql}`);
    }
  }
}

/* ---------------------------------------------------------------- *
 * Seeds — a starter set of club data so the site is never empty.
 * ---------------------------------------------------------------- */


async function seedTable(resource: ResourceName, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const table = resourceTables[resource];
  const countResult = await db.execute(`SELECT COUNT(*) as count FROM ${wrap(table)}`);
  if (Number(countResult.rows[0]?.count ?? 0) > 0) return;

  // `id` is not a schema field, so it has to be carried explicitly — otherwise
  // seeded rows end up with a NULL primary key and cannot be edited from the studio.
  const columns = ["id", ...columnsFor(resource).map((column) => column.name), "created_at", "updated_at"];
  const createdAt = now();
  const statements: InStatement[] = rows.map((row, index) => {
    const values = columns.map((column) => {
      if (column === "created_at" || column === "updated_at") return createdAt;
      if (column === "id") return String(row.id ?? `${resource}-${index}`);
      const field = fieldsFor(resource).find((item) => item.name === column);
      const raw = row[column] ?? (field ? coerceFieldValue(field, defaultValueFor(field)) : "");
      return raw as string | number;
    });
    return {
      sql: `INSERT OR IGNORE INTO ${wrap(table)} (${columns.map(wrap).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      args: values,
    };
  });
  await db.batch(statements, "write");
}

/* ---------------------------------------------------------------- *
 * Legacy club migration
 *
 * Earlier versions of the site shipped six invented clubs under the slugs
 * `science`/`language`/`computer`/`sports`/`culture`/`junior`. The school really
 * has five clubs, whose slugs are the club abbreviations (ALSSM, AYPG, ALPCG,
 * AYGSM, ARTDS) because the same slug is the folder of the club's own website.
 * This migration re-points every child row instead of leaving duplicates behind.
 * ---------------------------------------------------------------- */

const legacyClubSlugs: Record<string, string> = {
  science: "alssm",
  language: "aypg",
  computer: "alpcg",
  sports: "aygsm",
  culture: "artds",
};

const clubChildTables: ResourceName[] = ["club_events", "club_posts", "club_gallery", "club_members", "club_achievements"];

async function migrateLegacyClubs() {
  const legacyNames: Record<string, { name: string; name_en: string; short_code: string; subdomain: string; club_folder: string }> = {
    alssm: { name: "ম্যাথ এন্ড সাইন্স ক্লাব", name_en: "Association Of Little Scientists And Math Maniacs", short_code: "ALSSM", subdomain: "alssm.okgs.info", club_folder: "clubs/alssm" },
    aypg: { name: "ল্যাংগুয়েজ ক্লাব", name_en: "Association Of Young Philologists And Grammarians", short_code: "AYPG", subdomain: "aypg.okgs.info", club_folder: "clubs/aypg" },
    alpcg: { name: "কম্পিউটার ক্লাব", name_en: "Association Of Little Programmers And Computer Geeks", short_code: "ALPCG", subdomain: "alpcg.okgs.info", club_folder: "clubs/alpcg" },
    aygsm: { name: "স্পোর্টিং ক্লাব", name_en: "Association Of Young Gymnastics And Sports Maniac", short_code: "AYGSM", subdomain: "aygsm.okgs.info", club_folder: "clubs/aygsm" },
    artds: { name: "ART Debating Society", name_en: "ART Debating Society", short_code: "ARTDS", subdomain: "artds.okgs.info", club_folder: "clubs/artds" },
  };

  for (const [oldSlug, newSlug] of Object.entries(legacyClubSlugs)) {
    const oldRow = await db.execute({ sql: `SELECT id FROM clubs WHERE slug = ? LIMIT 1`, args: [oldSlug] });
    if (!oldRow.rows.length) continue;
    const newRow = await db.execute({ sql: `SELECT id FROM clubs WHERE slug = ? LIMIT 1`, args: [newSlug] });
    if (newRow.rows.length) {
      // The real club already exists — drop the legacy duplicate and its children.
      for (const resource of clubChildTables) {
        await db.execute({ sql: `DELETE FROM ${wrap(resourceTables[resource])} WHERE club_slug = ?`, args: [oldSlug] });
      }
      await db.execute({ sql: `DELETE FROM clubs WHERE slug = ?`, args: [oldSlug] });
      continue;
    }
    const meta = legacyNames[newSlug];
    await db.execute({
      sql: `UPDATE clubs SET slug = ?, name = ?, name_en = ?, short_code = ?, subdomain = ?, club_folder = ?, updated_at = ? WHERE id = ?`,
      args: [newSlug, meta.name, meta.name_en, meta.short_code, meta.subdomain, meta.club_folder, now(), String(oldRow.rows[0].id)],
    });
    for (const resource of clubChildTables) {
      await db.execute({
        sql: `UPDATE ${wrap(resourceTables[resource])} SET club_slug = ?, updated_at = ? WHERE club_slug = ?`,
        args: [newSlug, now(), oldSlug],
      });
    }
    for (const resource of ["notices", "news", "gallery"] as ResourceName[]) {
      await db.execute({
        sql: `UPDATE ${wrap(resourceTables[resource])} SET club_slug = ?, updated_at = ? WHERE club_slug = ?`,
        args: [newSlug, now(), oldSlug],
      });
    }
  }

  // The sixth club never existed at the school.
  const junior = await db.execute({ sql: `SELECT id FROM clubs WHERE slug = ? LIMIT 1`, args: ["junior"] });
  if (junior.rows.length) {
    for (const resource of clubChildTables) {
      await db.execute({ sql: `DELETE FROM ${wrap(resourceTables[resource])} WHERE club_slug = ?`, args: ["junior"] });
    }
    await db.execute({ sql: `DELETE FROM clubs WHERE slug = ?`, args: ["junior"] });
  }
}

/**
 * Every club has its own website (the subdomain served by middleware.ts) and a
 * Facebook page. Older rows predate those fields, so fill them in when empty —
 * a real value set by the admin is never overwritten.
 */
const clubLinks: Record<string, { domain: string; facebook: string }> = {
  alssm: { domain: "https://alssm.okgs.info", facebook: "https://www.facebook.com/omarkgschool" },
  aypg: { domain: "https://aypg.okgs.info", facebook: "https://www.facebook.com/omarkgschool" },
  alpcg: { domain: "https://alpcg.okgs.info", facebook: "https://www.facebook.com/omarkgschool" },
  aygsm: { domain: "https://aygsm.okgs.info", facebook: "https://www.facebook.com/omarkgschool" },
  artds: { domain: "https://artds.okgs.info", facebook: "https://www.facebook.com/omarkgschool" },
};

async function backfillClubLinks() {
  for (const [slug, links] of Object.entries(clubLinks)) {
    const row = await db.execute({ sql: `SELECT id, domain, facebook_url FROM clubs WHERE slug = ? LIMIT 1`, args: [slug] });
    if (!row.rows.length) continue;
    const current = row.rows[0] as unknown as { id: string; domain: string; facebook_url: string };
    const domain = current.domain || links.domain;
    const facebook = current.facebook_url || links.facebook;
    if (domain === current.domain && facebook === current.facebook_url) continue;
    await db.execute({
      sql: `UPDATE clubs SET domain = ?, facebook_url = ?, updated_at = ? WHERE id = ?`,
      args: [domain, facebook, now(), String(current.id)],
    });
    console.log(`[okgs] club links filled for ${slug}`);
  }
}

/**
 * Updates default themes to the Tranzo BD & ThinkTank formal navy + gold design system
 * and colorful linear gradient for science fair.
 */
async function refreshDefaultTheme() {
  const legacyAccents = ["#15803d", "#008744"];
  const row = await db.execute({
    sql: `SELECT id, accent, accent_2, radius, ink FROM themes WHERE key = ? LIMIT 1`,
    args: ["campus-green"],
  });
  if (row.rows.length) {
    const current = row.rows[0] as unknown as { id: string; accent: string; accent_2: string; radius: number | string; ink: string };
    const matchesLegacy = legacyAccents.includes(String(current.accent || "").toLowerCase());
    if (matchesLegacy) {
      await db.execute({
        sql: `UPDATE themes SET name = ?, accent = ?, accent_2 = ?, surface = ?, ink = ?, font_pair = ?, radius = ?, description = ?, updated_at = ? WHERE id = ?`,
        args: [
          "Corporate Pro",
          "#0f1e36",
          "#f59e0b",
          "#ffffff",
          "#0f172a",
          "poppins-inter",
          12,
          "Tranzo BD ও ThinkTank-অনুপ্রাণিত প্রফেশনাল নেভি ও গোল্ড অ্যাকসেন্ট — প্রাতিষ্ঠানিক আনুষ্ঠানিক থিম।",
          now(),
          String(current.id),
        ],
      });
      console.log("[okgs] default theme refreshed to corporate navy/gold palette");
    }
  }

  // Also update science fair theme if untouched
  await db.execute({
    sql: `UPDATE themes SET accent = ?, accent_2 = ?, surface = ?, ink = ?, font_pair = ?, radius = ?, description = ?, updated_at = ? WHERE key = ? AND accent = ?`,
    args: [
      "#4f46e5",
      "#ec4899",
      "#090e1a",
      "#f1f5f9",
      "poppins-inter",
      20,
      "বিজ্ঞান মেলার জন্য বহু রঙের লিনিয়ার গ্রেডিয়েন্ট ও ডার্ক মোড — ভাইব্রেন্ট ইলেকট্রিক থিম।",
      now(),
      "fair-neon",
      "#8b5cf6",
    ],
  });
}

async function bootstrap() {
  await db.batch(schemaStatements(), "write");
  for (const resource of resourceOrder) {
    await migrateTable(resource);
  }
  await migrateLegacyClubs();
  await backfillClubLinks();
  await refreshDefaultTheme();
  for (const plan of seeds) {
    await seedTable(plan.resource, plan.rows);
  }
}

export async function ensureDatabase() {
  if (!globalForDb.okgsDbReady) {
    globalForDb.okgsDbReady = bootstrap().catch((error) => {
      globalForDb.okgsDbReady = undefined;
      throw error;
    });
  }
  await globalForDb.okgsDbReady;
}

/* ---------------------------------------------------------------- *
 * Generic CRUD used by the admin API and the public pages
 * ---------------------------------------------------------------- */

export function resourceTable(resource: ResourceName) {
  return resourceTables[resource];
}

function rowToRecord(row: Row) {
  const item: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    item[key] = normalizeRowFlags(key, value);
  }
  return item;
}

export function normalizeRows(rows: Row[]) {
  return rows.map(rowToRecord);
}

export interface ListOptions {
  activeOnly?: boolean;
  /** Filter by parent club slug — used by every club-scoped resource. */
  clubSlug?: string;
  limit?: number;
}

export async function listRows<T = Record<string, unknown>>(resource: ResourceName, options: ListOptions = {}) {
  await ensureDatabase();
  const table = resourceTables[resource];
  const filters: string[] = [];
  const args: (string | number)[] = [];
  const fields = fieldsFor(resource);

  if (options.activeOnly && fields.some((field) => field.name === "is_active")) filters.push("is_active = 1");
  if (options.clubSlug && fields.some((field) => field.name === "club_slug")) {
    filters.push("club_slug = ?");
    args.push(options.clubSlug);
  }

  const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
  const limit = options.limit ? ` LIMIT ${Number(options.limit)}` : "";
  const result = await db.execute({
    sql: `SELECT * FROM ${wrap(table)}${where} ORDER BY ${orderBy[resource]}${limit}`,
    args,
  });
  return normalizeRows(result.rows) as unknown as T[];
}

/** @deprecated kept for the existing admin route signature. */
export async function getResourceRows(resource: ResourceName, activeOnly = false) {
  return listRows(resource, { activeOnly });
}

export async function getRow(resource: ResourceName, id: string) {
  await ensureDatabase();
  const result = await db.execute({ sql: `SELECT * FROM ${wrap(resourceTables[resource])} WHERE id = ?`, args: [id] });
  const row = result.rows[0];
  return row ? (rowToRecord(row) as Record<string, unknown>) : null;
}

export async function rowExists(resource: ResourceName, column: string, value: string, exceptId?: string) {
  await ensureDatabase();
  const table = resourceTables[resource];
  const result = await db.execute({
    sql: `SELECT id FROM ${wrap(table)} WHERE ${wrap(column)} = ?${exceptId ? " AND id <> ?" : ""} LIMIT 1`,
    args: exceptId ? [value, exceptId] : [value],
  });
  return Boolean(result.rows[0]);
}

/** Build a slug that is not already taken in this table. */
/**
 * Pre-flight check for UNIQUE columns (e.g. a setting key) so the studio gets a
 * readable 409 instead of a database error surfacing as a 500.
 */
export async function findUniqueConflict(
  resource: ResourceName,
  values: Record<string, string | number>,
  id?: string,
): Promise<{ error: string; status: 409 } | null> {
  for (const column of uniqueColumns[resource] ?? []) {
    if (column === "slug") continue; // handled by resolveSlug
    if (!(column in values)) continue;
    const value = String(values[column] ?? "").trim();
    if (!value) continue;
    if (await rowExists(resource, column, value, id)) {
      const label = fieldDef(resource, column)?.label ?? column;
      return { error: `“${label}” is already used by another entry (“${value}”). Choose a different one.`, status: 409 };
    }
  }
  return null;
}

/** Generate a slug that satisfies the resource's own pattern, if it has one. */
export function generateSlug(resource: ResourceName, source: unknown) {
  const text = String(source ?? "").trim();
  if (!text) return "";
  const base = slugify(text);
  const field = fieldDef(resource, "slug");
  if (field?.pattern && !new RegExp(field.pattern, "u").test(base)) {
    // Club slugs stay ASCII so they can double as `{club}.okgs.info` subdomains.
    return asciiSlug(String(source ?? ""), resource.replace(/_/g, "-"));
  }
  return base;
}

/**
 * Normalise a slug before validation runs:
 *  - a slug typed by the admin is kept, but a duplicate is rejected;
 *  - an empty one is generated from the title/name (ASCII-safe for club subdomains).
 */
export async function resolveSlug(
  resource: ResourceName,
  values: Record<string, string | number>,
  id?: string,
): Promise<{ error: string; status: 409 } | null> {
  if (!fieldDef(resource, "slug")) return null;
  // Only touch the slug when the payload actually carries it — a partial PATCH
  // (inline publish toggle, quick edit) must never rename a live URL.
  if (!("slug" in values)) return null;
  const provided = slugify(String(values.slug ?? ""));
  if (provided) {
    values.slug = provided;
    if (await rowExists(resource, "slug", provided, id)) {
      return { error: `The slug “${provided}” is already taken — use another one.`, status: 409 };
    }
    return null;
  }
  const generated = generateSlug(resource, values.name || values.title || values.label || "");
  if (!generated) return null;
  values.slug = await uniqueSlug(resource, generated, id);
  return null;
}

export async function uniqueSlug(resource: ResourceName, base: string, exceptId?: string) {
  const cleaned = slugify(base) || `item-${Date.now().toString(36)}`;
  if (!(await rowExists(resource, "slug", cleaned, exceptId))) return cleaned;
  for (let suffix = 2; suffix < 60; suffix += 1) {
    const candidate = `${cleaned}-${suffix}`;
    if (!(await rowExists(resource, "slug", candidate, exceptId))) return candidate;
  }
  return `${cleaned}-${Date.now().toString(36)}`;
}

export async function insertRow(resource: ResourceName, payload: Record<string, string | number>) {
  await ensureDatabase();
  const id = randomUUID();
  const timestamp = now();
  const data: Record<string, string | number> = { ...payload, id };
  if (resource !== "settings") data.created_at = timestamp;
  data.updated_at = timestamp;

  const columns = Object.keys(data).filter((column) => column === "id" || column === "created_at" || column === "updated_at" || fieldsFor(resource).some((field) => field.name === column));
  await db.execute({
    sql: `INSERT INTO ${wrap(resourceTables[resource])} (${columns.map(wrap).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    args: columns.map((column) => data[column]),
  });
  const created = await getRow(resource, id);
  if (!created) throw new Error("Row could not be read back after saving.");
  return created;
}

export async function updateRow(resource: ResourceName, id: string, payload: Record<string, string | number>) {
  await ensureDatabase();
  const allowed = new Set(fieldsFor(resource).map((field) => field.name));
  const entries = Object.entries(payload).filter(([column]) => allowed.has(column));
  if (!entries.length) return { updated: false as const, row: await getRow(resource, id) };

  const updates = entries.map(([column]) => `${wrap(column)} = ?`);
  const args = entries.map(([, value]) => value);
  updates.push("updated_at = ?");
  args.push(now(), id);

  const result = await db.execute({
    sql: `UPDATE ${wrap(resourceTables[resource])} SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });
  if (Number(result.rowsAffected) === 0) return { updated: false as const, row: null };
  return { updated: true as const, row: await getRow(resource, id) };
}

export async function deleteRow(resource: ResourceName, id: string) {
  await ensureDatabase();
  const result = await db.execute({ sql: `DELETE FROM ${wrap(resourceTables[resource])} WHERE id = ?`, args: [id] });
  return Number(result.rowsAffected) > 0;
}

/** Bulk delete used when a club is removed, so no orphans are left behind. */
export async function deleteWhere(resource: ResourceName, column: string, value: string) {
  await ensureDatabase();
  if (!fieldsFor(resource).some((field) => field.name === column)) return 0;
  const result = await db.execute({
    sql: `DELETE FROM ${wrap(resourceTables[resource])} WHERE ${wrap(column)} = ?`,
    args: [value],
  });
  return Number(result.rowsAffected ?? 0);
}

export async function reorderRows(resource: ResourceName, ids: string[]) {
  await ensureDatabase();
  if (!fieldsFor(resource).some((field) => field.name === "sort_order")) return;
  const statements: InStatement[] = ids.map((id, index) => ({
    sql: `UPDATE ${wrap(resourceTables[resource])} SET sort_order = ? WHERE id = ?`,
    args: [index + 1, id],
  }));
  if (statements.length) await db.batch(statements, "write");
}

export async function countsByResource() {
  await ensureDatabase();
  const entries = await Promise.all(
    resourceOrder.map(async (resource) => {
      const hasActive = fieldsFor(resource).some((field) => field.name === "is_active");
      const sql = hasActive
        ? `SELECT COUNT(*) as total, COALESCE(SUM(${wrap("is_active")}), 0) as live FROM ${wrap(resourceTables[resource])}`
        : `SELECT COUNT(*) as total, COUNT(*) as live FROM ${wrap(resourceTables[resource])}`;
      const result = await db.execute(sql);
      return [resource, { total: Number(result.rows[0]?.total ?? 0), live: Number(result.rows[0]?.live ?? 0) }] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<ResourceName, { total: number; live: number }>;
}

/* ---------------------------------------------------------------- *
 * Public reads
 * ---------------------------------------------------------------- */

export async function getPublicContent(): Promise<PublicContent> {
  const entries = await Promise.all(resourceOrder.map((resource) => listRows(resource, { activeOnly: true })));
  return Object.fromEntries(resourceOrder.map((resource, index) => [resource, entries[index]])) as unknown as PublicContent;
}

export function clubResources(resource: ResourceName) {
  return ["club_events", "club_posts", "club_gallery", "club_members", "club_achievements"].includes(resource);
}

export { slugify };
export type { Club, ClubAchievement, ClubEvent, ClubGalleryItem, ClubMember, ClubPost };
