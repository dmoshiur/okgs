import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fieldsFor, resourceSchema } from "@/lib/content-config";
import { reorderRows } from "@/lib/db";
import type { ResourceName } from "@/lib/types";

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

    if (!known.has(resource)) return NextResponse.json({ error: "অজানা কনটেন্ট টাইপ।" }, { status: 404 });
    if (!fieldsFor(resource).some((field) => field.name === "sort_order")) {
      return NextResponse.json({ error: "এই তালিকাটি ক্রম অনুযায়ী সাজানো যায় না।" }, { status: 422 });
    }
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    if (!ids.length) return NextResponse.json({ error: "ক্রমের তালিকা খালি।" }, { status: 422 });

    await reorderRows(resource, ids);
    return NextResponse.json({ ok: true, count: ids.length });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
    }
    console.error("[admin:reorder]", error);
    return NextResponse.json({ error: "ক্রম সংরক্ষণ করা যায়নি।" }, { status: 500 });
  }
}
