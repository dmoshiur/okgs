import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fieldsFor, resourceSchema } from "@/lib/content-config";
import { reorderRows } from "@/lib/db";
import type { ResourceName } from "@/lib/types";
import { revalidatePublicSite } from "@/lib/revalidate";

const known = new Set(Object.keys(resourceSchema) as ResourceName[]);

/**
 * POST /api/admin/reorder
 * body: { resource, ids: string[] }  — array order becomes sort_order 1..n
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as { resource?: string; ids?: unknown };
    const resource = String(body.resource ?? "") as ResourceName;

    if (!known.has(resource)) return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
    if (!fieldsFor(resource).some((field) => field.name === "sort_order")) {
      return NextResponse.json({ error: "This list cannot be reordered." }, { status: 422 });
    }
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    if (!ids.length) return NextResponse.json({ error: "The order list is empty." }, { status: 422 });

    await reorderRows(resource, ids);
    // Order is part of the public page (slides, stats, fair schedule…), so the
    // rendered copies are dropped too.
    revalidatePublicSite();
    return NextResponse.json({ ok: true, count: ids.length });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    console.error("[admin:reorder]", error);
    return NextResponse.json({ error: "The order could not be saved." }, { status: 500 });
  }
}
