import { defaultFairSlug, errorResponse, fail, ok, staff, str } from "@/lib/api";
import { listLunchScans, lunchScanSummary } from "@/lib/lunch-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Authenticated canteen audit trail; summary/day boundaries always come from the server. */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const url = new URL(request.url);
  const fair = str(url.searchParams.get("fair")) || await defaultFairSlug();
  if (!/^[a-z0-9-]{2,64}$/i.test(fair)) return fail("Choose a valid fair.", 422);
  try {
    const now = new Date();
    const [logs, summary] = await Promise.all([
      listLunchScans(fair, { today: url.searchParams.get("today") === "1", limit: Number(url.searchParams.get("limit") || 150) }, now),
      lunchScanSummary(fair, now),
    ]);
    return ok({ logs, summary, fair_slug: fair, day: summary.day, next_reset_at: summary.next_reset_at, server_time: now.toISOString(), time_zone: "Asia/Dhaka" });
  } catch (error) { return errorResponse(error, "lunch:logs"); }
}
