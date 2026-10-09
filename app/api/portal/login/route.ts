import { NextResponse } from "next/server";
import { fail, str } from "@/lib/api";
import { ensurePortal } from "@/lib/portal-db";
import { clearPortalCookieHeader, loginWithPassword, PORTAL_COOKIE, SESSION_MAX_AGE, setPortalCookieHeader } from "@/lib/portal-auth";
import { loginIdentifierKey } from "@/lib/login-identifier";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/portal/login — email *or* school ID + password, for every role.
 *
 * No role is accepted from the client: the database decides, and the response
 * carries the dashboard that role owns (`redirect`).
 *
 * Every failure answers with both languages (`error` for the public Bangla
 * portal, `errorEn` for the English staff panel) plus a stable `code`, so a form
 * can translate without pattern-matching prose.
 */
export async function POST(request: Request) {
  try {
    await ensurePortal();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const identifier = str(body.identifier || body.email || body.student_id || body.phone);
    const password = String(body.password ?? "");

    if (!identifier || !password) {
      return NextResponse.json(
        {
          ok: false,
          code: "missing_fields",
          error: "আইডি/ইমেইল আর পাসওয়ার্ড দুটোই দিন।",
          errorEn: "Enter your student ID, email or phone and your password.",
        },
        { status: 422 },
      );
    }

    const limit = rateLimit(`login:${loginIdentifierKey(identifier)}`, { max: 8, windowMs: 10 * 60_000 });
    if (!limit.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: "rate_limited",
          error: "অনেকবার ভুল চেষ্টা হয়েছে — কিছুক্ষণ পর আবার চেষ্টা করুন।",
          errorEn: "Too many attempts. Please wait a few minutes and try again.",
        },
        { status: 429 },
      );
    }

    const result = await loginWithPassword(identifier, password);
    if (!result.ok || !result.cookie || !result.user) {
      return NextResponse.json(
        {
          ok: false,
          code: result.errorEn?.includes("disabled") ? "account_disabled" : result.errorEn?.includes("no password") ? "no_password" : "invalid_credentials",
          error: result.error ?? "লগইন করা যায়নি।",
          errorEn: result.errorEn ?? "Unable to sign in right now.",
        },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      user: result.user,
      role: result.role,
      redirect: result.redirect ?? "/sf",
      warning: result.warning ?? "",
      warningEn: result.warningEn ?? "",
    });
    response.headers.append("Set-Cookie", setPortalCookieHeader(result.cookie, SESSION_MAX_AGE));
    return response;
  } catch (error) {
    console.error("[portal:login]", error);
    return NextResponse.json(
      { ok: false, code: "server_error", error: "লগইন করা যায়নি — আবার চেষ্টা করুন।", errorEn: "Unable to sign in right now. Please try again." },
      { status: 500 },
    );
  }
}

/** DELETE /api/portal/login — sign out. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", clearPortalCookieHeader());
  return response;
}

export { PORTAL_COOKIE };
