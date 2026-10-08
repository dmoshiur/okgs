/**
 * Maintenance flag — read by the middleware on every request and by the server
 * components as a second line of defence.
 *
 * The flag lives in the `settings` table (`maintenance_mode`), but the middleware
 * must not pay for a database round-trip on every asset request, so the value is
 * cached in module scope for a few seconds and shared through `globalThis`, which
 * means the SuperAdmin's toggle invalidates it instantly on the same instance
 * (see lib/site-settings.ts → setMaintenanceMode).
 *
 * Every failure mode is biased towards “site is up”: if the database is
 * unreachable, a stale cached value is served, and with no cache at all the site
 * stays online rather than locking everybody out.
 */
import { db } from "@/lib/db";

export interface MaintenanceFlag {
  enabled: boolean;
  message: string;
  updatedAt: string;
}

const DEFAULT_FLAG: MaintenanceFlag = { enabled: false, message: "", updatedAt: "" };
const TTL_MS = 5_000;

const store = globalThis as unknown as { okgsMaintenanceFlag?: MaintenanceFlag & { at: number } };

/** Public paths that stay reachable while the site is down. */
const EXEMPT_PREFIXES = [
  "/admin",
  // The fair panel stays open while the public site is under maintenance: a
  // locked `/sf` would stop the gate scanner mid-event, and `/sf` is behind its
  // own staff sign-in, so no visitor gets in by this exemption.
  "/sf",
  "/api",
  "/maintenance",
  "/_next",
  "/favicon.ico",
  "/icon",
  "/apple-icon",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
];

export function isExemptPath(pathname: string) {
  // Segment-exact: `/sf` is exempt, `/sfa-something` is not.
  return EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function invalidateMaintenanceCache() {
  delete store.okgsMaintenanceFlag;
}

export async function readMaintenanceFlag(): Promise<MaintenanceFlag> {
  const cached = store.okgsMaintenanceFlag;
  if (cached && Date.now() - cached.at < TTL_MS) {
    return { enabled: cached.enabled, message: cached.message, updatedAt: cached.updatedAt };
  }
  try {
    const result = await db.execute({
      sql: `SELECT "key", "value" FROM "settings" WHERE "key" IN (?, ?, ?)`,
      args: ["maintenance_mode", "maintenance_message", "maintenance_updated_at"],
    });
    const values = new Map(result.rows.map((row) => [String(row.key), String(row.value ?? "")]));
    const raw = String(values.get("maintenance_mode") ?? "").toLowerCase();
    const flag: MaintenanceFlag = {
      enabled: Boolean(raw) && !["0", "false", "off", "no", "না"].includes(raw),
      message: values.get("maintenance_message") ?? "",
      updatedAt: values.get("maintenance_updated_at") ?? "",
    };
    store.okgsMaintenanceFlag = { ...flag, at: Date.now() };
    return flag;
  } catch (error) {
    // Table missing (fresh database) or Turso hiccup — never lock the site out.
    if (cached) return { enabled: cached.enabled, message: cached.message, updatedAt: cached.updatedAt };
    console.warn("[maintenance] flag unreadable, assuming the site is open:", error instanceof Error ? error.message : error);
    return DEFAULT_FLAG;
  }
}

export const DEFAULT_MAINTENANCE_NOTICE =
  "সাইটটি এখন রক্ষণাবেক্ষণের কাজ চলছে। অনুগ্রহ করে কিছুক্ষণ পর আবার দেখুন।";
