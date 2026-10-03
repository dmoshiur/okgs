import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { resourceSchema } from "@/lib/content-config";
import { listRows } from "@/lib/db";
import type { ResourceName } from "@/lib/types";

/**
 * GET /api/admin/all
 * One round-trip for the whole studio, instead of N parallel requests.
 * Includes draft rows plus the live/draft counts used by the sidebar.
 */
export async function GET() {
  try {
    await requireAdmin();
    const resources = Object.keys(resourceSchema) as ResourceName[];
    const rows = await Promise.all(resources.map((resource) => listRows(resource)));
    const items = Object.fromEntries(resources.map((resource, index) => [resource, rows[index]])) as Record<
      ResourceName,
      Record<string, unknown>[]
    >;
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
    }
    console.error("[admin:all]", error);
    return NextResponse.json({ error: "স্টুডিও লোড করা যায়নি।" }, { status: 500 });
  }
}
