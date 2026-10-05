"use client";

/**
 * /sf/forgot-password — Bangla password-reset request for the public portal.
 * The same token pipeline as the admin studio, so one link works everywhere.
 */
import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AtSign, CheckCircle2, Loader2, MailCheck, Send } from "lucide-react";

export default function PortalForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ message: string; devLink?: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string; devLink?: string };
      if (!response.ok || !data.ok) {
        setError(data.error || "অনুরোধটি সম্পন্ন করা যায়নি।");
        return;
      }
      setSent({ message: data.message ?? "আপনার ইমেইলে রিসেট লিংক পাঠানো হয়েছে।", devLink: data.devLink });
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="v2 portal-auth-single">
      <main className="portal-card" style={{ width: "min(460px, 100%)" }}>
        {sent ? (
          <>
            <p className="v2-chip v2-chip-accent">
              <MailCheck size={14} /> ইমেইল পাঠানো হয়েছে
            </p>
            <h2 style={{ marginTop: 12 }}>ইনবক্স দেখুন</h2>
            <p className="v2-muted">{sent.message}</p>
            {sent.devLink ? (
              <p className="v2-muted" style={{ fontSize: 13 }}>
                মেইল সার্ভার কনফিগার করা নেই (ডেভেলপমেন্ট), তাই লিংকটি এখানে দেওয়া হলো:{" "}
                <a className="text-link" href={sent.devLink}>
                  রিসেট লিংক খুলুন <CheckCircle2 size={13} />
                </a>
              </p>
            ) : null}
            <Link className="v2-btn v2-btn-ghost" href="/sf/login">
              <ArrowLeft size={15} /> লগইনে ফিরুন
            </Link>
          </>
        ) : (
          <>
            <p className="v2-chip v2-chip-accent">পাসওয়ার্ড রিসেট</p>
            <h2 style={{ marginTop: 12 }}>পাসওয়ার্ড ভুলে গেছেন?</h2>
            <p className="v2-muted">
              অ্যাকাউন্টের ইমেইল ঠিকানা দিন। ৬০ মিনিটের জন্য একটি একবার-ব্যবহারযোগ্য লিংক পাঠানো হবে।
            </p>
            <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 18 }}>
              <div>
                <label className="v2-label" htmlFor="email">
                  <AtSign size={13} style={{ verticalAlign: -2 }} /> ইমেইল ঠিকানা
                </label>
                <input
                  id="email"
                  className="v2-input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@okgs.info"
                  autoComplete="username"
                  required
                />
              </div>
              <button className="v2-btn" type="submit" disabled={busy}>
                {busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />} {busy ? "পাঠানো হচ্ছে…" : "রিসেট লিংক পাঠান"}
              </button>
            </form>
            {error ? <p className="portal-error">{error}</p> : null}
            <p className="v2-muted" style={{ fontSize: 13, marginTop: 14 }}>
              <Link className="text-link" href="/sf/login">
                <ArrowLeft size={13} /> লগইনে ফিরুন
              </Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
