import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { activeFair, fairMode, readSetting } from "@/lib/site";
import { settingValue } from "@/lib/club-data";
import { qrDataUrl } from "@/lib/qr";
import { makeTicketToken, ticketExpiry } from "@/lib/ticket-token";
import { getGuestById, getPaymentStatus, getStudentById, lastAdmission } from "@/lib/student-db";
import { parseTicketLang, ticketDate, ticketFairName, ticketSchoolName, ticketText } from "@/lib/ticket-locale";
import { TicketSheet } from "@/components/sf/print/TicketSheet";
import { TicketToolbar } from "@/components/sf/print/TicketToolbar";
import { AutoPrint } from "@/components/print/AutoPrint";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guest pass", robots: { index: false, follow: false } };

/** /sf/print/guest/:id?fair= — portrait pass for a registered outside guest. */
export default async function GuestPassPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getPortalSession();
  if (!session) redirect("/sf/login");
  if (!isStaffRole(session.role)) redirect("/me");

  const { id } = await params;
  const query = await searchParams;
  const guest = await getGuestById(id);
  if (!guest) notFound();
  const student = await getStudentById(guest.related_student_id);
  if (!student) notFound();

  const content = await getPublicContent();
  const mode = fairMode(content.settings);
  const fair = activeFair(content, String(query.fair ?? "") || mode.slug);
  const fairSlug = guest.fair_slug || fair?.slug || "";
  const lang = parseTicketLang(query.lang);
  const text = ticketText(lang);

  const expiresAt = ticketExpiry(fair?.ends_on);
  const token = makeTicketToken({ k: "g", i: guest.id, f: fairSlug, e: expiresAt });
  const [qr, paymentStatus, admittedAt] = await Promise.all([
    qrDataUrl(token, { size: 520 }),
    getPaymentStatus(student.id, fairSlug),
    lastAdmission(student.id, fairSlug),
  ]);

  return (
    <main className="ticket-print-root v2" data-lang={lang}>
      <TicketToolbar
        copies={1}
        fairSlug={fairSlug}
        guestId={guest.id}
        auto={String(query.auto ?? "1") !== "0"}
        lang={lang}
        total={[text.titles.guestCopy.primary]}
        hint={`Outside guest pass for ${guest.name} — printed on A4 portrait, 1 sheet.`}
      />
      <div className="ticket-sheets">
      <TicketSheet
        kind="guest"
        lang={lang}
        schoolName={ticketSchoolName(readSetting(content.settings, "site_name_en") || settingValue(content.settings, "site_name"))}
        fairName={ticketFairName(fair)}
        logo={readSetting(content.settings, "logo_url")}
        copyIndex={1}
        copyCount={1}
        copyLabel={text.titles.guestCopy.primary}
        showFamily={false}
        student={{
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
          photo_url: "",
        }}
        paymentStatus={paymentStatus}
        guardian={null}
        guest={{ name: guest.name, relation: guest.relation, contact: guest.contact, status: guest.status }}
        admittedAt={admittedAt}
        qr={qr}
        validUntil={ticketDate(new Date(expiresAt * 1000).toISOString(), lang, "long")}
        issuedAt={ticketDate(new Date().toISOString(), lang, "long")}
        ticketCode={`${text.titles.guestPass.primary} · ${guest.name}`}
        printedBy={session.user.name}
      />
      </div>
      {String(query.auto ?? "1") !== "0" ? <AutoPrint /> : null}
    </main>
  );
}
