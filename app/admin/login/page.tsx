"use client";

/**
 * /admin/login — single-field sign-in.
 *
 * There is deliberately **no role selector**: one email field and one password
 * field. `/api/auth/login` looks the account up in the database, resolves the
 * role and returns the dashboard that role owns (SuperAdmin/Admin → /admin,
 * Teacher/Staff → /sf, Club Admin → /clubs/<slug>/admin, Student/Alumni → /me).
 */
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, AtSign, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { AdminAuthShell } from "@/components/admin/AdminAuthShell";

interface SessionPayload {
  authenticated: boolean;
  redirect?: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Already signed in? Go straight to the dashboard this role owns.
  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json() as Promise<SessionPayload>)
      .then((data) => {
        if (data.authenticated && data.redirect) router.replace(data.redirect);
      })
      .catch(() => undefined);
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        errorEn?: string;
        error?: string;
        redirect?: string;
        role?: string;
        warning?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.errorEn || data.error || "That email and password combination is not correct.");
        return;
      }
      setNotice(data.warning ? `${data.warning} Signing you in…` : "Signed in — opening your dashboard…");
      router.push(data.redirect || "/admin");
      router.refresh();
    } catch {
      setError("The admin server could not be reached. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminAuthShell
      kicker="Secure workspace"
      title="Welcome back."
      subtitle="Sign in with the email address on your account. The system detects your role automatically."
      brandNote="Accounts live in the school database. Site settings and the maintenance switch belong to SuperAdmins only."
      footer={
        <div className="login-note">
          <span>Automatic routing</span>
          <p>
            SuperAdmin → Site settings, Maintenance Switch &amp; Accounts · Admin → Content Studio ·
            Teacher/Staff → Fair console · User (Student/Alumni) → Student portal.
          </p>
        </div>
      }
    >
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

        <label>
          Password
          <div className="password-input">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        <div className="login-form-row">
          <Link className="text-link" href="/admin/forgot-password">
            <KeyRound size={13} /> Forgot your password?
          </Link>
          <span className="login-form-hint">
            <ShieldCheck size={13} /> No role selection needed
          </span>
        </div>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="form-ok" role="status">
            {notice}
          </p>
        ) : null}

        <button className="button button-dark login-submit" type="submit" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className="spin" /> Verifying…
            </>
          ) : (
            <>
              Sign in to the studio <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
    </AdminAuthShell>
  );
}
