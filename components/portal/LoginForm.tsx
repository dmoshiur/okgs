"use client";

/**
 * LoginForm — the public portal sign-in (/sf/login, /me).
 *
 * Deliberately **no role selector**: the account's role is read from the database
 * and the server answers with the dashboard that role owns. This form speaks
 * Bangla because the portal is a public page; the admin studio has its own
 * English sign-in at /admin/login.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Eye, EyeOff, IdCard, KeyRound, LogIn } from "lucide-react";

export function LoginForm({ note, next, fairName }: { note: string; next?: string; fairName: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; redirect?: string; role?: string };
      if (!response.ok || !data.ok) {
        setError(data.error || "লগইন করা যায়নি।");
        return;
      }
      setMessage("সফল! আপনার ড্যাশবোর্ডে নেওয়া হচ্ছে…");
      router.push(next || data.redirect || "/sf");
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="portal-card">
      <p className="v2-chip v2-chip-accent">{fairName ? `${fairName} · পোর্টাল` : "OKGS পোর্টাল"}</p>
      <h2 style={{ marginTop: 12 }}>লগইন করুন</h2>
      <p className="v2-muted" style={{ marginTop: 0 }}>
        ইমেইল অথবা স্কুল আইডি নম্বর — যে কোনো একটি দিন। ভূমিকা (শিক্ষক/অ্যাডমিন/শিক্ষার্থী) সিস্টেম নিজেই বুঝে নেবে।
      </p>

      <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 18 }}>
        <div>
          <label className="v2-label" htmlFor="identifier">
            <AtSign size={13} style={{ verticalAlign: -2 }} /> ইমেইল / স্কুল আইডি
          </label>
          <input
            id="identifier"
            className="v2-input"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="যেমন: 2026-0012 অথবা name@okgs.info"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="v2-label" htmlFor="password">
            <KeyRound size={13} style={{ verticalAlign: -2 }} /> পাসওয়ার্ড
          </label>
          <div className="password-input">
            <input
              id="password"
              className="v2-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="পাসওয়ার্ড"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <button className="v2-btn" type="submit" disabled={busy}>
          <LogIn size={17} /> {busy ? "যাচাই হচ্ছে…" : "লগইন"}
        </button>
      </form>

      {error ? <p className="portal-error">{error}</p> : null}
      {message ? <p className="portal-ok">{message}</p> : null}

      <p className="v2-muted" style={{ fontSize: 13, marginTop: 14 }}>
        <IdCard size={12} style={{ verticalAlign: -1 }} /> পাসওয়ার্ড ভুলে গেলে{" "}
        <a className="text-link" href="/sf/forgot-password">
          এখান থেকে রিসেট করুন
        </a>{" "}
        — ইমেইলে একটি একবার-ব্যবহারযোগ্য লিংক যাবে।
      </p>

      {note ? <p className="v2-muted" style={{ fontSize: 13, marginTop: 14, borderTop: "1px dashed var(--okgs-line)", paddingTop: 12 }}>{note}</p> : null}
    </div>
  );
}
