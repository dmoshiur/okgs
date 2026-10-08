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
import { formatDateEn } from "@/lib/format";
import { TicketSheet } from "@/components/sf/print/TicketSheet";
import { PrintButton } from "@/components/print/PrintButton";
import { AutoPrint } from "@/components/print/AutoPrint";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Student ticket", robots: { index: false, follow: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * /sf/print/ticket/:id?fair=&copies=1..3&guest=<guestId>
 * Landscape A4, one sheet per copy. Parents and the chosen external guardian are
 * printed from copy 2 onward.
 */
export default async function StudentTicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const session = await getPortalSession();
  if (!session) redirect("/sf/login");
  if (!isStaffRole(session.role)) redirect("/me");

  const { id } = await params;
  const query = await searchParams;
  const student = await getStudentById(id);
  if (!student) notFound();

  const content = await getPublicContent();
  const mode = fairMode(content.settings);
  const fair = activeFair(content, String(query.fair ?? "") || mode.slug);
  const fairSlug = fair?.slug ?? String(query.fair ?? "");
  const copies = Math.min(3, Math.max(1, Math.floor(Number(query.copies ?? 1)) || 1));

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

  const schoolName = settingValue(content.settings, "site_name", "OKGS");
  const logo = readSetting(content.settings, "logo_url");
  const fairName = fair?.name ?? "Science Fair";
  const validUntil = formatDateEn(new Date(expiresAt * 1000).toISOString(), "long");
  const issuedAt = formatDateEn(new Date().toISOString(), "long");
  const copyLabels = ["Student copy", "Parent copy", "School copy"];
  const ticketCode = `${student.student_code} · Roll ${student.roll || "—"}`;

  return (
    <main className="ticket-print-root v2">
      <div className="print-actions no-print ticket-toolbar">
        <PrintButton label="Print tickets" />
        <span>
          {copies} landscape {copies === 1 ? "sheet" : "sheets"} · {copyLabels.slice(0, copies).join(" · ")}
        </span>
      </div>
      {Array.from({ length: copies }, (_, index) => (
        <TicketSheet
          key={index}
          kind="student"
          schoolName={schoolName}
          fairName={fairName}
          logo={logo}
          copyIndex={index + 1}
          copyCount={copies}
          copyLabel={copyLabels[index]}
          showFamily={copies >= 2}
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
            photo_url: student.photo_url,
          }}
          paymentStatus={paymentStatus}
          guardian={guardian ? { name: guardian.name, relation: guardian.relation, contact: guardian.contact } : null}
          admittedAt={admittedAt}
          qr={qr}
          validUntil={validUntil}
          issuedAt={issuedAt}
          ticketCode={ticketCode}
          printedBy={session.user.name}
        />
      ))}
      <AutoPrint />
    </main>
  );
}
