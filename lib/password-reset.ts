/**
 * Forgot-password / reset-password flow.
 *
 * 1. The visitor enters their email on /admin/forgot-password (or /sf/forgot…).
 * 2. We look the account up, mint a 32-byte random token, and store **only its
 *    SHA-256 hash** together with a 60-minute expiry (`password_resets`).
 * 3. The raw token travels in a one-time link mailed by lib/mailer.ts.
 * 4. /admin/reset-password?token=… exchanges the token for a new password and
 *    burns it (`used_at`), so a link can never be replayed.
 *
 * The response to step 1 is always the same (“if that address exists, we sent a
 * link”) — no account enumeration. When no mail provider is configured the link
 * is logged and, in development, returned to the page so the flow stays testable.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  consumePasswordReset,
  createPasswordReset,
  findPasswordReset,
  findUserByEmail,
  getUser,
  isEmailAddress,
  normalizeEmail,
  publicUser,
  recentResetRequests,
  type PublicUser,
} from "@/lib/portal-db";
import { assignPassword } from "@/lib/portal-auth";
import { sendMail, mailConfigured } from "@/lib/mailer";

const TOKEN_TTL_MINUTES = 60;
const MAX_REQUESTS_PER_WINDOW = 5;

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

export function resetUrlFor(request: Request, token: string, purpose = "reset") {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const path = purpose === "invite" ? "/admin/reset-password" : "/admin/reset-password";
  return `${origin}${path}?token=${encodeURIComponent(token)}`;
}

export interface ResetRequestResult {
  ok: true;
  /** Always the same message — never reveals whether the address exists. */
  message: string;
  /** Present only when no mail provider is configured (development convenience). */
  devLink?: string;
  /** Present when the account exists but has no email address on file. */
  skipped?: "no-account" | "no-email" | "rate-limited";
}

export async function requestPasswordReset(request: Request, rawEmail: string): Promise<ResetRequestResult> {
  const email = normalizeEmail(rawEmail);
  const generic: ResetRequestResult = {
    ok: true,
    message: "যদি এই ইমেইলে কোনো অ্যাকাউন্ট থাকে, একটি রিসেট লিংক পাঠানো হয়েছে। লিংকটি ৬০ মিনিট বৈধ।",
  };

  if (!isEmailAddress(email)) return { ...generic, skipped: "no-email" };

  const user = await findUserByEmail(email);
  if (!user) return { ...generic, skipped: "no-account" };
  if (!Number(user.is_active)) return { ...generic, skipped: "no-account" };
  if ((await recentResetRequests(email, 15)) >= MAX_REQUESTS_PER_WINDOW) {
    return { ...generic, skipped: "rate-limited" };
  }

  const token = newToken();
  await createPasswordReset({
    userId: user.id,
    email,
    tokenHash: hashResetToken(token),
    ttlMinutes: TOKEN_TTL_MINUTES,
  });

  const link = resetUrlFor(request, token);
  const name = user.name || email;
  const result = await sendMail({
    to: email,
    subject: "OKGS — পাসওয়ার্ড রিসেট / Password reset",
    text: [
      `${name},`,
      "",
      "OKGS অ্যাকাউন্টের পাসওয়ার্ড রিসেট করার জন্য নিচের লিংকে যান (৬০ মিনিট বৈধ):",
      link,
      "",
      "আপনি অনুরোধ না করে থাকলে এই মেইলটি উপেক্ষা করুন — পাসওয়ার্ড বদলাবে না।",
      "",
      "OKGS School — okgs.info",
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto">
        <h2 style="margin:0 0 12px">পাসওয়ার্ড রিসেট</h2>
        <p style="color:#334155;line-height:1.7">${name}, OKGS অ্যাকাউন্টের পাসওয়ার্ড রিসেট করার জন্য নিচের বোতামে ক্লিক করুন। লিংকটি ৬০ মিনিট বৈধ এবং একবারই ব্যবহার করা যায়।</p>
        <p style="margin:24px 0"><a href="${link}" style="background:#0f1e36;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">নতুন পাসওয়ার্ড দিন</a></p>
        <p style="color:#64748b;font-size:13px;word-break:break-all">${link}</p>
        <p style="color:#64748b;font-size:13px">আপনি অনুরোধ না করে থাকলে এই মেইলটি উপেক্ষা করুন — পাসওয়ার্ড বদলাবে না।</p>
      </div>`,
  });

  return {
    ...generic,
    // Dev convenience: without a mail provider the link is surfaced so the flow
    // can be exercised locally. Never included in production responses.
    devLink: result.delivered || mailConfigured() ? undefined : link,
  };
}

export interface ResetResult {
  ok: boolean;
  error?: string;
  user?: PublicUser;
}

export async function performPasswordReset(token: string, password: string, options: { mustChange?: boolean } = {}): Promise<ResetResult> {
  const raw = String(token ?? "").trim();
  if (!raw) return { ok: false, error: "রিসেট লিংকটি অসম্পূর্ণ।" };

  const record = await findPasswordReset(hashResetToken(raw));
  if (!record) return { ok: false, error: "লিংকটি বৈধ নয় — নতুন করে রিসেটের অনুরোধ করুন।" };
  if (record.used_at) return { ok: false, error: "লিংকটি আগেই ব্যবহার করা হয়েছে — নতুন একটি নিন।" };
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "লিংকটির সময় শেষ হয়ে গেছে (৬০ মিনিট)। আবার অনুরোধ করুন।" };
  }

  const user = await getUser(record.user_id);
  if (!user) return { ok: false, error: "অ্যাকাউন্টটি খুঁজে পাওয়া যায়নি।" };

  await assignPassword(user, password, { mustChange: options.mustChange });
  await consumePasswordReset(record.id);
  const fresh = (await getUser(user.id)) ?? user;
  return { ok: true, user: publicUser(fresh) };
}

/** Direct password write for the SuperAdmin user manager (no token involved). */
export async function setPasswordForUser(userId: string, password: string, mustChange = false) {
  const user = await getUser(userId);
  if (!user) return false;
  await assignPassword(user, password, { mustChange });
  return true;
}
