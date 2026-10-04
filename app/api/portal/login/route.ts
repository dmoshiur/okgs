import { NextResponse } from "next/server";
import { fail, str } from "@/lib/api";
import { ensurePortal } from "@/lib/portal-db";
import { clearPortalCookieHeader, loginWithPassword, PORTAL_COOKIE } from "@/lib/portal-auth";

export const dynamic = "force-dynamic";

/** POST /api/portal/login — email *or* school ID + password, for every role. */
export async function POST(request: Request) {
  try {
    await ensurePortal();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const identifier = str(body.identifier || body.email || body.student_id);
    const password = String(body.password ?? "");

    if (!identifier || !password) return fail("আইডি/ইমেইল আর পাসওয়ার্ড দুটোই দিন।", 422);

    const result = await loginWithPassword(identifier, password);
    if (!result.ok || !result.cookie || !result.user) return fail(result.error ?? "লগইন করা যায়নি।", 401);

    const response = NextResponse.json({
      ok: true,
      user: result.user,
      role: result.role,
      redirect: result.role === "student" || result.role === "alumni" ? "/me" : "/sf",
    });
    response.headers.append("Set-Cookie", `${PORTAL_COOKIE}=${result.cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`);
    return response;
  } catch (error) {
    console.error("[portal:login]", error);
    return fail("লগইন করা যায়নি — আবার চেষ্টা করুন।", 500);
  }
}

/** DELETE /api/portal/login — sign out. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", clearPortalCookieHeader());
  return response;
}
