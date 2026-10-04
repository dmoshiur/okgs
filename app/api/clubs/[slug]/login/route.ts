import { NextResponse } from "next/server";
import { fail, str } from "@/lib/api";
import { readClubFile, clubSiteSlugs } from "@/lib/club-sites";
import { clearPortalCookieHeader, loginWithPassword, PORTAL_COOKIE } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/clubs/<slug>/login
 *
 * Each club has its own admin. A login only succeeds when the account belongs to
 * *this* club (role `club` + matching `club_slug`) — or when it is a global
 * teacher/admin who may maintain every club.
 */
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const known = await clubSiteSlugs().catch(() => [] as string[]);
  const file = await readClubFile(slug).catch(() => null);
  if (!file && !known.includes(slug)) return fail("এই ক্লাবের সাইটটি পাওয়া যায়নি।", 404);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const identifier = str(body.identifier || body.email || body.student_id);
  const password = String(body.password ?? "");
  if (!identifier || !password) return fail("ইমেইল/আইডি আর পাসওয়ার্ড দুটোই দিন।", 422);

  const result = await loginWithPassword(identifier, password);
  if (!result.ok || !result.cookie || !result.user) return fail(result.error ?? "লগইন করা যায়নি।", 401);

  const ownClub = result.user.club_slug === slug;
  const global = isStaffRole(result.role || "");
  if (!ownClub && !global) {
    return fail("এই অ্যাকাউন্টটি অন্য ক্লাবের — নিজের ক্লাবের সাইটে লগইন করুন।", 403);
  }

  const response = NextResponse.json({ ok: true, user: result.user, role: result.role, slug });
  response.headers.append("Set-Cookie", `${PORTAL_COOKIE}=${result.cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`);
  return response;
}

/** DELETE /api/clubs/<slug>/login — sign out of the club admin. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", clearPortalCookieHeader());
  return response;
}
