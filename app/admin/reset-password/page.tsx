"use client";

/**
 * /admin/reset-password?token=… — set a new password.
 *
 * The token arrives by mail (or as a SuperAdmin invite link). It is verified
 * server-side, burned after a single use, and never echoed back to the page.
 */
import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { AdminAuthShell } from "@/components/admin/AdminAuthShell";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    if (!token) setError("This reset link is incomplete — request a new one.");
  }, [token]);

  const checks = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "Contains a letter", ok: /[A-Za-z]/.test(password) },
    { label: "Contains a number", ok: /\d/.test(password) },
    { label: "Both entries match", ok: Boolean(password) && password === confirm },
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Both passwords must match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await response.json()) as { ok?: boolean; messageEn?: string; message?: string; errorEn?: string; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.errorEn || data.error || "The password could not be updated.");
        return;
      }
      setDone(data.messageEn ?? "Password updated. Sign in with your new password.");
      window.setTimeout(() => router.push("/admin/login"), 2200);
    } catch {
      setError("The admin server could not be reached. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="auth-result">
        <span className="auth-result-icon is-ok">
          <CheckCircle2 size={22} />
        </span>
        <h3>Password updated</h3>
        <p>{done}</p>
        <p className="auth-result-actions">
          <Link className="text-link" href="/admin/login">
            Go to sign in <ArrowLeft size={13} />
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        New password
        <div className="password-input">
          <input
            type={showPassword ? "text" : "password"}
            name="new-password"
            autoComplete="new-password"
            placeholder="Choose a strong password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </label>

      <label>
        Confirm new password
        <div className="icon-input">
          <ShieldCheck size={16} aria-hidden="true" />
          <input
            type={showPassword ? "text" : "password"}
            name="confirm-password"
            autoComplete="new-password"
            placeholder="Type it again"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </div>
      </label>

      <ul className="auth-checks">
        {checks.map((check) => (
          <li key={check.label} className={check.ok ? "is-ok" : ""}>
            <span aria-hidden="true">{check.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}</span>
            {check.label}
          </li>
        ))}
      </ul>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="button button-dark login-submit" type="submit" disabled={busy || !token}>
        {busy ? (
          <>
            <Loader2 size={16} className="spin" /> Saving…
          </>
        ) : (
          <>
            <KeyRound size={16} /> Set the new password
          </>
        )}
      </button>

      <Link className="text-link" href="/admin/forgot-password">
        <ArrowLeft size={13} /> Request a new link
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AdminAuthShell
      kicker="Password reset"
      title="Choose a new password."
      subtitle="The link is single-use and expires 60 minutes after it was requested. Your role and permissions stay exactly the same."
    >
      <Suspense fallback={<p className="login-form-hint"><Loader2 size={14} className="spin" /> Loading the reset form…</p>}>
        <ResetForm />
      </Suspense>
    </AdminAuthShell>
  );
}
