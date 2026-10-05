/**
 * POST /api/auth/login — the single sign-in endpoint for the whole application.
 *
 * The client sends **email + password only**. The role is looked up in the
 * database and the response tells the browser where that role belongs, so the
 * login page never renders a role picker and can never be tricked into opening
 * a dashboard the account does not own.
 */
import { NextResponse } from "next/server";
import { loginWithPassword } from "@/lib/portal-auth";
import { LEGACY_ADMIN_COOKIE, PORTAL_COOKIE, SESSION_MAX_AGE, verifyPortalSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { ensureDatabase } from "@/lib/db";
import { ensurePortal } from "@/lib/portal-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // A first request on a brand-new database must be able to seed the
    // SuperAdmin before anybody can log in.
    await ensureDatabase();
    await ensurePortal();

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const email = String(body.email ?? body.identifier ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        {
          error: "ইমেইল ও পাসওয়ার্ড দুটোই দিন।",
          errorEn: "Enter both your email address and your password.",
        },
        { status: 422 },
      );
    }

    const limit = rateLimit(`login:${email}`, { max: 8, windowMs: 10 * 60_000 });
    if (!limit.ok) {
      return NextResponse.json(
        {
          error: "অনেকবার ভুল চেষ্টা হয়েছে — কিছুক্ষণ পর আবার চেষ্টা করুন।",
          errorEn: "Too many attempts. Please wait a few minutes and try again.",
        },
        { status: 429 },
      );
    }

    const result = await loginWithPassword(email, password);
    if (!result.ok || !result.cookie || !result.user || !result.role) {
      return NextResponse.json(
        {
          error: result.error ?? "লগইন করা যায়নি।",
          errorEn: /ঠিক নয়|wrong/i.test(result.error ?? "")
            ? "That email and password combination is not correct."
            : "Unable to sign in right now.",
        },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      role: result.role,
      redirect: result.redirect ?? "/",
      warning: result.warning ?? "",
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.role,
        designation: result.user.designation,
        photo_url: result.user.photo_url,
      },
    });

    response.headers.append(
      "Set-Cookie",
      `${PORTAL_COOKIE}=${result.cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`,
    );
    // Drop the pre-role studio cookie so only one session can ever be active.
    response.headers.append("Set-Cookie", `${LEGACY_ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return response;
  } catch (error) {
    console.error("[auth:login]", error);
    return NextResponse.json(
      { error: "লগইন করা যায়নি — আবার চেষ্টা করুন।", errorEn: "Unable to sign in right now. Please try again." },
      { status: 500 },
    );
  }
}

/** GET — “am I signed in, and as whom?” Used by the login pages and the studio. */
export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(/;\s*/).find((part) => part.startsWith(`${PORTAL_COOKIE}=`));
  const payload = verifyPortalSession(match?.slice(PORTAL_COOKIE.length + 1));
  return NextResponse.json({ authenticated: Boolean(payload), role: payload?.role ?? null });
}
