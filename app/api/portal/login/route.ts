import { NextResponse } from "next/server";
import { fail, str } from "@/lib/api";
import { ensurePortal } from "@/lib/portal-db";
import { clearPortalCookieHeader, loginWithPassword, PORTAL_COOKIE, SESSION_MAX_AGE, setPortalCookieHeader } from "@/lib/portal-auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/portal/login — email *or* school ID + password, for every role.
 *
 * No role is accepted from the client: the database decides, and the response
 * carries the dashboard that role owns (`redirect`).
 */
export async function POST(request: Request) {
  try {
    await ensurePortal();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const identifier = str(body.identifier || body.email || body.student_id);
    const password = String(body.password ?? "");

    if (!identifier || !password) return fail("আইডি/ইমেইল আর পাসওয়ার্ড দুটোই দিন।", 422);

    const limit = rateLimit(`portal-login:${identifier.toLowerCase()}`, { max: 8, windowMs: 10 * 60_000 });
    if (!limit.ok) return fail("অনেকবার ভুল চেষ্টা হয়েছে — কিছুক্ষণ পর আবার চেষ্টা করুন।", 429);

    const result = await loginWithPassword(identifier, password);
    if (!result.ok || !result.cookie || !result.user) return fail(result.error ?? "লগইন করা যায়নি।", 401);

    const response = NextResponse.json({
      ok: true,
      user: result.user,
      role: result.role,
      redirect: result.redirect ?? "/sf",
      warning: result.warning ?? "",
    });
    response.headers.append("Set-Cookie", setPortalCookieHeader(result.cookie, SESSION_MAX_AGE));
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

export { PORTAL_COOKIE };
