import { errorResponse, fail, ok, staff } from "@/lib/api";
import { processLunchScan } from "@/lib/lunch-scan";
import { readScanRequest, ScanRequestError } from "@/lib/scan-request";
import { pruneRateLimits, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST — { token | code, fair_slug, action?: "check" | "claim" }. Claim is the default. */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  pruneRateLimits();
  const limit = rateLimit(`lunch-scan:${session.user.id}`, { max: 120, windowMs: 60_000 });
  if (!limit.ok) {
    const response = fail("Too many scans. Please wait briefly before scanning again.", 429);
    response.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return response;
  }
  try {
    const input = await readScanRequest(request);
    const outcome = await processLunchScan({ ...input, actor_id: session.user.id, actor_name: session.user.name });
    return ok(outcome);
  } catch (error) {
    if (error instanceof ScanRequestError) return fail(error.message, error.status);
    // Do not report a successful handover on DB/network failure. Retrying is
    // safe: an already-committed person/day claim returns duplicate, never success.
    return errorResponse(error, "lunch:scan");
  }
}
