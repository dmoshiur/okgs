import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { getPublicContent } from "@/lib/db";
import { settingValue } from "@/lib/club-data";
import { activeFair, readSetting } from "@/lib/site";
import { LoginForm } from "@/components/portal/LoginForm";
import { SchoolLogo } from "@/components/public/SchoolLogo";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "লগইন — বিজ্ঞান মেলা ও ক্লাব পোর্টাল",
  robots: { index: false, follow: false },
};

/** /sf/login — one door for students, teachers, alumni and admins. */
export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const content = await getPublicContent();
  const fair = activeFair(content);
  const note = readSetting(content.settings, "portal_note");
  const logo = settingValue(content.settings, "logo_url");

  return (
    <div className="v2 portal-auth">
      <aside className="portal-auth-aside">
        <div>
          <SchoolLogo src={logo} name="OKGS" />
          <p className="fair-mega-kicker" style={{ marginTop: 26 }}>
            <Sparkles size={15} /> OKGS ডিজিটাল পোর্টাল
          </p>
          <h1 style={{ fontSize: "clamp(30px, 4vw, 46px)", margin: "14px 0 10px", lineHeight: 1.12 }}>
            {fair ? fair.name : "স্কুল ও ক্লাব পোর্টাল"}
          </h1>
          <p style={{ opacity: 0.9, maxWidth: "46ch" }}>
            শিক্ষার্থী, শিক্ষক, প্রাক্তন শিক্ষার্থী ও অ্যাডমিন — সবার জন্য একটিই লগইন। পাওনা, ফান্ড জমা, QR পাস আর মেলার সম্পূর্ণ হিসাব এক জায়গায়।
          </p>
        </div>
        <div style={{ display: "grid", gap: 12, marginTop: 30 }}>
          {fair?.starts_on ? (
            <p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, opacity: 0.92 }}>
              <CalendarClock size={16} /> {fair.name} · {formatDate(fair.starts_on)}
              {fair.ends_on && fair.ends_on !== fair.starts_on ? ` – ${formatDate(fair.ends_on)}` : ""}
            </p>
          ) : null}
          <p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, opacity: 0.92 }}>
            <GraduationCap size={16} /> শিক্ষার্থী ও শিক্ষক — ID/ইমেইল দিয়ে লগইন
          </p>
          <p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, opacity: 0.92 }}>
            <ShieldCheck size={16} /> অ্যাডমিন ও হিসাবরক্ষক — একই লগইন, বাড়তি অনুমতি
          </p>
          <Link className="v2-btn v2-btn-ghost" style={{ background: "rgba(255,255,255,.14)", color: "#fff", borderColor: "rgba(255,255,255,.34)", width: "fit-content" }} href="/">
            স্কুল সাইটে ফিরুন
          </Link>
        </div>
      </aside>

      <main className="portal-auth-main">
        <LoginForm note={note} next={next} fairName={fair?.name ?? ""} />
      </main>
    </div>
  );
}
