"use client";

/**
 * /sf/forgot-password — password-reset request for the portal.
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
      const data = (await response.json()) as { ok?: boolean; message?: string; messageEn?: string; error?: string; errorEn?: string; devLink?: string };
      if (!response.ok || !data.ok) {
        // The staff panel is English-only: the API answers both languages.
        setError(data.errorEn || data.error || "The request could not be completed.");
        return;
      }
      setSent({ message: data.messageEn ?? data.message ?? "A reset link has been sent to your email.", devLink: data.devLink });
    } catch {
      setError("Network problem — please try again.");
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
              <MailCheck size={14} /> Email sent
            </p>
            <h2 style={{ marginTop: 12 }}>Check your inbox</h2>
            <p className="v2-muted">{sent.message}</p>
            {sent.devLink ? (
              <p className="v2-muted" style={{ fontSize: 13 }}>
                The mail server is not configured (development), so the link is shown here:{" "}
                <a className="text-link" href={sent.devLink}>
                  Open reset link <CheckCircle2 size={13} />
                </a>
              </p>
            ) : null}
            <Link className="v2-btn v2-btn-ghost" href="/sf/login">
              <ArrowLeft size={15} /> Back to login
            </Link>
          </>
        ) : (
          <>
            <p className="v2-chip v2-chip-accent">Password Reset</p>
            <h2 style={{ marginTop: 12 }}>Forgot password?</h2>
            <p className="v2-muted">
              Enter your student ID, email or phone. A one-time link valid for 60 minutes will be sent to your registered email. If no email is registered, contact the school office.
            </p>
            <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 18 }}>
              <div>
                <label className="v2-label" htmlFor="email">
                  <AtSign size={13} style={{ verticalAlign: -2 }} /> Student ID / email / phone
                </label>
                <input
                  id="email"
                  className="v2-input"
                  type="text"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="202408127 / name@okgs.info / +88019…"
                  autoComplete="username"
                  required
                />
              </div>
              <button className="v2-btn" type="submit" disabled={busy}>
                {busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />} {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            {error ? <p className="portal-error">{error}</p> : null}
            <p className="v2-muted" style={{ fontSize: 13, marginTop: 14 }}>
              <Link className="text-link" href="/sf/login">
                <ArrowLeft size={13} /> Back to login
              </Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
