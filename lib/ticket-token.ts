/**
 * HMAC-signed tokens for student tickets and external guest passes.
 *
 * token = base64url(JSON payload) + "." + HMAC-SHA256(payload, secret), truncated.
 * The payload carries kind ("s" student / "g" guest), the record id, the fair
 * slug and an expiry (unix seconds). Forging or editing any field breaks the
 * signature, and the scanner rejects it as "invalid".
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { portalSecret } from "@/lib/portal-auth";

export type TicketKind = "s" | "g";

export interface TicketPayload {
  k: TicketKind;
  i: string;
  f: string;
  e: number;
}

function signBody(body: string) {
  return createHmac("sha256", `${portalSecret()}::ticket`).update(body).digest("base64url").slice(0, 32);
}

export function makeTicketToken(payload: TicketPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signBody(body)}`;
}

/** Returns the verified payload, or null when the token is malformed or tampered with. */
export function parseTicketToken(token: string): TicketPayload | null {
  const value = String(token ?? "").trim();
  const match = /^([A-Za-z0-9_-]{10,600})\.([A-Za-z0-9_-]{32})$/.exec(value);
  if (!match) return null;
  const [, body, signature] = match;
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(signBody(body)))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<TicketPayload>;
    if ((payload.k !== "s" && payload.k !== "g") ||
      typeof payload.i !== "string" || !payload.i.trim() || payload.i.length > 128 ||
      typeof payload.f !== "string" || !/^[a-z0-9-]{2,64}$/i.test(payload.f) ||
      typeof payload.e !== "number" || !Number.isSafeInteger(payload.e) || payload.e <= 0 || payload.e > 8_640_000_000_000) {
      return null;
    }
    return { k: payload.k, i: payload.i, f: payload.f, e: payload.e };
  } catch {
    return null;
  }
}

/** End of the fair's last day (Dhaka time) plus one day of grace; 30 days when no date is set. */
export function ticketExpiry(endsOn?: string | null) {
  if (endsOn && /^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
    const end = new Date(`${endsOn}T23:59:59+06:00`).getTime() + 24 * 60 * 60 * 1000;
    if (!Number.isNaN(end)) return Math.floor(end / 1000);
  }
  return Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
}
