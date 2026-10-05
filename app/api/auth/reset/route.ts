/**
 * POST /api/auth/reset — exchange a reset token for a new password.
 *
 * Body: { token, password }
 * The token is single-use, expires after 60 minutes and is stored only as a
 * SHA-256 hash. On success the new password is written to the user row in the
 * primary database and the visitor can sign in immediately.
 */
import { NextResponse } from "next/server";
import { ensurePortal } from "@/lib/portal-db";
import { performPasswordReset } from "@/lib/password-reset";
import { passwordProblem } from "@/lib/portal-auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensurePortal();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");

    const limit = rateLimit(`reset:${request.headers.get("x-forwarded-for") ?? "local"}`, { max: 10, windowMs: 15 * 60_000 });
    if (!limit.ok) {
      return NextResponse.json(
        { error: "অনেকবার চেষ্টা করা হয়েছে — কিছুক্ষণ পর আবার করুন।", errorEn: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    const problem = passwordProblem(password);
    if (problem) {
      return NextResponse.json({ error: problem, errorEn: "Use at least 8 characters, with letters and numbers." }, { status: 422 });
    }

    const result = await performPasswordReset(token, password);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, errorEn: "That reset link is invalid or has already been used." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      email: result.user?.email ?? "",
      message: "পাসওয়ার্ড বদলানো হয়েছে — এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।",
      messageEn: "Password updated. Sign in with your new password.",
    });
  } catch (error) {
    console.error("[auth:reset]", error);
    return NextResponse.json(
      { error: "পাসওয়ার্ড বদলানো যায়নি — আবার চেষ্টা করুন।", errorEn: "The password could not be updated. Please try again." },
      { status: 500 },
    );
  }
}
