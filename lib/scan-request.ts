/** Bounded JSON inputs for authenticated scan APIs. Names/payments/dates/actors are server-owned. */
import { defaultFairSlug } from "@/lib/api";
import { readFairPreference } from "@/lib/sf-preference";
import { dbQuery } from "@/lib/portal-db";
import type { LunchAction } from "@/lib/scan-types";

export class ScanRequestError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

export async function readScanRequest(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new ScanRequestError("Cross-site scan requests are not allowed.", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ScanRequestError("Send scan data as JSON.", 415);
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 8192) throw new ScanRequestError("Scan data is too large.", 413);
  // Stop reading at the byte limit, including chunked bodies without a trusted Content-Length.
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  if (reader) {
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 8192) {
          await reader.cancel().catch(() => undefined);
          throw new ScanRequestError("Scan data is too large.", 413);
        }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
  }
  const text = Buffer.concat(chunks, bytes).toString("utf8");
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new ScanRequestError("Send valid JSON scan data.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ScanRequestError("Send a JSON object.", 400);
  const values = body as Record<string, unknown>;
  for (const field of ["token", "code", "fair_slug", "action"]) {
    if (values[field] !== undefined && typeof values[field] !== "string") throw new ScanRequestError(`${field} must be text.`);
  }
  const token = String(values.token ?? "").trim();
  const code = String(values.code ?? "").trim();
  if ((!token && !code) || (token && code)) throw new ScanRequestError("Scan one ticket QR or enter one student ID.");
  if (token.length > 2048 || code.length > 128) throw new ScanRequestError("The scanned ticket or ID is too long.");
  const action = String(values.action ?? "claim").trim();
  if (action !== "check" && action !== "claim") throw new ScanRequestError("Action must be check or claim.");
  const fair = String(values.fair_slug ?? "").trim() || await readFairPreference() || await defaultFairSlug();
  if (!/^[a-z0-9-]{2,64}$/i.test(fair)) throw new ScanRequestError("Choose a valid fair before scanning.");
  const [registered] = await dbQuery<{ slug: string }>(`SELECT slug FROM fairs WHERE slug = ? LIMIT 1`, [fair]);
  if (!registered) throw new ScanRequestError("The selected fair was not found.", 404);
  return { fair_slug: fair, token: token || undefined, code: code || undefined, action: action as LunchAction, method: token ? "qr" as const : "manual" as const };
}
