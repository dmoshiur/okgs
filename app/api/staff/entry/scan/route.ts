import { defaultFairSlug, fail, ok, staff, str } from "@/lib/api";
import { processEntry } from "@/lib/entry-scan";

export const dynamic = "force-dynamic";

/**
 * POST /api/staff/entry/scan — { token } from a ticket QR, or { code } for a manual
 * student-ID entry. Returns success | duplicate | expired | invalid and writes the
 * scan log with scanned_at and entry_time.
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const token = str(body.token);
  const code = str(body.code);
  if (!token && !code) return fail("Scan a QR code or enter a student ID.", 422);
  const fair = str(body.fair_slug) || (await defaultFairSlug());

  const outcome = await processEntry({
    fair_slug: fair,
    token: token || undefined,
    code: token ? undefined : code,
    method: token ? "qr" : "manual",
    actor_id: session.user.id,
    actor_name: session.user.name,
  });
  return ok(outcome);
}
