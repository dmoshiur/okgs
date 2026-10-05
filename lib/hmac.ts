/**
 * The signing core for every cookie this app issues.
 *
 * Kept dependency-free on purpose (only `node:crypto`, no React, no database):
 * the middleware runs the same code to decide whether a visitor may bypass the
 * maintenance lock, and it must not drag the data layer into that bundle.
 *
 * A signed value looks like `payload|base64url(hmacSHA256(payload))`. If
 * SESSION_SECRET is missing the development fallback is used, exactly as before,
 * so local setups keep working with zero configuration.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const FALLBACK_SECRET = "okgs-local-development-session-secret";

export function sessionSecret() {
  return process.env.SESSION_SECRET || FALLBACK_SECRET;
}

export function signPayload(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

/** Constant-time comparison that never throws on malformed input. */
export function signaturesMatch(actual: string, expected: string) {
  try {
    const a = Buffer.from(actual);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** `signValue("1|2|3")` → `"1|2|3|<signature>"`. */
export function signValue(payload: string) {
  return `${payload}|${signPayload(payload)}`;
}

/**
 * Verifies a signed value and returns its payload (or null).
 * The expected signature is recomputed from everything before the last `|`.
 */
export function verifySignedValue(value?: string | null, expectedParts?: number): string | null {
  if (!value) return null;
  const parts = value.split("|");
  const signature = parts.pop();
  const payload = parts.join("|");
  if (!signature || !payload) return null;
  if (expectedParts !== undefined && parts.length !== expectedParts) return null;
  return signaturesMatch(signature, signPayload(payload)) ? payload : null;
}

/** Timing-safe string equality for credential comparisons. */
export function safeEquals(input: string, expected: string) {
  return signaturesMatch(input, expected);
}
