"use client";

/**
 * LoginForm — the portal sign-in used by `/sf/login` (staff) and `/me` (public).
 *
 * Deliberately **no role selector**: the account's role is read from the database
 * and the server answers with the dashboard that role owns.
 *
 * Language is a prop, not a guess: the public portal is Bangla, while every staff
 * door (`/sf`, `/admin`) is English-only, so the same form ships both copy sets
 * and picks the English error the API already returns (`errorEn`).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Eye, EyeOff, IdCard, KeyRound, LogIn } from "lucide-react";

type LoginLang = "bn" | "en";

const copy: Record<LoginLang, Record<string, string>> = {
  en: {
    chip: "OKGS portal",
    heading: "Sign in",
    lead: "Your student ID, email or phone — any one works. The system recognises your role (student, teacher, admin) by itself.",
    identifier: "Student ID / email / phone",
    identifierPlaceholder: "e.g. 202408127, name@okgs.info or +88019…",
    password: "Password",
    show: "Show password",
    hide: "Hide password",
    submit: "Sign in",
    checking: "Checking…",
    failed: "Sign-in failed.",
    network: "The server could not be reached. Check the connection and try again.",
    success: "Signed in — opening your dashboard…",
    forgot: "Forgot your password?",
    forgotLink: "reset it here",
    forgotTail: "— a single-use link will be emailed to you.",
  },
  bn: {
    chip: "OKGS পোর্টাল",
    heading: "লগইন করুন",
    lead: "ইমেইল, স্কুল আইডি অথবা ফোন নম্বর — যে কোনো একটি দিন। ভূমিকা (শিক্ষক/অ্যাডমিন/শিক্ষার্থী) সিস্টেম নিজেই বুঝে নেবে।",
    identifier: "শিক্ষার্থী আইডি / ইমেইল / ফোন",
    identifierPlaceholder: "যেমন: 2026-0012 অথবা name@okgs.info",
    password: "পাসওয়ার্ড",
    show: "পাসওয়ার্ড দেখুন",
    hide: "পাসওয়ার্ড লুকান",
    submit: "লগইন",
    checking: "যাচাই হচ্ছে…",
    failed: "লগইন করা যায়নি।",
    network: "নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।",
    success: "সফল! আপনার ড্যাশবোর্ডে নেওয়া হচ্ছে…",
    forgot: "পাসওয়ার্ড ভুলে গেলে",
    forgotLink: "এখান থেকে রিসেট করুন",
    forgotTail: "— ইমেইলে একটি একবার-ব্যবহারযোগ্য লিংক যাবে।",
  },
};

export function LoginForm({ note, next, fairName, lang = "bn" }: { note: string; next?: string; fairName: string; lang?: LoginLang }) {
  const router = useRouter();
  const text = copy[lang];
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
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        errorEn?: string;
        warning?: string;
        warningEn?: string;
        redirect?: string;
        role?: string;
      };
      if (!response.ok || !data.ok) {
        setError((lang === "en" ? data.errorEn || data.error : data.error || data.errorEn) || text.failed);
        return;
      }
      const warning = lang === "en" ? data.warningEn : data.warning;
      setMessage(warning ? `${text.success} ${warning}` : text.success);
      router.push(data.role === "student" || data.role === "alumni" ? "/me" : next?.startsWith("/") && !next.startsWith("//") ? next : data.redirect || "/sf");
      router.refresh();
    } catch {
      setError(text.network);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="portal-card">
      <p className="v2-chip v2-chip-accent">{fairName ? `${fairName} · ${lang === "en" ? "portal" : "পোর্টাল"}` : text.chip}</p>
      <h2 style={{ marginTop: 12 }}>{text.heading}</h2>
      <p className="v2-muted" style={{ marginTop: 0 }}>
        {text.lead}
      </p>

      <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 18 }}>
        <div>
          <label className="v2-label" htmlFor="identifier">
            <AtSign size={13} style={{ verticalAlign: -2 }} /> {text.identifier}
          </label>
          <input
            id="identifier"
            className="v2-input"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={text.identifierPlaceholder}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </div>
        <div>
          <label className="v2-label" htmlFor="password">
            <KeyRound size={13} style={{ verticalAlign: -2 }} /> {text.password}
          </label>
          <div className="password-input">
            <input
              id="password"
              className="v2-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={text.password}
              autoComplete="current-password"
              required
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? text.hide : text.show}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <button className="v2-btn" type="submit" disabled={busy}>
          <LogIn size={17} /> {busy ? text.checking : text.submit}
        </button>
      </form>

      {error ? <p className="portal-error">{error}</p> : null}
      {message ? <p className="portal-ok">{message}</p> : null}

      <p className="v2-muted" style={{ fontSize: 13, marginTop: 14 }}>
        <IdCard size={12} style={{ verticalAlign: -1 }} /> {text.forgot}{" "}
        <a className="text-link" href="/sf/forgot-password">
          {text.forgotLink}
        </a>{" "}
        {text.forgotTail}
      </p>

      {note ? <p className="v2-muted" style={{ fontSize: 13, marginTop: 14, borderTop: "1px dashed var(--okgs-line)", paddingTop: 12 }}>{note}</p> : null}
    </div>
  );
}
