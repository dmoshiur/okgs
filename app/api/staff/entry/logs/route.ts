import { defaultFairSlug, errorResponse, fail, ok, staff, str } from "@/lib/api";
import { listScanLogs, scanDaySummary, scanSummary } from "@/lib/student-db";
import { nextSchoolDayIso, schoolDayKey } from "@/lib/school-time";

export const dynamic = "force-dynamic";

/** GET — exact server-owned Bangladesh-day filters, not a UTC substring on the phone. */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const url = new URL(request.url);
  const fair = str(url.searchParams.get("fair")) || await defaultFairSlug();
  if (!/^[a-z0-9-]{2,64}$/i.test(fair)) return fail("Choose a valid fair.", 422);
  const today = url.searchParams.get("today") === "1";
  try {
    const now = new Date();
    const [logs, summary] = await Promise.all([
      listScanLogs({ fair_slug: fair, limit: Number(url.searchParams.get("limit") || 150), today }, now),
      today ? scanDaySummary(fair, now) : scanSummary(fair),
    ]);
    return ok({ logs, summary, fair_slug: fair, day: schoolDayKey(now), next_reset_at: nextSchoolDayIso(now), server_time: now.toISOString(), time_zone: "Asia/Dhaka" });
  } catch (error) { return errorResponse(error, "entry:logs"); }
}
