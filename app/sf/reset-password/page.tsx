"use client";

/**
 * /sf/reset-password?token=… — Bangla “choose a new password” page.
 * Shares the single-use token table with the admin reset flow.
 */
import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token")?.trim() ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    if (!token) setError("রিসেট লিংকটি অসম্পূর্ণ — নতুন করে অনুরোধ করুন।");
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("দুই ঘরে একই পাসওয়ার্ড লিখুন।");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error || "পাসওয়ার্ড বদলানো যায়নি।");
        return;
      }
      setDone(data.message ?? "পাসওয়ার্ড বদলানো হয়েছে।");
      window.setTimeout(() => router.push("/sf/login"), 2200);
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <p className="v2-chip v2-chip-accent">
          <CheckCircle2 size={14} /> সম্পন্ন
        </p>
        <h2 style={{ marginTop: 12 }}>পাসওয়ার্ড বদলানো হয়েছে</h2>
        <p className="v2-muted">{done}</p>
        <Link className="v2-btn" href="/sf/login">
          লগইনে যান <ArrowLeft size={15} />
        </Link>
      </>
    );
  }

  return (
    <>
      <p className="v2-chip v2-chip-accent">নতুন পাসওয়ার্ড</p>
      <h2 style={{ marginTop: 12 }}>পাসওয়ার্ড সেট করুন</h2>
      <p className="v2-muted">অন্তত ৮ অক্ষর, সঙ্গে অন্তত একটি অক্ষর ও একটি সংখ্যা রাখুন।</p>
      <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 18 }}>
        <div>
          <label className="v2-label" htmlFor="new-password">
            <KeyRound size={13} style={{ verticalAlign: -2 }} /> নতুন পাসওয়ার্ড
          </label>
          <div className="password-input">
            <input
              id="new-password"
              className="v2-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>
        <div>
          <label className="v2-label" htmlFor="confirm-password">
            <KeyRound size={13} style={{ verticalAlign: -2 }} /> আবার লিখুন
          </label>
          <input
            id="confirm-password"
            className="v2-input"
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        {password ? (
          <p className={`v2-muted portal-check ${password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password) ? "is-ok" : ""}`} style={{ fontSize: 12.5 }}>
            {password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password) ? (
              <>
                <CheckCircle2 size={13} /> পাসওয়ার্ডটি শক্তিশালী
              </>
            ) : (
              <>
                <AlertTriangle size={13} /> অন্তত ৮ অক্ষর, একটি অক্ষর ও একটি সংখ্যা দিন
              </>
            )}
          </p>
        ) : null}
        {error ? <p className="portal-error">{error}</p> : null}
        <button className="v2-btn" type="submit" disabled={busy || !token}>
          {busy ? <Loader2 size={16} className="spin" /> : <KeyRound size={16} />} {busy ? "সংরক্ষণ হচ্ছে…" : "পাসওয়ার্ড সেট করুন"}
        </button>
      </form>
      <p className="v2-muted" style={{ fontSize: 13, marginTop: 14 }}>
        <Link className="text-link" href="/sf/forgot-password">
          <ArrowLeft size={13} /> নতুন লিংক নিন
        </Link>
      </p>
    </>
  );
}

export default function PortalResetPasswordPage() {
  return (
    <div className="v2 portal-auth-single">
      <main className="portal-card" style={{ width: "min(460px, 100%)" }}>
        <Suspense fallback={<p className="v2-muted">লোড হচ্ছে…</p>}>
          <ResetForm />
        </Suspense>
      </main>
    </div>
  );
}
