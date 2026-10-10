import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { activeFair, fairMode, readSetting } from "@/lib/site";
import { settingValue } from "@/lib/club-data";
import { qrDataUrl } from "@/lib/qr";
import { makeTicketToken, ticketExpiry } from "@/lib/ticket-token";
import { activeGuestsForStudent, getGuestById, getPaymentStatus, getStudentById, lastAdmission } from "@/lib/student-db";
import { ticketDate, ticketFairName, ticketNumber, ticketSchoolName, ticketText, parseTicketLang } from "@/lib/ticket-locale";
import { TicketSheet } from "@/components/sf/print/TicketSheet";
import { TicketToolbar } from "@/components/sf/print/TicketToolbar";
import { AutoPrint } from "@/components/print/AutoPrint";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Student ticket", robots: { index: false, follow: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * /sf/print/ticket/:id?fair=&copies=1..3&guest=<guestId>&lang=en|bn|both&auto=0|1
 *
 * Full-screen portrait preview of the A4-portrait ticket, one sheet per copy.
 * The page is rendered on the server and prints as-is — no client fetch, so the
 * QR on paper is always the QR the backend signed.
 *
 * `lang` picks the sheet's language: `en` (default), `bn` or `both`. Every label,
 * badge and footer note follows it, so a sheet is never half-translated.
 *
 * Copy 1 is the student copy; from copy 2 the family block (father, mother and
 * every approved external guardian) is printed, which is what the gate checks
 * against a walk-in relative.
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
  const text = ticketText(lang);

  const guardians = await activeGuestsForStudent(id, fairSlug);
  const chosenId = String(query.guest ?? "");
  const guardianRow = chosenId ? guardians.find((item) => item.id === chosenId) ?? (await getGuestById(chosenId)) : null;
  const guardian = guardianRow && guardianRow.related_student_id === id && guardianRow.status === "active" ? guardianRow : null;

  const expiresAt = ticketExpiry(fair?.ends_on);
  const token = makeTicketToken({ k: "s", i: student.id, f: fairSlug, e: expiresAt });
  const [qr, paymentStatus, admittedAt] = await Promise.all([
    qrDataUrl(token, { size: 520 }),
    getPaymentStatus(student.id, fairSlug),
    lastAdmission(student.id, fairSlug),
  ]);

  const schoolName = ticketSchoolName(readSetting(content.settings, "site_name_en") || settingValue(content.settings, "site_name"));
  const logo = readSetting(content.settings, "logo_url");
  const fairName = ticketFairName(fair);
  const validUntil = ticketDate(new Date(expiresAt * 1000).toISOString(), lang, "long");
  const issuedAt = ticketDate(new Date().toISOString(), lang, "long");
  const copyLabels = text.titles.copies.map((copy) => copy.primary);
  const ticketCode = `${student.student_code} · ${text.labels.roll.primary} ${ticketNumber(student.roll, lang) || "—"}`;
  const autoPrint = String(query.auto ?? "1") !== "0";

  const sheetProps = {
    kind: "student" as const,
    lang,
    schoolName,
    fairName,
    logo,
    copyCount: copies,
    student: {
      name: student.name,
      student_code: student.student_code,
      roll: student.roll,
      class_name: student.class_name,
      section: student.section,
      shift: student.shift,
      student_group: student.student_group,
      branch: student.branch,
      father_name: student.father_name,
      mother_name: student.mother_name,
      photo_url: student.photo_url,
    },
    paymentStatus,
    guardian: guardian ? { name: guardian.name, relation: guardian.relation, contact: guardian.contact } : null,
    guardians: guardians.map((person) => ({ name: person.name, relation: person.relation, contact: person.contact })),
    admittedAt,
    qr,
    validUntil,
    issuedAt,
    ticketCode,
    printedBy: session.user.name,
  };

  return (
    <main className="ticket-print-root v2" data-lang={lang}>
      <TicketToolbar
        copies={copies}
        fairSlug={fairSlug}
        guestId={guardian?.id}
        auto={autoPrint}
        lang={lang}
        total={copyLabels}
        hint={`${schoolName} · ${fairName} — printed on A4 portrait, ${copies} ${copies === 1 ? "sheet" : "sheets"}. Nothing is saved in the browser; this page is the record.`}
      />
      <div className="ticket-sheets">
        {Array.from({ length: copies }, (_, index) => (
          <TicketSheet
            key={index}
            {...sheetProps}
            copyIndex={index + 1}
            copyLabel={copyLabels[index]}
            showFamily={copies >= 2 || index >= 1}
          />
        ))}
      </div>
      {autoPrint ? <AutoPrint /> : null}
    </main>
  );
}
