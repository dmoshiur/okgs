import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { getPublicContent } from "@/lib/db";
import { settingValue } from "@/lib/club-data";
import { activeFair, readSetting } from "@/lib/site";
import { LoginForm } from "@/components/portal/LoginForm";
import { SchoolLogo } from "@/components/public/SchoolLogo";
import { formatDateEn } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login — Science Fair & Club portal",
  robots: { index: false, follow: false },
};

/** /sf/login — one door for students, teachers, alumni and admins. */
export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const content = await getPublicContent();
  const fair = activeFair(content);
  // This door belongs to the staff panel, which is English end to end, so the
  // Bangla `portal_note` written for the public portal is deliberately not shown
  // here. The office can override this line with a `portal_note_en` setting.
  const note =
    readSetting(content.settings, "portal_note_en") ||
    "Sign in with your school ID or your email — the system recognises whether the account is a student, a teacher, a club admin or an administrator.";
  const logo = settingValue(content.settings, "logo_url");

  return (
    <div className="v2 portal-auth">
      <aside className="portal-auth-aside">
        <div>
          <SchoolLogo src={logo} name="OKGS" />
          <p className="fair-mega-kicker" style={{ marginTop: 26 }}>
            <Sparkles size={15} /> OKGS Digital portal
          </p>
          <h1 style={{ fontSize: "clamp(1.875rem, 4vw, 2.875rem)", margin: "14px 0 10px", lineHeight: 1.25 }}>
            {fair ? fair.name : "School & Club portal"}
          </h1>
          <p style={{ opacity: 0.9, maxWidth: "46ch" }}>
            Students, teachers, alumni and admins — one login for everyone. Dues, fund payments, QR passes and the full fair accounts in one place.
          </p>
        </div>
        <div style={{ display: "grid", gap: 12, marginTop: 30 }}>
          {fair?.starts_on ? (
            <p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, opacity: 0.92 }}>
              <CalendarClock size={16} /> {fair.name} · {formatDateEn(fair.starts_on)}
              {fair.ends_on && fair.ends_on !== fair.starts_on ? ` – ${formatDateEn(fair.ends_on)}` : ""}
            </p>
          ) : null}
          <p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, opacity: 0.92 }}>
            <GraduationCap size={16} /> Students, teachers, guardians and admins — the same login
          </p>
          <p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, opacity: 0.92 }}>
            <ShieldCheck size={16} /> No need to pick a role — the system recognises your account automatically
          </p>
          <Link className="v2-btn v2-btn-ghost" style={{ background: "rgba(255,255,255,.14)", color: "#fff", borderColor: "rgba(255,255,255,.34)", width: "fit-content" }} href="/">
            Back to the school site
          </Link>
        </div>
      </aside>

      <main className="portal-auth-main">
        <LoginForm note={note} next={next} fairName={fair?.name ?? ""} lang="en" />
      </main>
    </div>
  );
}
