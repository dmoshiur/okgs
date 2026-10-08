import { defaultFairSlug, ok, staff, str } from "@/lib/api";
import { listScanLogs, scanSummary } from "@/lib/student-db";

export const dynamic = "force-dynamic";

/** GET /api/staff/entry/logs?fair=&limit= — scan audit trail plus totals. */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const url = new URL(request.url);
  const fair = str(url.searchParams.get("fair")) || (await defaultFairSlug());
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const [logs, summary] = await Promise.all([listScanLogs({ fair_slug: fair, limit }), scanSummary(fair)]);
  return ok({ logs, summary, fair_slug: fair });
}
