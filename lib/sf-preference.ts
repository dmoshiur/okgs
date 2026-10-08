/**
 * Per-administrator preference: which fair the Science Fair panel is showing.
 *
 * The console used to keep this in React state, so opening another screen (or
 * reloading the scanner) silently jumped back to the default fair. It cannot live
 * in localStorage — this app stores state in the database or in a cookie, never in
 * browser storage — so the selection is a small signed-free cookie written by
 * `/api/staff/fair-preference`.
 */
import { cookies } from "next/headers";

export const SF_FAIR_COOKIE = "okgs_sf_fair";
const MAX_AGE = 60 * 60 * 24 * 365;

/** The slug from the cookie, or "" when it is missing/malformed. */
export async function readFairPreference(): Promise<string> {
  try {
    const store = await cookies();
    const value = String(store.get(SF_FAIR_COOKIE)?.value ?? "").trim();
    return /^[a-z0-9-]{2,64}$/i.test(value) ? value : "";
  } catch {
    return "";
  }
}

export function fairPreferenceCookieHeader(value: string) {
  const clean = /^[a-z0-9-]{2,64}$/i.test(String(value ?? "").trim()) ? String(value).trim() : "";
  return `${SF_FAIR_COOKIE}=${encodeURIComponent(clean)}; Path=/; SameSite=Lax; Max-Age=${
    clean ? MAX_AGE : 0
  }${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
