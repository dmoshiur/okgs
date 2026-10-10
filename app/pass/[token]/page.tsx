import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { getPassByToken } from "@/lib/portal-db";
import { qrDataUrl } from "@/lib/qr";
import { activeFair } from "@/lib/site";
import { bn, formatDate } from "@/lib/format";
import { roleLabels, type PortalRole } from "@/lib/roles";
import { SchoolLogo } from "@/components/public/SchoolLogo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "বিজ্ঞান মেলা পাস",
  robots: { index: false, follow: false },
};

/** /pass/<token> — the printable QR card a student shows at the gate. */
export default async function PassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const pass = await getPassByToken(decodeURIComponent(token));
  if (!pass) notFound();

  const content = await getPublicContent();
  const fair = activeFair(content, pass.fair_slug);
  const qr = await qrDataUrl(`/pass/${pass.token}`, { size: 520, margin: 1, dark: "#0b3a25" });

  return (
    <main className="v2" style={{ minHeight: "100vh", background: "var(--okgs-surface-2)", padding: "34px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 16 }}>
        <div className="pass-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 8, minWidth: 220 }}>
              <SchoolLogo src={content.settings.find((s) => s.key === "logo_url")?.value} name="OKGS" />
              <div>
                <span className="fair-mega-kicker" style={{ background: "rgba(255,255,255,.16)" }}>
                  {fair?.name ?? "OKGS Science Fair"}
                </span>
              </div>
              <h1 style={{ margin: "6px 0 0", fontSize: 27 }}>{pass.holder_name}</h1>
              <p className="pass-meta" style={{ margin: 0 }}>
                <span>{roleLabels[pass.holder_role as PortalRole] ?? pass.holder_role}{pass.class_level ? ` · ${pass.class_level}` : ""}{pass.section ? ` (শাখা ${pass.section})` : ""}</span>
                {pass.student_id ? <span>আইডি: {pass.student_id}</span> : null}
                {pass.phone ? <span>মোবাইল: {pass.phone}</span> : null}
                <span>স্ট্যাটাস: {pass.status === "active" ? "সক্রিয়" : pass.status === "used" ? "ব্যবহৃত" : "বাতিল"} · স্ক্যান {bn(pass.scan_count)}</span>
                {fair?.starts_on ? <span>মেলা: {formatDate(fair.starts_on)}{fair.ends_on && fair.ends_on !== fair.starts_on ? ` – ${formatDate(fair.ends_on)}` : ""}</span> : null}
              </p>
            </div>
            <div className="pass-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`${pass.holder_name} এর QR পাস`} />
            </div>
          </div>
        </div>

        <div className="v2-card" style={{ padding: 18 }}>
          <p className="v2-muted" style={{ margin: 0 }}>
            এই QR পাসটি মেলার গেটে শিক্ষক/অ্যাডমিনের কাছে দেখান। স্ক্যানার দিয়ে QR স্ক্যান করলেই স্বয়ংক্রিয়ভাবে যাচাই হবে।
            পাস ছাপার দায়িত্ব বিদ্যালয় কর্তৃপক্ষের।
          </p>
          <p className="v2-muted" style={{ margin: "10px 0 0", fontSize: 12.5, wordBreak: "break-all" }}>
            টোকেন: {pass.token}
          </p>
        </div>
      </div>
    </main>
  );
}
