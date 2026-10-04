/**
 * Portal authentication — one login for every human in the school.
 *
 * /sf/login (and /me) accept either an email address or a school ID number plus a
 * password. The session is a signed, stateless HMAC cookie (`okgs_portal`), the
 * same technique the admin studio already uses, so no session table is required.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  findUserByLogin,
  getUser,
  isAdminRole,
  isStaffRole,
  publicUser,
  touchLogin,
  updateUser,
  type PortalRole,
  type PortalUser,
  type PublicUser,
} from "@/lib/portal-db";

export const PORTAL_COOKIE = "okgs_portal";
const FALLBACK_SECRET = "okgs-local-development-session-secret";
const DEFAULT_PASSWORD = process.env.DEFAULT_PORTAL_PASSWORD || "okgs1234";

export function portalSecret() {
  return process.env.SESSION_SECRET || FALLBACK_SECRET;
}

export function defaultPortalPassword() {
  return DEFAULT_PASSWORD;
}

/* ----------------------------- passwords ----------------------------- */

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string) {
  if (!hash || !salt) return false;
  try {
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/* ----------------------------- sessions ----------------------------- */

export interface PortalSessionPayload {
  userId: string;
  role: PortalRole;
  exp: number;
}

function sign(value: string) {
  return createHmac("sha256", portalSecret()).update(value).digest("base64url");
}

export function createPortalSession(user: { id: string; role: PortalRole }, hours = 24 * 14) {
  const exp = Date.now() + hours * 3_600_000;
  const payload = `${user.id}|${user.role}|${exp}`;
  return `${payload}|${sign(payload)}`;
}

export function verifyPortalSession(value?: string | null): PortalSessionPayload | null {
  if (!value) return null;
  const parts = value.split("|");
  if (parts.length !== 4) return null;
  const [userId, role, exp, signature] = parts;
  if (!userId || !role || !exp || !signature) return null;
  if (Number(exp) < Date.now()) return null;
  const expected = sign(`${userId}|${role}|${exp}`);
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return { userId, role: role as PortalRole, exp: Number(exp) };
}

export interface PortalSession {
  user: PublicUser;
  role: PortalRole;
}

/** Reads the signed-in portal user (or null). Safe to call on any page. */
export async function getPortalSession(): Promise<PortalSession | null> {
  const store = await cookies();
  const payload = verifyPortalSession(store.get(PORTAL_COOKIE)?.value);
  if (!payload) return null;
  const user = await getUser(payload.userId);
  if (!user || !Number(user.is_active)) return null;
  return { user: publicUser(user), role: user.role };
}

export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireStaffSession(): Promise<PortalSession> {
  const session = await requirePortalSession();
  if (!isStaffRole(session.role)) throw new Error("FORBIDDEN");
  return session;
}

export async function requireAdminSession(): Promise<PortalSession> {
  const session = await requirePortalSession();
  if (!isAdminRole(session.role)) throw new Error("FORBIDDEN");
  return session;
}

/* ----------------------------- login flow ----------------------------- */

export interface LoginResult {
  ok: boolean;
  error?: string;
  user?: PublicUser;
  role?: PortalRole;
  cookie?: string;
}

export async function loginWithPassword(identifier: string, password: string): Promise<LoginResult> {
  const user = await findUserByLogin(identifier);
  if (!user) return { ok: false, error: "এই ইমেইল বা আইডি নম্বর দিয়ে কোনো অ্যাকাউন্ট নেই।" };
  if (!Number(user.is_active)) return { ok: false, error: "অ্যাকাউন্টটি বন্ধ করা হয়েছে। অফিসে যোগাযোগ করুন।" };
  if (!verifyPassword(password, user.password_hash, user.password_salt)) {
    return { ok: false, error: "পাসওয়ার্ড ঠিক নয়।" };
  }
  await touchLogin(user.id);
  return {
    ok: true,
    user: publicUser(user),
    role: user.role,
    cookie: createPortalSession(user),
  };
}

/** Creates a login for a user that has none yet (imported students, first admin). */
export async function ensurePassword(user: PortalUser, password = DEFAULT_PASSWORD) {
  if (user.password_hash && user.password_salt) return false;
  const { hash, salt } = hashPassword(password);
  await updateUser(user.id, { password_hash: hash, password_salt: salt });
  return true;
}

export function setPortalCookieHeader(value: string) {
  return `${PORTAL_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export function clearPortalCookieHeader() {
  return `${PORTAL_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
