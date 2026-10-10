import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { activeFair, fairMode, readSetting } from "@/lib/site";
import { settingValue } from "@/lib/club-data";
import { qrDataUrl } from "@/lib/qr";
import { makeTicketToken, ticketExpiry } from "@/lib/ticket-token";
import { getTicketPrintJob, paidStudentsForPrint, printableStudentCounts } from "@/lib/student-db";
import { MAX_STUDENT_SELECTION, normalizeStudentIdentifiers } from "@/lib/student-selection";
import { parseRollExpression } from "@/lib/roll-range";
import { parseTicketLang, ticketDate, ticketFairName, ticketSchoolName, ticketText, ticketValidUntil, type TicketLang } from "@/lib/ticket-locale";
import { AutoPrint } from "@/components/print/AutoPrint";
import { TicketSheet } from "@/components/sf/print/TicketSheet";
import { BulkTicketToolbar } from "@/components/sf/print/BulkTicketToolbar";
import "@/components/sf/print/ticket-bulk.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bulk student tickets", robots: { index: false, follow: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;

/** Four true-size A6 tickets are grouped on each physical A4 page. */
const TICKETS_PER_PAGE = 4;
const STUDENT_ID_QUERY_KEYS = ["student_ids", "student_id", "selected_student_ids", "ids", "id"] as const;

function one(value: unknown) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function queryHas(query: Record<string, string | string[] | undefined>, keys: readonly string[]) {
  return keys.some((key) => query[key] !== undefined);
}

function queryStudentIds(query: Record<string, string | string[] | undefined>) {
  const provided = queryHas(query, STUDENT_ID_QUERY_KEYS);
  const values = STUDENT_ID_QUERY_KEYS.flatMap((key) => {
    const value = query[key];
    return Array.isArray(value) ? value : value === undefined ? [] : [value];
  });
  return { provided, ids: normalizeStudentIdentifiers(...values) };
}

function queryValues(query: Record<string, string | string[] | undefined>, keys: readonly string[]) {
  return keys.flatMap((key) => {
    const value = query[key];
    return Array.isArray(value) ? value : value === undefined ? [] : [value];
  }).map((value) => String(value).trim()).filter(Boolean).join(",");
}

/** Bound concurrent QR creation while returning one complete, ordered array. */
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
 * /sf/print/tickets?job=…&lang=&auto=…
 *
 * The print view fetches every matching PAID student in one unpaginated query.
 * The DOM is a continuous sequence of physical A4 page boxes; each box keeps
 * the 2 × 2 grid of the same unmodified A6 portrait ticket.
 *
 * For direct links, `ids`, `student_ids`, repeated `id` parameters and `rolls`
 * are also supported. An explicit empty/invalid selection never falls back to
 * the whole roster. Bulk POST jobs snapshot their exact selected IDs server-side
 * so 500+ IDs do not have to fit into a URL.
 */
export default async function BulkTicketsPage({ searchParams }: { searchParams: Search }) {
  const session = await getPortalSession();
  if (!session) redirect("/sf/login?next=/sf/students");
  if (!isStaffRole(session.role)) redirect("/me");

  const query = await searchParams;
  const requestedJobId = one(query.job).trim();
  const job = requestedJobId ? await getTicketPrintJob(requestedJobId) : null;
  const invalidJob = Boolean(requestedJobId && !job);
  const directSelection = queryStudentIds(query);
  const tooManyIds = directSelection.ids.length > MAX_STUDENT_SELECTION;
  const emptyExplicitSelection = directSelection.provided && directSelection.ids.length === 0;

  const content = await getPublicContent();
  const mode = fairMode(content.settings);
  const fairSlug = job?.fair_slug || one(query.fair) || mode.slug;
  const fair = activeFair(content, fairSlug);
  const lang: TicketLang = parseTicketLang(one(query.lang) || job?.lang);
  const text = ticketText(lang);

  const scope = {
    class_name: job?.class_name || one(query.class_name) || one(query.class),
    section: job?.section || one(query.section),
    shift: job?.shift || one(query.shift),
    rolls: job?.rolls || queryValues(query, ["rolls", "roll"]),
    q: job?.q || one(query.q) || one(query.search),
  };
  const parsedRolls = scope.rolls ? parseRollExpression(scope.rolls) : { rolls: new Set<string>(), error: "" };
  const rollError = parsedRolls.error;
  const autoPrint = one(query.auto) !== "0";

  // A server-created print job is an exact ID snapshot. Direct IDs and roll
  // ranges are combined with any accompanying class/search filters in SQL.
  const filter = job
    ? { fair_slug: fairSlug, student_ids: job.student_ids }
    : {
        fair_slug: fairSlug,
        class_name: scope.class_name,
        section: scope.section,
        shift: scope.shift,
        q: scope.q,
        rolls: parsedRolls.rolls,
        ...(directSelection.provided ? { student_ids: directSelection.ids } : {}),
      };

  const invalidSelection = invalidJob || tooManyIds || emptyExplicitSelection;
  const counts = invalidSelection || rollError
    ? { total: 0, paid: 0, unpaid: 0 }
    : await printableStudentCounts(filter);
  const students = invalidSelection || rollError || !counts.paid
    ? []
    : await paidStudentsForPrint(filter);

  const expiresAt = ticketExpiry(fair?.ends_on);
  const validUntil = ticketValidUntil(lang);
  const issuedAt = ticketDate(new Date().toISOString(), lang, "long");
  const schoolName = ticketSchoolName(readSetting(content.settings, "site_name_en") || settingValue(content.settings, "site_name"));
  const logo = readSetting(content.settings, "logo_url");
  const fairName = ticketFairName(fair);

  // Sign every ticket QR without creating an unbounded burst of QR work. This
  // list is intentionally not sliced: every selected/matching student is kept.
  const cards = await mapLimit(students, 8, async (student) => ({
    student,
    qr: await qrDataUrl(makeTicketToken({ k: "s", i: student.id, f: fairSlug, e: expiresAt }), { size: 300, margin: 1 }),
  }));

  const sheets: (typeof cards)[] = [];
  for (let index = 0; index < cards.length; index += TICKETS_PER_PAGE) {
    sheets.push(cards.slice(index, index + TICKETS_PER_PAGE));
  }

  const scopeLabel = [
    scope.class_name,
    scope.section ? `${text.labels.section.primary} ${scope.section}` : "",
    scope.shift,
    scope.rolls ? `${text.labels.roll.primary} ${scope.rolls}` : "",
    scope.q ? `search ${scope.q}` : "",
    job || directSelection.provided ? `${students.length} selected` : "",
  ].filter(Boolean).join(" · ");
  const hint = students.length
    ? `${schoolName} · ${fairName}${scopeLabel ? ` · ${scopeLabel}` : ""} — ${students.length} paid student(s), ${TICKETS_PER_PAGE} tickets per A4 page, ${sheets.length} A4 sheet(s) total.`
    : `${schoolName} · ${fairName} — nothing to print for this selection.`;
  const warning = invalidJob
    ? "This bulk print selection has expired or is not available. Return to Students and prepare the selection again."
    : tooManyIds
      ? `A print selection can contain at most ${MAX_STUDENT_SELECTION.toLocaleString()} students.`
      : emptyExplicitSelection
        ? "No valid student IDs were provided; no students were selected."
        : rollError
          ? rollError
          : counts.unpaid
            ? `${counts.unpaid} student(s) in this scope have not paid and are not printed. ${text.notes.paidOnly.primary}`
            : text.notes.paidOnly.primary;

  const toolbarScope = { fair: fairSlug };

  return (
    <main className="ticket-bulk-root" data-lang={lang}>
      {students.length ? (
        <BulkTicketToolbar
          scope={toolbarScope}
          lang={lang}
          sheets={sheets.length}
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
        <section className="ticket-bulk-page" key={sheetIndex} aria-label={`A4 sheet ${sheetIndex + 1} of ${sheets.length} — ticket ${sheetIndex * TICKETS_PER_PAGE + 1} to ${sheetIndex * TICKETS_PER_PAGE + group.length} of ${cards.length}`}>
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
