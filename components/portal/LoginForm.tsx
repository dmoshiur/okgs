"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, IdCard, KeyRound, LogIn } from "lucide-react";

const roleHints = [
  { id: "student", label: "শিক্ষার্থী", hint: "স্কুল আইডি নম্বর দিয়ে লগইন — পাওনা, ফান্ড ও QR পাস দেখা যাবে।" },
  { id: "teacher", label: "শিক্ষক", hint: "সাইন-ইন করলে কনসোল, স্ক্যানার ও ফান্ড ব্যবস্থাপনা খুলে যাবে।" },
  { id: "admin", label: "অ্যাডমিন", hint: "সম্পূর্ণ নিয়ন্ত্রণ — ইউজার, থিম, মেলা মোড ও হিসাব।" },
];

export function LoginForm({ note, next, fairName }: { note: string; next?: string; fairName: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [hint, setHint] = useState(roleHints[0].id);
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
      setMessage(`সফল! ${data.role === "student" || data.role === "alumni" ? "আপনার ড্যাশবোর্ডে নেওয়া হচ্ছে…" : "কনসোলে নেওয়া হচ্ছে…"}`);
      const target = next || data.redirect || "/sf";
      router.push(target);
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  const active = roleHints.find((role) => role.id === hint) ?? roleHints[0];

  return (
    <div className="portal-card">
      <p className="v2-chip v2-chip-accent">{fairName ? `${fairName} · পোর্টাল` : "OKGS পোর্টাল"}</p>
      <h1 style={{ marginTop: 12 }}>লগইন করুন</h1>
      <p className="v2-muted" style={{ marginTop: 0 }}>ইমেইল অথবা স্কুল আইডি নম্বর — দুটোর যেকোনোটি ব্যবহার করা যাবে।</p>

      <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 18 }}>
        <div>
          <label className="v2-label" htmlFor="identifier">
            <IdCard size={13} style={{ verticalAlign: -2 }} /> ইমেইল / স্কুল আইডি
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
          <input
            id="password"
            className="v2-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="পাসওয়ার্ড"
            autoComplete="current-password"
            required
          />
        </div>

        <button className="v2-btn" type="submit" disabled={busy}>
          <LogIn size={17} /> {busy ? "যাচাই হচ্ছে…" : "লগইন"}
        </button>
      </form>

      {error ? <p className="portal-error">{error}</p> : null}
      {message ? <p className="portal-ok">{message}</p> : null}

      <div className="portal-role-grid" role="tablist" aria-label="ভূমিকা">
        {roleHints.map((role) => (
          <button
            key={role.id}
            type="button"
            className={`portal-role ${hint === role.id ? "is-on" : ""}`}
            onClick={() => setHint(role.id)}
          >
            {role.label}
          </button>
        ))}
      </div>
      <p className="v2-muted" style={{ fontSize: 13, marginTop: 10 }}>{active.hint}</p>

      {note ? <p className="v2-muted" style={{ fontSize: 13, marginTop: 14, borderTop: "1px dashed var(--okgs-line)", paddingTop: 12 }}>{note}</p> : null}
      <p className="v2-muted" style={{ fontSize: 13, marginTop: 10 }}>
        <AtSign size={12} style={{ verticalAlign: -1 }} /> পাসওয়ার্ড ভুলে গেলে ক্লাস টিচার অথবা অফিস থেকে রিসেট করান।
      </p>
    </div>
  );
}
