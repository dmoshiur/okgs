import { errorResponse, fail, ok, staff } from "@/lib/api";
import { processEntry } from "@/lib/entry-scan";
import { readScanRequest, ScanRequestError } from "@/lib/scan-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST — signed ticket QR or a manual student ID, with live payment verification. */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  try {
    const input = await readScanRequest(request);
    return ok(await processEntry({ ...input, actor_id: session.user.id, actor_name: session.user.name }));
  } catch (error) {
    if (error instanceof ScanRequestError) return fail(error.message, error.status);
    return errorResponse(error, "entry:scan");
  }
}
