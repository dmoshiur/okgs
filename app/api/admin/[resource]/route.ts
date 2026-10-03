import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { normalizeClubDomain, resourceFields, resourceRequired, slugify } from "@/lib/content-config";
import { db, ensureDatabase, getResourceRows, resourceTable } from "@/lib/db";
import type { ResourceName } from "@/lib/types";

const resources = new Set(Object.keys(resourceFields));

function validResource(value: string): value is ResourceName {
  return resources.has(value);
}

function databaseValue(field: string, value: unknown) {
  if (field === "is_active" || field === "is_featured") return value === true || value === 1 || value === "true" ? 1 : 0;
  if (field === "sort_order") return Number.isFinite(Number(value)) ? Number(value) : 0;
  if (value === null || value === undefined) return "";
  return String(value);
}

function cleanPayload(resource: ResourceName, raw: Record<string, unknown>, fillDefaults = false) {
  const payload: Record<string, string | number> = {};
  for (const field of resourceFields[resource]) {
    if (!fillDefaults && !(field in raw)) continue;
    let value = raw[field];
    if (resource === "news" && field === "slug" && !value && raw.title) {
      value = slugify(String(raw.title));
    }
    if (fillDefaults && value === undefined) {
      value = field === "is_active" ? true : field === "is_featured" ? false : field === "sort_order" ? 0 : "";
    }
    payload[field] = databaseValue(field, value);
  }
  return payload;
}

function validate(resource: ResourceName, payload: Record<string, string | number>) {
  const missing = resourceRequired[resource].find((field) => !String(payload[field] ?? "").trim());
  if (missing) return `Please provide ${missing.replaceAll("_", " ")}.`;
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  try {
    await requireAdmin();
    const { resource } = await context.params;
    if (!validResource(resource)) {
      return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
    }
    const items = await getResourceRows(resource);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Unable to load content." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  try {
    await requireAdmin();
    const { resource } = await context.params;
    if (!validResource(resource)) {
      return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
    }

    const raw = (await request.json()) as Record<string, unknown>;
    const payload = cleanPayload(resource, raw, true);
    if (resource === "clubs") {
      payload.domain = normalizeClubDomain(String(payload.domain || ""), String(payload.slug || ""));
    }
    const problem = validate(resource, payload);
    if (problem) return NextResponse.json({ error: problem }, { status: 422 });

    await ensureDatabase();
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const extra = resource === "settings" ? { updated_at: timestamp } : { created_at: timestamp, updated_at: timestamp };
    const data = { id, ...payload, ...extra };
    const columns = Object.keys(data);
    const args = columns.map((column) => (data as Record<string, string | number>)[column]);
    await db.execute({
      sql: `INSERT INTO ${resourceTable(resource)} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      args,
    });

    const created = await db.execute({ sql: `SELECT * FROM ${resourceTable(resource)} WHERE id = ?`, args: [id] });
    return NextResponse.json({ item: created.rows[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Unable to create this item. Check that unique fields are not duplicated." }, { status: 500 });
  }
}
