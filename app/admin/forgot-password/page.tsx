"use client";

/**
 * /admin/forgot-password — request a reset link.
 *
 * The server never reveals whether the address exists; the page repeats the same
 * neutral confirmation. When no mail provider is configured (local development)
 * the API hands back the link so the flow can still be completed.
 */
import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AtSign, CheckCircle2, Loader2, MailCheck, Send } from "lucide-react";
import { AdminAuthShell } from "@/components/admin/AdminAuthShell";

export default function ForgotPasswordPage() {
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
      const data = (await response.json()) as {
        ok?: boolean;
        messageEn?: string;
        message?: string;
        errorEn?: string;
        error?: string;
        devLink?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.errorEn || data.error || "The request could not be completed.");
        return;
      }
      setSent({
        message: data.messageEn ?? "If an account exists for that address, a reset link is on its way.",
        devLink: data.devLink,
      });
    } catch {
      setError("The admin server could not be reached. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminAuthShell
      kicker="Password reset"
      title="Forgot your password?"
      subtitle="Enter the email address on your account and we will mail you a single-use link. The link stays valid for 60 minutes."
    >
      {sent ? (
        <div className="auth-result">
          <span className="auth-result-icon">
            <MailCheck size={22} />
          </span>
          <h3>Check your inbox</h3>
          <p>{sent.message}</p>
          {sent.devLink ? (
            <div className="login-note">
              <span>Development mode</span>
              <p>
                No mail provider is configured, so here is the link instead — it is never returned in production.
                <br />
                <a className="text-link" href={sent.devLink}>
                  Open the reset link <CheckCircle2 size={13} />
                </a>
              </p>
            </div>
          ) : null}
          <p className="auth-result-actions">
            <Link className="text-link" href="/admin/login">
              <ArrowLeft size={13} /> Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form className="login-form" onSubmit={submit}>
          <label>
            Email address
            <div className="icon-input">
              <AtSign size={16} aria-hidden="true" />
              <input
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                placeholder="you@okgs.info"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
              />
            </div>
          </label>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="button button-dark login-submit" type="submit" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={16} className="spin" /> Sending…
              </>
            ) : (
              <>
                Email me a reset link <Send size={16} />
              </>
            )}
          </button>

          <Link className="text-link" href="/admin/login">
            <ArrowLeft size={13} /> Back to sign in
          </Link>
        </form>
      )}
    </AdminAuthShell>
  );
}
