/** Shared helpers for every portal / staff API route. */
import { NextResponse } from "next/server";
import { getPortalSession, requireStaffSession, type PortalSession } from "@/lib/portal-auth";
import { listRows } from "@/lib/db";
import type { Fair } from "@/lib/types";

export const dynamic = "force-dynamic";

export function ok<T extends object>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Error text for the staff panel is English — the API answers the console, the
 * scanner and the ticket screens, and whatever is returned here is printed in a
 * red notice on those screens. (The public Bangla portal has its own messages.)
 */
export function errorResponse(error: unknown, tag: string) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") return fail("Please sign in again — your session has ended.", 401);
    if (error.message === "FORBIDDEN") return fail("Your account is not allowed to do this.", 403);
  }
  console.error(`[${tag}]`, error);
  return fail("Something went wrong while saving. Please try again.", 500);
}

export async function staff(): Promise<{ session: PortalSession } | NextResponse> {
  try {
    const session = await requireStaffSession();
    return { session };
  } catch {
    return fail("A teacher or administrator sign-in is needed for this part of the site.", 401);
  }
}

export async function currentSession() {
  return getPortalSession();
}

/** Active fair slugs, newest first — used as the default target for fair-scoped rows. */
export async function fairSlugs() {
  const fairs = (await listRows("fairs", { activeOnly: true })) as unknown as Fair[];
  return fairs.map((fair) => fair.slug).filter(Boolean);
}

export async function defaultFairSlug() {
  const slugs = await fairSlugs();
  return slugs[0] ?? "science-fair-2026";
}

export function num(value: unknown, fallback = 0) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function str(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value).trim();
}

export function boolFlag(value: unknown, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  return !["0", "false", "off", "no"].includes(String(value).toLowerCase());
}

/** Guards against ids arriving from the client in a bad shape. */
export function safeId(value: string) {
  return /^[0-9a-zA-Z-]{6,64}$/.test(value) ? value : "";
}
