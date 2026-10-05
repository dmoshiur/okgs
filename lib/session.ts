/**
 * Sessions — one signed cookie for every human in the school.
 *
 * There are two cookies in circulation:
 *
 *  · `okgs_portal`        — the current session. It carries the user id, the
 *                           role and an expiry, and is verified with HMAC-SHA256.
 *  · `okgs_admin_session` — the legacy studio cookie (env credentials, no role).
 *                           Old browsers still holding one are upgraded on the
 *                           next request: the email inside it is matched against
 *                           ADMIN_EMAIL and the matching database account.
 *
 * Nothing here imports React, `next/headers` or the database, so the middleware
 * can verify a visitor's role to decide on the maintenance bypass without
 * booting the app runtime.
 */
import { isPortalRole, type PortalRole } from "@/lib/roles";
import { signValue, verifySignedValue } from "@/lib/hmac";

export const PORTAL_COOKIE = "okgs_portal";
export const LEGACY_ADMIN_COOKIE = "okgs_admin_session";
export const SESSION_COOKIE = PORTAL_COOKIE;
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

export interface PortalSessionPayload {
  userId: string;
  role: PortalRole;
  exp: number;
}

/** `userId|role|exp` — signed, stateless, no session table required. */
export function createPortalSession(user: { id: string; role: PortalRole }, hours = 24 * 14) {
  const exp = Date.now() + hours * 3_600_000;
  return signValue(`${user.id}|${user.role}|${exp}`);
}

export function verifyPortalSession(value?: string | null): PortalSessionPayload | null {
  const payload = verifySignedValue(value, 3);
  if (!payload) return null;
  const [userId, role, exp] = payload.split("|");
  if (!userId || !role || !isPortalRole(role)) return null;
  if (!Number(exp) || Number(exp) < Date.now()) return null;
  return { userId, role, exp: Number(exp) };
}

/* ------------------------------ legacy studio cookie ------------------------------ */

export function createLegacyAdminSession(email: string, hours = 12) {
  const expires = Date.now() + hours * 3_600_000;
  return signValue(`${email}|${expires}`);
}

export function verifyLegacyAdminSession(value?: string | null): string | null {
  const payload = verifySignedValue(value, 2);
  if (!payload) return null;
  const [email, expiry] = payload.split("|");
  if (!email || !Number(expiry) || Number(expiry) < Date.now()) return null;
  return email;
}

/* ------------------------------ cookie helpers ------------------------------ */

export function portalCookieHeader(value: string, maxAge = SESSION_MAX_AGE) {
  return `${PORTAL_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export function clearPortalCookieHeader() {
  return `${PORTAL_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function clearLegacyCookieHeader() {
  return `${LEGACY_ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** The role a cookie pair proves — used by the middleware maintenance gate. */
export function roleFromCookies(portalCookie?: string, legacyCookie?: string): PortalRole | null {
  const payload = verifyPortalSession(portalCookie);
  if (payload) return payload.role;
  const email = verifyLegacyAdminSession(legacyCookie);
  if (email && email.toLowerCase() === (process.env.ADMIN_EMAIL || "admin@okgs.info").toLowerCase()) {
    return "superadmin";
  }
  return null;
}

/**
 * True when the cookie holder may keep browsing the PUBLIC site while it is down.
 * Only a SuperAdmin holds that key — a plain Admin still reaches `/admin`
 * (that path is exempt), but sees the maintenance notice everywhere else, which
 * is exactly what a visitor sees.
 */
export function canBypassMaintenance(portalCookie?: string, legacyCookie?: string) {
  return roleFromCookies(portalCookie, legacyCookie) === "superadmin";
}
