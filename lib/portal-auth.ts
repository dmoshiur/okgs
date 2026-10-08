/**
 * Portal authentication — one login for every human in the school.
 *
 * Every door (admin studio, /sf console, club admin, /me dashboard) posts to the
 * same verifier: **email (or school ID) + password**. There is no role picker
 * anywhere — the role is read from the `users` table and the API answers with
 * the dashboard that role owns. See lib/roles.ts → dashboardPathForRole().
 *
 * Sessions are signed, stateless HMAC cookies (`lib/session.ts`), so no session
 * table is required. Password resets use single-use, hashed, time-boxed tokens
 * (`password_resets`) mailed by `lib/mailer.ts`.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  createEmailAccount,
  findUserByLogin,
  getUser,
  isAdminRole,
  isStaffRole,
  publicUser,
  setUserPassword,
  touchLogin,
  updateUser,
  type PortalRole,
  type PortalUser,
  type PublicUser,
} from "@/lib/portal-db";
import { sessionSecret } from "@/lib/hmac";
import {
  createPortalSession,
  portalCookieHeader,
  PORTAL_COOKIE,
  SESSION_MAX_AGE,
  verifyPortalSession,
  type PortalSessionPayload,
} from "@/lib/session";
import { dashboardPathForRole } from "@/lib/roles";

export { PORTAL_COOKIE, SESSION_MAX_AGE, createPortalSession, verifyPortalSession, portalCookieHeader };
export type { PortalSessionPayload };
export const SESSION_COOKIE = PORTAL_COOKIE;

const DEFAULT_PASSWORD = process.env.DEFAULT_PORTAL_PASSWORD || process.env.PORTAL_DEFAULT_PASSWORD || "okgs1234";

export function portalSecret() {
  return sessionSecret();
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

/** Pragmatic password policy — long enough to matter, short enough to type. */
export function passwordProblem(password: string) {
  return passwordProblemEn(password, "bn");
}

/**
 * The same policy in the language the caller needs: the studio and the staff
 * panel validate in English, the public portal in Bangla.
 */
export function passwordProblemEn(password: string, language: "bn" | "en" = "bn") {
  const value = String(password ?? "");
  if (value.length < 8) return language === "en" ? "The password must be at least 8 characters long." : "পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে।";
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return language === "en" ? "The password needs at least one letter and one number." : "পাসওয়ার্ডে অন্তত একটি অক্ষর ও একটি সংখ্যা থাকতে হবে।";
  }
  return "";
}

/* ----------------------------- sessions ----------------------------- */

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

export function setPortalCookieHeader(value: string, maxAge = SESSION_MAX_AGE) {
  return portalCookieHeader(value, maxAge);
}

export function clearPortalCookieHeader() {
  return `${PORTAL_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/* ----------------------------- login flow ----------------------------- */

export interface LoginResult {
  ok: boolean;
  /** Message in the language of the public portal (Bangla). */
  error?: string;
  /**
   * The same message in English. The staff doors (`/sf/login`, `/admin/login`)
   * are English-only, so the API answers both and the form picks one — a single
   * endpoint cannot assume the language of whoever is reading it.
   */
  errorEn?: string;
  /** Non-fatal note, e.g. the default password is still in use. */
  warning?: string;
  warningEn?: string;
  user?: PublicUser;
  role?: PortalRole;
  cookie?: string;
  /** Where this role belongs — never chosen by the client. */
  redirect?: string;
}

/**
 * The role-aware landing page. Club admins without a club slug (or whose slug
 * has gone) fall back to the staff console so they are never left on a 404.
 */
export function landingPathFor(user: PublicUser) {
  if (user.role === "club") {
    const slug = String(user.club_slug || "").trim();
    const systemClub = ["superadmin", "admin"].includes(user.role);
    if (slug && !systemClub) return `/clubs/${slug}/admin`;
    return "/sf";
  }
  return dashboardPathForRole(user.role);
}

export function loginError(message: string, status = 401) {
  return { ok: false as const, error: message, status };
}

export async function loginWithPassword(identifier: string, password: string): Promise<LoginResult> {
  const user = await findUserByLogin(identifier);
  // Same wording for "no such account" and "wrong password" — the login form
  // must not become an account-enumeration oracle.
  if (!user) return { ok: false, error: "ইমেইল/আইডি অথবা পাসওয়ার্ড ঠিক নয়।", errorEn: "That email or ID and password do not match." };
  if (!Number(user.is_active)) {
    return { ok: false, error: "অ্যাকাউন্টটি বন্ধ করা হয়েছে। অফিসে যোগাযোগ করুন।", errorEn: "This account is disabled. Please contact the school office." };
  }
  if (!user.password_hash || !user.password_salt) {
    return {
      ok: false,
      error: "এই অ্যাকাউন্টে এখনো পাসওয়ার্ড সেট হয়নি। “পাসওয়ার্ড ভুলে গেছেন?” থেকে সেট করুন।",
      errorEn: "This account has no password yet — use “Forgot password?” to set one.",
    };
  }
  if (!verifyPassword(password, user.password_hash, user.password_salt)) {
    return { ok: false, error: "ইমেইল/আইডি অথবা পাসওয়ার্ড ঠিক নয়।", errorEn: "That email or ID and password do not match." };
  }
  await touchLogin(user.id);
  const safe = publicUser(user);
  const mustChange = Number(user.must_change_password) === 1;
  return {
    ok: true,
    user: safe,
    role: user.role,
    cookie: createPortalSession(user),
    redirect: landingPathFor(safe),
    warning: mustChange ? "ডিফল্ট পাসওয়ার্ড এখনো বদলানো হয়নি — বদলে নিন।" : undefined,
    warningEn: mustChange ? "The default password has not been changed yet — please change it." : undefined,
  };
}

/** Creates a login for a user that has none yet (imported students, first admin). */
export async function ensurePassword(user: PortalUser, password = DEFAULT_PASSWORD) {
  if (user.password_hash && user.password_salt) return false;
  const { hash, salt } = hashPassword(password);
  await setUserPassword(user.id, hash, salt, { mustChange: true });
  return true;
}

/** Sets a fresh password (used by the reset flow and the SuperAdmin manager). */
export async function assignPassword(user: PortalUser | string, password: string, options: { mustChange?: boolean } = {}) {
  const id = typeof user === "string" ? user : user.id;
  const { hash, salt } = hashPassword(password);
  await setUserPassword(id, hash, salt, options);
}

/**
 * Creates an account from an email address and syncs it into the primary
 * database. Used by the SuperAdmin user manager and by any sign-up surface.
 */
export async function createAccountWithEmail(input: {
  email: string;
  name?: string;
  role?: PortalRole;
  password?: string;
  [key: string]: unknown;
}) {
  const password = input.password || DEFAULT_PASSWORD;
  const { hash, salt } = hashPassword(password);
  return createEmailAccount({
    ...input,
    role: input.role ?? "student",
    password_hash: hash,
    password_salt: salt,
    is_active: 1,
    must_change_password: input.password ? 0 : 1,
  });
}

/** Re-exports so callers can `updateUser` without a second import. */
export { updateUser };
