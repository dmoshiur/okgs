import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { activeFair, fairMode, readSetting } from "@/lib/site";
import { settingValue } from "@/lib/club-data";
import { qrDataUrl } from "@/lib/qr";
import { makeTicketToken, ticketExpiry } from "@/lib/ticket-token";
import { paidStudentsForPrint, printableStudentCounts } from "@/lib/student-db";
import { parseRollExpression } from "@/lib/roll-range";
import { parseTicketLang, ticketDate, ticketFairName, ticketSchoolName, ticketText, ticketValidUntil, type TicketLang } from "@/lib/ticket-locale";
import { AutoPrint } from "@/components/print/AutoPrint";
import { TicketSheet } from "@/components/sf/print/TicketSheet";
import { BulkTicketToolbar } from "@/components/sf/print/BulkTicketToolbar";
import "@/components/sf/print/ticket-bulk.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bulk student tickets", robots: { index: false, follow: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;

/** Tickets per print run: always a whole number of A4 pages (4 tickets each). */
const MIN_RUN = 4;
const MAX_RUN = 100;
const TICKETS_PER_PAGE = 4;

function one(value: unknown) {
  const raw = value;
  return Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "");
}

/** Keep the CPU bounded while signing a hundred QR codes. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        out[index] = await fn(items[index], index);
      }
    }),
  );
  return out;
}

/**
 * /sf/print/tickets?fair=&class=&section=&shift=&rolls=&lang=&page=&size=&auto=
 *
 * The bulk ticket sheet: **only PAID students** are printed, four to an A4
 * portrait page in a 2 × 2 grid, with a page break after every page box.
 *
 * Four true-size A6 TicketSheets (105 × 148 mm) fill the A4 page exactly —
 * the 4-in-1 layout places the very same ticket template on the sheet without
 * breaking or re-styling it.
 *
 * Unpaid and pending students are excluded in the database query
 * (`paidStudentsForPrint`), never in the markup — a printed sheet is the office's
 * proof of payment, so the filter cannot be toggled away from the browser.
 */
export default async function BulkTicketsPage({ searchParams }: { searchParams: Search }) {
  const session = await getPortalSession();
  if (!session) redirect("/sf/login?next=/sf/students");
  if (!isStaffRole(session.role)) redirect("/me");

  const query = await searchParams;
  const content = await getPublicContent();
  const mode = fairMode(content.settings);
  const fair = activeFair(content, one(query.fair) || mode.slug);
  const fairSlug = fair?.slug ?? one(query.fair);
  const lang: TicketLang = parseTicketLang(one(query.lang));
  const text = ticketText(lang);

  const scope = {
    class_name: one(query.class),
    section: one(query.section),
    shift: one(query.shift),
    rolls: one(query.rolls),
  };
  const parsed = scope.rolls ? parseRollExpression(scope.rolls) : { rolls: new Set<string>(), error: "" };
  const rollError = parsed.error;

  const size = Math.min(MAX_RUN, Math.max(MIN_RUN, Math.round((Number(one(query.size)) || 20) / TICKETS_PER_PAGE) * TICKETS_PER_PAGE));
  const filter = { fair_slug: fairSlug, ...scope, rolls: parsed.rolls };

  const counts = rollError ? { total: 0, paid: 0, unpaid: 0 } : await printableStudentCounts(filter);
  /* Two different counts, and the toolbar must not confuse them:
     `runs`  — how many times the office has to press print for the whole scope
               (each run carries `size` tickets), and
     `sheets`— how many A4 pages *this* run prints, four tickets to a page. */
  const runs = Math.max(1, Math.ceil(counts.paid / size));
  const run = Math.min(runs, Math.max(1, Math.floor(Number(one(query.page)) || 1)));
  const totalSheets = Math.ceil(counts.paid / TICKETS_PER_PAGE);
  const autoPrint = one(query.auto) !== "0";

  const students = rollError || !counts.paid ? [] : await paidStudentsForPrint({ ...filter, limit: size, offset: (run - 1) * size });

  const expiresAt = ticketExpiry(fair?.ends_on);
  const validUntil = ticketValidUntil(lang);
  const issuedAt = ticketDate(new Date().toISOString(), lang, "long");
  const schoolName = ticketSchoolName(readSetting(content.settings, "site_name_en") || settingValue(content.settings, "site_name"));
  const logo = readSetting(content.settings, "logo_url");
  const fairName = ticketFairName(fair);

  // Sign one QR per student, on the server, so the paper always carries the QR
  // the backend issued. 300 px is plenty for the A6 bottom-left QR box and
  // keeps a four-ticket page light.
  const cards = await mapLimit(students, 8, async (student) => ({
    student,
    qr: await qrDataUrl(makeTicketToken({ k: "s", i: student.id, f: fairSlug, e: expiresAt }), { size: 300, margin: 1 }),
  }));

  const sheets: (typeof cards)[] = [];
  for (let index = 0; index < cards.length; index += TICKETS_PER_PAGE) sheets.push(cards.slice(index, index + TICKETS_PER_PAGE));

  const scopeLabel = [scope.class_name, scope.section ? `${text.labels.section.primary} ${scope.section}` : "", scope.shift].filter(Boolean).join(" · ");
  const hint = counts.paid
    ? `${schoolName} · ${fairName}${scopeLabel ? ` · ${scopeLabel}` : ""} — ${counts.paid} paid student(s), ${TICKETS_PER_PAGE} tickets per A4 page, ${sheets.length} A4 sheet(s) in this run${runs > 1 ? `, run ${run} of ${runs}` : ""}.`
    : `${schoolName} · ${fairName} — nothing to print for this scope.`;
  const warning = rollError
    ? rollError
    : counts.unpaid
      ? `${counts.unpaid} student(s) in this scope have not paid and are not printed. ${text.notes.paidOnly.primary}`
      : text.notes.paidOnly.primary;

  return (
    <main className="ticket-bulk-root" data-lang={lang}>
      {counts.paid ? (
        <BulkTicketToolbar
          scope={{ fair: fairSlug, ...scope }}
          lang={lang}
          run={run}
          runs={runs}
          sheets={sheets.length}
          totalSheets={totalSheets}
          size={size}
          auto={autoPrint}
          hint={hint}
          warning={warning}
        />
      ) : (
        <div className="ticket-bulk-toolbar no-print">
          <span className="ticket-bulk-hint">{hint}</span>
          <a className="ticket-bulk-print" href="/sf/students">
            Back to students
          </a>
          <p className="ticket-bulk-warning">{warning}</p>
        </div>
      )}

      {sheets.map((group, sheetIndex) => (
        <section className="ticket-bulk-page" key={`${run}-${sheetIndex}`} aria-label={`A4 sheet ${sheetIndex + 1} of ${sheets.length} — ticket ${sheetIndex * TICKETS_PER_PAGE + 1} to ${sheetIndex * TICKETS_PER_PAGE + group.length} of ${cards.length}`}>
          {group.map((card) => (
            <TicketSheet
              key={card.student.id}
              kind="student"
              lang={lang}
              schoolName={schoolName}
              fairName={fairName}
              logo={logo}
              student={{
                name: card.student.name,
                student_code: card.student.student_code,
                roll: card.student.roll,
                class_name: card.student.class_name,
                section: card.student.section,
                shift: card.student.shift,
                student_group: card.student.student_group,
                father_name: card.student.father_name,
                mother_name: card.student.mother_name,
                photo_url: card.student.photo_url,
                father_photo_url: card.student.father_photo_url,
                mother_photo_url: card.student.mother_photo_url,
              }}
              qr={card.qr}
              validUntil={validUntil}
              issuedAt={issuedAt}
            />
          ))}
          {Array.from({ length: TICKETS_PER_PAGE - group.length }, (_, index) => (
            <div className="ticket-bulk-slot-empty" key={`empty-${index}`} aria-hidden="true">
              {text.notes.emptySlot.primary}
            </div>
          ))}
        </section>
      ))}

      {autoPrint && cards.length ? <AutoPrint /> : null}
    </main>
  );
}
