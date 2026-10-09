/**
 * Forgot-password / reset-password flow.
 *
 * 1. The visitor enters their email, student ID or phone on /admin/forgot-password (or /sf/forgot…).
 * 2. We look the account up, mint a 32-byte random token, and store **only its
 *    SHA-256 hash** together with a 60-minute expiry (`password_resets`).
 * 3. The raw token travels in a one-time link mailed by lib/mailer.ts.
 * 4. /admin/reset-password?token=… exchanges the token for a new password and
 *    burns it (`used_at`), so a link can never be replayed.
 *
 * The response to step 1 is always the same (“if that address exists, we sent a
 * link”) — no account enumeration. When no mail provider is configured the link
 * is, in development only, returned to the page so the flow stays testable.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  createPasswordReset,
  findPasswordReset,
  findUserByLogin,
  getUser,
  isEmailAddress,
  normalizeEmail,
  publicUser,
  recentResetRequests,
  type PublicUser,
} from "@/lib/portal-db";
import { db } from "@/lib/db";
import { assignPassword, hashPassword, passwordProblem } from "@/lib/portal-auth";
import { sendMail, mailAvailable } from "@/lib/mailer";

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
  /** Internal diagnostic only — never serialize this to the public API. */
  skipped?: "no-account" | "no-email" | "rate-limited";
}

export async function requestPasswordReset(request: Request, rawIdentifier: string): Promise<ResetRequestResult> {
  const identifier = rawIdentifier.trim();
  const generic: ResetRequestResult = {
    ok: true,
    message: "যদি এই পরিচয়ে নিবন্ধিত ইমেইলসহ কোনো অ্যাকাউন্ট থাকে, একটি রিসেট লিংক পাঠানো হয়েছে। লিংকটি ৬০ মিনিট বৈধ।",
  };

  const user = await findUserByLogin(identifier);
  if (!user) return { ...generic, skipped: "no-account" };
  const email = normalizeEmail(user.email);
  if (!isEmailAddress(email)) return { ...generic, skipped: "no-email" };
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
  const htmlName = escapeHtml(name);
  const htmlLink = escapeHtml(link);
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
        <p style="color:#334155;line-height:1.7">${htmlName}, OKGS অ্যাকাউন্টের পাসওয়ার্ড রিসেট করার জন্য নিচের বোতামে ক্লিক করুন। লিংকটি ৬০ মিনিট বৈধ এবং একবারই ব্যবহার করা যায়।</p>
        <p style="margin:24px 0"><a href="${htmlLink}" style="background:#0f1e36;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">নতুন পাসওয়ার্ড দিন</a></p>
        <p style="color:#64748b;font-size:13px;word-break:break-all">${htmlLink}</p>
        <p style="color:#64748b;font-size:13px">আপনি অনুরোধ না করে থাকলে এই মেইলটি উপেক্ষা করুন — পাসওয়ার্ড বদলাবে না।</p>
      </div>`,
  });

  return {
    ...generic,
    // Dev convenience: without a mail provider the link is surfaced so the flow
    // can be exercised locally. Never included in production responses.
    devLink: process.env.NODE_ENV === "development" && !result.delivered && !(await mailAvailable()) ? link : undefined,
  };
}

export interface ResetResult {
  ok: boolean;
  error?: string;
  user?: PublicUser;
}

export async function performPasswordReset(token: string, password: string, options: { mustChange?: boolean } = {}): Promise<ResetResult> {
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  const raw = String(token ?? "").trim();
  if (!raw) return { ok: false, error: "রিসেট লিংকটি অসম্পূর্ণ।" };

  const record = await findPasswordReset(hashResetToken(raw));
  if (!record) return { ok: false, error: "লিংকটি বৈধ নয় — নতুন করে রিসেটের অনুরোধ করুন।" };
  if (record.used_at) return { ok: false, error: "লিংকটি আগেই ব্যবহার করা হয়েছে — নতুন একটি নিন।" };
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "লিংকটির সময় শেষ হয়ে গেছে (৬০ মিনিট)। আবার অনুরোধ করুন।" };
  }

  const user = await getUser(record.user_id);
  if (!user || !Number(user.is_active)) return { ok: false, error: "অ্যাকাউন্টটি খুঁজে পাওয়া যায়নি।" };

  const { hash, salt } = hashPassword(password);
  // A single transactional batch avoids holding an interactive SQLite/Turso
  // write lock across awaited calls. Both writes re-check the live token.
  const now = new Date().toISOString();
  const statements = [
    {
      sql: `UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = ?, updated_at = ?
            WHERE id = ? AND is_active = 1 AND EXISTS (
              SELECT 1 FROM password_resets WHERE id = ? AND user_id = users.id AND used_at = '' AND expires_at > ?
            )`,
      args: [hash, salt, options.mustChange ? 1 : 0, now, user.id, record.id, now],
    },
    {
      sql: `UPDATE password_resets SET used_at = ? WHERE id = ? AND user_id = ? AND used_at = '' AND expires_at > ?
            AND EXISTS (SELECT 1 FROM users WHERE id = password_resets.user_id AND is_active = 1)`,
      args: [now, record.id, user.id, now],
    },
  ];
  let results;
  for (let attempt = 0; ; attempt++) {
    try { results = await db.batch(statements, "write"); break; }
    catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (attempt >= 3 || !["SQLITE_BUSY", "SQLITE_LOCKED"].includes(code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 30 * 2 ** attempt + Math.random() * 30));
    }
  }
  if (Number(results[0].rowsAffected) !== 1 || Number(results[1].rowsAffected) !== 1) {
    return { ok: false, error: "লিংকটি বৈধ নয় অথবা আগেই ব্যবহার করা হয়েছে।" };
  }
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
}
