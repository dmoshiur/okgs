/**
 * POST /api/auth/forgot — start the “Forgot password” flow.
 *
 * Body: { email }
 * Always answers 200 with the same message, whether or not the address exists,
 * so the endpoint cannot be used to enumerate accounts. In development, when no
 * mail provider is configured, the response also carries the reset link so the
 * flow can be tested end-to-end locally.
 */
import { NextResponse } from "next/server";
import { ensurePortal } from "@/lib/portal-db";
import { requestPasswordReset } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensurePortal();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const email = String(body.email ?? "").trim();

    const limit = rateLimit(`forgot:${request.headers.get("x-forwarded-for") ?? "local"}`, { max: 6, windowMs: 15 * 60_000 });
    if (!limit.ok) {
      return NextResponse.json(
        {
          error: "অনেকবার অনুরোধ করা হয়েছে — কিছুক্ষণ পর আবার চেষ্টা করুন।",
          errorEn: "Too many reset requests from this device. Please try again later.",
        },
        { status: 429 },
      );
    }

    const result = await requestPasswordReset(request, email);
    return NextResponse.json({
      ok: true,
      message: result.message,
      messageEn: "If an account exists for that address, a reset link is on its way. The link is valid for 60 minutes.",
      // Only ever present when no mail provider is configured (see lib/mailer.ts).
      devLink: result.devLink,
    });
  } catch (error) {
    console.error("[auth:forgot]", error);
    return NextResponse.json(
      { error: "অনুরোধটি সম্পন্ন করা যায়নি — আবার চেষ্টা করুন।", errorEn: "The request could not be completed. Please try again." },
      { status: 500 },
    );
  }
}
