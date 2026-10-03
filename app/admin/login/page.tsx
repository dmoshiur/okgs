"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@okgs.info");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.json()).then((data) => {
      if (data.authenticated) router.replace("/admin");
    }).catch(() => undefined);
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to sign in.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Could not reach the admin service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-art">
        <div className="login-art-shape shape-one" /><div className="login-art-shape shape-two" /><div className="login-art-shape shape-three" />
        <a className="login-brand" href="/"><span className="brand-mark"><span>O</span></span><span><b>OKGS</b><small>Content studio</small></span></a>
        <div className="login-art-copy"><p className="eyebrow eyebrow-light"><span className="eyebrow-dot" />The calm behind the scenes</p><h1>Make the<br /><em>good work</em><br />visible.</h1><p>One considered space for the stories, notices and people that make OKGS feel like OKGS.</p></div>
        <div className="login-art-footer"><span><Sparkles size={14} /> Editorial control room</span><span>01 / 01</span></div>
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <div className="login-mobile-brand"><a className="login-brand" href="/"><span className="brand-mark"><span>O</span></span><span><b>OKGS</b><small>Admin studio</small></span></a></div>
          <div className="login-heading"><span className="login-kicker"><LockKeyhole size={14} /> Secure workspace</span><h2>Welcome back.</h2><p>Sign in to shape what the OKGS community sees next.</p></div>
          <form className="login-form" onSubmit={submit}>
            <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<div className="password-input"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="button button-dark login-submit" type="submit" disabled={busy}>{busy ? "Checking access…" : "Enter studio"}<ArrowRight size={17} /></button>
          </form>
          <div className="login-note"><span>Good to know</span><p>Admin credentials are configured through your environment. If you are setting up OKGS locally, check your <code>.env.local</code>.</p></div>
          <a className="back-home" href="/"><ArrowRight size={14} /> Back to public site</a>
        </div>
      </section>
    </main>
  );
}
