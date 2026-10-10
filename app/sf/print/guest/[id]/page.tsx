import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { readSetting } from "@/lib/site";
import { settingValue } from "@/lib/club-data";
import { qrDataUrl } from "@/lib/qr";
import { makeTicketToken, ticketExpiry } from "@/lib/ticket-token";
import { getGuestById, getStudentById } from "@/lib/student-db";
import { parseTicketLang, ticketDate, ticketFairName, ticketSchoolName, ticketText, ticketValidUntil } from "@/lib/ticket-locale";
import { TicketSheet } from "@/components/sf/print/TicketSheet";
import { TicketToolbar } from "@/components/sf/print/TicketToolbar";
import { AutoPrint } from "@/components/print/AutoPrint";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guest entry ticket", robots: { index: false, follow: false } };

/**
 * /sf/print/guest/:id?fair= — A6 portrait entry ticket for a registered
 * outside guest: GUEST ENTRY tag, the tagged student’s father / guest / mother photos, Guest ID, the tagged
 * student, contact and status, signed QR bottom-left and the Fair
 * President's signature bottom-right.
 */
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
  // A guest ticket always belongs to its persisted fair, never a URL override.
  const fair = content.fairs.find((item) => item.slug === guest.fair_slug);
  if (!fair) notFound();
  const fairSlug = fair.slug;
  const lang = parseTicketLang(query.lang);
  const text = ticketText(lang);

  const expiresAt = ticketExpiry(fair?.ends_on);
  const token = makeTicketToken({ k: "g", i: guest.id, f: fairSlug, e: expiresAt });
  const qr = await qrDataUrl(token, { size: 520, margin: 4 });

  return (
    <main className="ticket-print-root v2" data-lang={lang}>
      <TicketToolbar
        copies={1}
        fairSlug={fairSlug}
        guestId={guest.id}
        auto={String(query.auto ?? "1") !== "0"}
        lang={lang}
        hint={`Guest entry ticket for ${guest.name} — 95 × 137 mm card on A6 portrait paper with 5 mm safe margins. Print at 100% / Actual size, 1 card.`}
      />
      <div className="ticket-sheets">
        <TicketSheet
          kind="guest"
          lang={lang}
          schoolName={ticketSchoolName(readSetting(content.settings, "site_name_en") || settingValue(content.settings, "site_name"))}
          fairName={ticketFairName(fair)}
          logo={readSetting(content.settings, "logo_url")}
          student={{
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
          }}
          guest={{
            id: guest.id,
            name: guest.name,
            relation: guest.relation,
            contact: guest.contact,
            status: guest.status,
            photo_url: guest.photo_url,
          }}
          qr={qr}
          validUntil={ticketValidUntil(lang)}
          issuedAt={ticketDate(new Date().toISOString(), lang, "long")}
        />
      </div>
      {String(query.auto ?? "1") !== "0" ? <AutoPrint /> : null}
    </main>
  );
}
