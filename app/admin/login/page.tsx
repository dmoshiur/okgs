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
        setError(data.error || "ইমেইল বা পাসওয়ার্ড সঠিক নয়।");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("অ্যাডমিন সার্ভারে যোগাযোগ করা যাচ্ছে না। আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page"><section className="login-art"><div className="login-art-shape shape-one" /><div className="login-art-shape shape-two" /><div className="login-art-shape shape-three" /><a className="login-brand" href="/"><span className="brand-mark"><span>ও</span></span><span><b>ওকেজিএস</b><small>কনটেন্ট স্টুডিও</small></span></a><div className="login-art-copy"><p className="eyebrow eyebrow-light"><span className="eyebrow-dot" />পেছনের কাজের জন্য একটি শান্ত জায়গা</p><h1>ভালো কাজ<br /><em>সবার সামনে</em><br />আনুন।</h1><p>স্কুলের খবর, নোটিশ ও কার্যক্রম এক জায়গা থেকে সহজে পরিচালনা করুন।</p></div><div className="login-art-footer"><span><Sparkles size={14} /> সম্পাদকীয় নিয়ন্ত্রণ কক্ষ</span><span>০১ / ০১</span></div></section><section className="login-form-side"><div className="login-form-wrap"><div className="login-mobile-brand"><a className="login-brand" href="/"><span className="brand-mark"><span>ও</span></span><span><b>ওকেজিএস</b><small>অ্যাডমিন স্টুডিও</small></span></a></div><div className="login-heading"><span className="login-kicker"><LockKeyhole size={14} /> নিরাপদ ওয়ার্কস্পেস</span><h2>স্বাগতম।</h2><p>ওমর কিন্ডারগার্টেন স্কুলের তথ্য আপডেট করতে লগইন করুন।</p></div><form className="login-form" onSubmit={submit}><label>ইমেইল ঠিকানা<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>পাসওয়ার্ড<div className="password-input"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>{error ? <p className="form-error">{error}</p> : null}<button className="button button-dark login-submit" type="submit" disabled={busy}>{busy ? "যাচাই হচ্ছে…" : "স্টুডিওতে প্রবেশ করুন"}<ArrowRight size={17} /></button></form><div className="login-note"><span>জেনে রাখুন</span><p>অ্যাডমিন তথ্য আপনার environment-এ সংরক্ষিত। লোকাল সেটআপে <code>.env.local</code> ফাইল দেখুন।</p></div><a className="back-home" href="/"><ArrowRight size={14} /> পাবলিক সাইটে ফিরুন</a></div></section></main>;
}
