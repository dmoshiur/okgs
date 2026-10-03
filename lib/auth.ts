import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "okgs_admin_session";
const FALLBACK_EMAIL = "admin@okgs.info";
const FALLBACK_PASSWORD = "change-this-password";
const FALLBACK_SECRET = "okgs-local-development-session-secret";

export function adminCredentials() {
  return {
    email: process.env.ADMIN_EMAIL || FALLBACK_EMAIL,
    password: process.env.ADMIN_PASSWORD || FALLBACK_PASSWORD,
  };
}

function sessionSecret() {
  return process.env.SESSION_SECRET || FALLBACK_SECRET;
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function createSession(email: string) {
  const expires = Date.now() + 1000 * 60 * 60 * 12;
  const payload = `${email}|${expires}`;
  return `${payload}|${sign(payload)}`;
}

export function verifySession(value?: string | null) {
  if (!value) return false;
  const [email, expiry, signature] = value.split("|");
  if (!email || !expiry || !signature || Number(expiry) < Date.now()) return false;
  const payload = `${email}|${expiry}`;
  const expected = sign(payload);
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function isAdmin() {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    throw new Error("UNAUTHORIZED");
  }
}
