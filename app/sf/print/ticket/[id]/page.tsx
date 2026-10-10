import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { activeFair, fairMode, readSetting } from "@/lib/site";
import { settingValue } from "@/lib/club-data";
import { qrDataUrl } from "@/lib/qr";
import { makeTicketToken, ticketExpiry } from "@/lib/ticket-token";
import { getStudentById } from "@/lib/student-db";
import { parseTicketLang, ticketDate, ticketFairName, ticketSchoolName, ticketValidUntil } from "@/lib/ticket-locale";
import { TicketSheet } from "@/components/sf/print/TicketSheet";
import { TicketToolbar } from "@/components/sf/print/TicketToolbar";
import { AutoPrint } from "@/components/print/AutoPrint";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Student ticket", robots: { index: false, follow: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * /sf/print/ticket/:id?fair=&copies=1..3&lang=en|bn|both&auto=0|1
 *
 * Full-screen portrait preview of the safe 95 × 137 mm ticket on A6 portrait paper, one
 * sheet per copy. The page is rendered on the server and prints as-is — no
 * client fetch, so the QR on paper is always the QR the backend signed.
 *
 * `lang` picks the sheet's language: `en` (default), `bn` or `both`. Every
 * label on the sheet follows it, so a sheet is never half-translated.
 *
 * The redesigned sheet carries the three-photo row (father · student ·
 * mother), the fair title above the photos, the signed QR bottom-left and the
 * Fair President's signature bottom-right. Validity is pinned to
 * 31 December 2026 for every ticket.
 */
export default async function StudentTicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const session = await getPortalSession();
  if (!session) redirect("/sf/login");

  const { id } = await params;
  const query = await searchParams;
  const student = await getStudentById(id);
  if (!student) notFound();
  const isOwnTicket = session.role === "student" && session.user.student_id && session.user.student_id.toUpperCase() === student.student_code.toUpperCase();
  if (!isStaffRole(session.role) && !isOwnTicket) notFound();

  const content = await getPublicContent();
  const mode = fairMode(content.settings);
  const fair = activeFair(content, String(query.fair ?? "") || mode.slug);
  const fairSlug = fair?.slug ?? String(query.fair ?? "");
  const copies = !isStaffRole(session.role) ? 1 : Math.min(3, Math.max(1, Math.floor(Number(query.copies ?? 1)) || 1));
  const lang = parseTicketLang(query.lang);

  const expiresAt = ticketExpiry(fair?.ends_on);
  const token = makeTicketToken({ k: "s", i: student.id, f: fairSlug, e: expiresAt });
  const qr = await qrDataUrl(token, { size: 520, margin: 4 });

  const schoolName = ticketSchoolName(readSetting(content.settings, "site_name_en") || settingValue(content.settings, "site_name"));
  const logo = readSetting(content.settings, "logo_url");
  const fairName = ticketFairName(fair);
  const validUntil = ticketValidUntil(lang);
  const issuedAt = ticketDate(new Date().toISOString(), lang, "long");
  const autoPrint = String(query.auto ?? "1") !== "0";

  const sheetProps = {
    kind: "student" as const,
    lang,
    schoolName,
    fairName,
    logo,
    student: {
      name: student.name,
      student_code: student.student_code,
      roll: student.roll,
      class_name: student.class_name,
      section: student.section,
      shift: student.shift,
      student_group: student.student_group,
      father_name: student.father_name,
      mother_name: student.mother_name,
      photo_url: student.photo_url,
      father_photo_url: student.father_photo_url,
      mother_photo_url: student.mother_photo_url,
    },
    qr,
    validUntil,
    issuedAt,
  };

  return (
    <main className="ticket-print-root v2" data-lang={lang}>
      <TicketToolbar
        copies={copies}
        fairSlug={fairSlug}
        auto={autoPrint}
        lang={lang}
        hint={`${schoolName} · ${fairName} — 95 × 137 mm card on A6 paper with 5 mm safe margins. Print at 100% / Actual size, ${copies} ${copies === 1 ? "card" : "cards"}. Nothing is saved in the browser; this page is the record.`}
      />
      <div className="ticket-sheets">
        {Array.from({ length: copies }, (_, index) => (
          <TicketSheet key={index} {...sheetProps} />
        ))}
      </div>
      {autoPrint ? <AutoPrint /> : null}
    </main>
  );
}
