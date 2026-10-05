/**
 * Admin authentication — database backed, role aware.
 *
 * The studio no longer trusts an environment-variable password: every login
 * goes through `users` (the primary database), where each account carries an
 * email address and a role. The role decides what the account may do:
 *
 *   superadmin → full studio + site settings + the emergency maintenance switch
 *   admin      → full content studio
 *   everyone else → their own dashboard (/sf, /clubs/<slug>/admin, /me)
 *
 * `ADMIN_EMAIL` / `ADMIN_PASSWORD` still work as the *bootstrap* credentials:
 * lib/portal-db.ts seeds them as the first SuperAdmin on an empty database.
 */
import { cookies } from "next/headers";
import { getUser, publicUser, type PublicUser } from "@/lib/portal-db";
import {
  LEGACY_ADMIN_COOKIE,
  PORTAL_COOKIE,
  verifyLegacyAdminSession,
  verifyPortalSession,
} from "@/lib/session";
import { isAdminRole, isSuperAdminRole, type PortalRole } from "@/lib/roles";

export { SESSION_COOKIE, PORTAL_COOKIE, LEGACY_ADMIN_COOKIE } from "@/lib/session";

export interface AdminSession {
  id: string;
  name: string;
  email: string;
  role: PortalRole;
  designation: string;
  photo_url: string;
  /** Convenience flag for the sidebar: only a SuperAdmin sees the system pages. */
  isSuperAdmin: boolean;
}

function toAdminSession(user: PublicUser): AdminSession {
  return {
    id: user.id,
    name: user.name || user.email || "Administrator",
    email: user.email,
    role: user.role,
    designation: user.designation,
    photo_url: user.photo_url,
    isSuperAdmin: isSuperAdminRole(user.role),
  };
}

function isActive(user: { is_active: number }) {
  return Number(user.is_active) !== 0;
}

/**
 * Reads the signed-in administrator — or null.
 * Safe to call from any server component / route handler.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const payload = verifyPortalSession(store.get(PORTAL_COOKIE)?.value);
  if (payload && isAdminRole(payload.role)) {
    const user = await getUser(payload.userId);
    if (user && isActive(user) && isAdminRole(user.role)) return toAdminSession(publicUser(user));
    return null;
  }

  // Legacy studio cookie (pre-role logins): upgrade it to a database account.
  const email = verifyLegacyAdminSession(store.get(LEGACY_ADMIN_COOKIE)?.value);
  if (!email) return null;
  const configured = (process.env.ADMIN_EMAIL || "admin@okgs.info").toLowerCase();
  if (email.toLowerCase() !== configured) return null;
  const { findUserByEmail } = await import("@/lib/portal-db");
  const user = await findUserByEmail(configured);
  if (user && isActive(user) && isAdminRole(user.role)) return toAdminSession(publicUser(user));
  return null;
}

export async function isAdmin() {
  return Boolean(await getAdminSession());
}

export async function isSuperAdmin() {
  const session = await getAdminSession();
  return Boolean(session && session.isSuperAdmin);
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (!session.isSuperAdmin) throw new Error("FORBIDDEN");
  return session;
}

/** True when this request may keep browsing the public site while it is down. */
export async function canBypassMaintenanceLock() {
  return isSuperAdmin();
}
