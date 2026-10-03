import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { normalizeClubDomain, resourceFields, resourceRequired, slugify } from "@/lib/content-config";
import { db, ensureDatabase, resourceTable } from "@/lib/db";
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

function cleanPayload(resource: ResourceName, raw: Record<string, unknown>) {
  const payload: Record<string, string | number> = {};
  for (const field of resourceFields[resource]) {
    if (!(field in raw)) continue;
    let value = raw[field];
    if (resource === "news" && field === "slug" && !value && raw.title) value = slugify(String(raw.title));
    payload[field] = databaseValue(field, value);
  }
  return payload;
}

function validate(resource: ResourceName, payload: Record<string, string | number>) {
  const missing = resourceRequired[resource].find((field) => field in payload && !String(payload[field] ?? "").trim());
  if (missing) return `Please provide ${missing.replaceAll("_", " ")}.`;
  return null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    await requireAdmin();
    const { resource, id } = await context.params;
    if (!validResource(resource)) return NextResponse.json({ error: "Unknown content type." }, { status: 404 });

    const raw = (await request.json()) as Record<string, unknown>;
    const payload = cleanPayload(resource, raw);
    const problem = validate(resource, payload);
    if (problem) return NextResponse.json({ error: problem }, { status: 422 });
    if (resource === "clubs" && (payload.slug || payload.domain)) {
      payload.domain = normalizeClubDomain(String(payload.domain || ""), String(payload.slug || ""));
    }
    if (Object.keys(payload).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 422 });

    await ensureDatabase();
    const updates = Object.keys(payload).map((field) => `${field} = ?`);
    const args = Object.values(payload);
    updates.push("updated_at = ?");
    args.push(new Date().toISOString());
    args.push(id);
    const result = await db.execute({
      sql: `UPDATE ${resourceTable(resource)} SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });
    if (Number(result.rowsAffected) === 0) return NextResponse.json({ error: "Item not found." }, { status: 404 });

    const updated = await db.execute({ sql: `SELECT * FROM ${resourceTable(resource)} WHERE id = ?`, args: [id] });
    return NextResponse.json({ item: updated.rows[0] });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Unable to update this item. Check that unique fields are not duplicated." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    await requireAdmin();
    const { resource, id } = await context.params;
    if (!validResource(resource)) return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
    await ensureDatabase();
    const result = await db.execute({ sql: `DELETE FROM ${resourceTable(resource)} WHERE id = ?`, args: [id] });
    if (Number(result.rowsAffected) === 0) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Unable to delete this item." }, { status: 500 });
  }
}
