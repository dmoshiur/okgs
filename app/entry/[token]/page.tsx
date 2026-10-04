import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, GraduationCap, Palette, ScanLine } from "lucide-react";
import { getRow } from "@/lib/db";
import { parseEntryToken } from "@/lib/qr";
import type { FairCollection } from "@/lib/types";

export const dynamic = "force-dynamic";

type EntryProps = { params: Promise<{ token: string }> };

export const metadata: Metadata = { title: "প্রকল্প যাচাই", robots: { index: false, follow: false } };

/**
 * Public landing page for a project label's QR. A teacher scanning the printed
 * label with the phone camera lands here and sees exactly what the entry is —
 * then verifies it inside /sf/scan (which is what writes the audit trail).
 */
export default async function EntryVerifyPage({ params }: EntryProps) {
  const { token } = await params;
  const parsed = parseEntryToken(decodeURIComponent(token));
  if (!parsed) notFound();

  const row = (await getRow("fair_collections", parsed.id).catch(() => null)) as unknown as FairCollection | null;
  if (!row) notFound();

  const verified = String(row.note || "").includes("QR যাচাই");

  return (
    <main className="v2-wrap" style={{ padding: "48px 0 80px", display: "grid", gap: 18, maxWidth: 720 }}>
      <span className="v2-chip">QR যাচাই</span>
      <h1 style={{ margin: 0, fontSize: "clamp(26px, 5vw, 40px)" }}>{row.title}</h1>
      <div className="portfolio-note" style={{ display: "grid", gap: 8 }}>
        <p style={{ margin: 0 }}>
          <Palette size={15} /> {row.category || row.project_type} · <strong>{row.status}</strong>
        </p>
        <p style={{ margin: 0 }}>
          <GraduationCap size={15} /> {row.student_name || "শিক্ষার্থী"} {row.class_level ? `· ${row.class_level}` : ""}
          {row.section ? ` (শাখা ${row.section})` : ""}
        </p>
        {row.team_members ? <p style={{ margin: 0 }} className="v2-muted">দল: {row.team_members}</p> : null}
        <p className={verified ? "panel-ok" : "v2-muted"} style={{ margin: 0 }}>
          <BadgeCheck size={15} /> {verified ? "এই প্রকল্পটি স্ক্যান করে যাচাই করা হয়েছে।" : "এখনো স্ক্যান করে যাচাই করা হয়নি।"}
        </p>
      </div>
      {row.description ? <p style={{ lineHeight: 1.8 }}>{row.description}</p> : null}
      {row.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.image_url} alt={row.title} style={{ width: "100%", borderRadius: 18 }} />
      ) : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="v2-btn" href="/sf/scan">
          <ScanLine size={16} /> কনসোলে গিয়ে যাচাই করুন
        </Link>
        <Link className="v2-btn v2-btn-ghost" href={`/fair/${row.fair_slug}#collections`}>
          মেলার সংগ্রহ দেখুন
        </Link>
      </div>
    </main>
  );
}
