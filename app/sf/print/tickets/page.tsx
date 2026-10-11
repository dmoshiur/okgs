import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { activeFair, fairMode, readSetting } from "@/lib/site";
import { settingValue } from "@/lib/club-data";
import { qrSvgDataUrl } from "@/lib/qr";
import { makeTicketToken, ticketExpiry } from "@/lib/ticket-token";
import { openTicketPrintJob, paidStudentsForPrint, printableStudentCounts, type PrintableStudent, type TicketPrintJobLookup } from "@/lib/student-db";
import { MAX_BULK_PRINT_TICKETS, MAX_STUDENT_SELECTION, normalizeStudentIdentifiers } from "@/lib/student-selection";
import { parseRollExpression } from "@/lib/roll-range";
import { parseTicketLang, ticketFairName, ticketSchoolName, ticketText, type TicketLang } from "@/lib/ticket-locale";
import { ticketClubs, type TicketClub } from "@/lib/ticket-brand";
import { AutoPrint } from "@/components/print/AutoPrint";
import { TicketSheet } from "@/components/sf/print/TicketSheet";
import { BulkTicketToolbar } from "@/components/sf/print/BulkTicketToolbar";
import { TicketPrintNotice } from "@/components/sf/print/TicketPrintNotice";
import "@/components/sf/print/ticket-bulk.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bulk student tickets", robots: { index: false, follow: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;
type Query = Record<string, string | string[] | undefined>;

/** Four true-size A6 tickets are grouped on each physical A4 page. */
const TICKETS_PER_PAGE = 4;
const STUDENT_ID_QUERY_KEYS = ["student_ids", "student_id", "selected_student_ids", "ids", "id"] as const;
/** Signed concurrently, so a large job cannot monopolise the Node event loop. */
const QR_CONCURRENCY = 8;
/**
 * The print route's log tag. Every refusal and every unexpected failure writes
 * one line under it with the job id and a stable reference code, so a report like
 * `Error: 95868090` resolves to a sentence in the log instead of a stack trace.
 */
const LOG_TAG = "sf/print/tickets";

/** A job the operator can be told about; `code` is the reference in the log line. */
interface PrintRefusal {
  code: string;
  title: string;
  message: string;
  /** A damaged snapshot or a storage fault may be retried; a bad selection may not. */
  retryable: boolean;
}

interface TicketCard {
  student: PrintableStudent;
  qr: string;
}

interface BulkTicketView {
  lang: TicketLang;
  sheets: TicketCard[][];
  fairSlug: string;
  schoolName: string;
  fairName: string;
  logo: string;
  hint: string;
  warning: string;
  autoPrint: boolean;
  clubs: TicketClub[];
  emptySlotLabel: string;
}

type LoadedPrint = { ok: true; view: BulkTicketView } | { ok: false; refusal: PrintRefusal };

function one(value: unknown) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function queryHas(query: Query, keys: readonly string[]) {
  return keys.some((key) => query[key] !== undefined);
}

function queryStudentIds(query: Query) {
  const provided = queryHas(query, STUDENT_ID_QUERY_KEYS);
  const values = STUDENT_ID_QUERY_KEYS.flatMap((key) => {
    const value = query[key];
    return Array.isArray(value) ? value : value === undefined ? [] : [value];
  });
  return { provided, ids: normalizeStudentIdentifiers(...values) };
}

function queryValues(query: Query, keys: readonly string[]) {
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
        // QR encoding is CPU work. Yield between cards so a 500+ print job
        // cannot starve live canteen/gate requests on the same Node process.
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }),
  );
  return out;
}

/** Class/section/shift/roll/search scope, read from the job snapshot or the URL. */
function readScope(query: Query, job: TicketPrintJobLookup["job"]) {
  const rollsRaw = job?.rolls || queryValues(query, ["rolls", "roll"]);
  const parsed = rollsRaw ? parseRollExpression(rollsRaw) : { rolls: new Set<string>(), error: "" };
  return {
    error: parsed.error,
    rollsRaw,
    scope: {
      class_name: job?.class_name || one(query.class_name) || one(query.class),
      section: job?.section || one(query.section),
      shift: job?.shift || one(query.shift),
      q: job?.q || one(query.q) || one(query.search),
      rolls: parsed.rolls,
    },
  };
}

/**
 * A snapshot problem in words. A print link is a one-day snapshot, so "expired"
 * is the ordinary outcome of an old bookmark and must not read like a server
 * fault — while an unreachable database says "try again", and a damaged row
 * says "prepare it again" rather than showing a blank sheet.
 */
function refuseTicketJob(lookup: TicketPrintJobLookup, jobId: string): PrintRefusal {
  switch (lookup.state) {
    case "expired":
      return {
        code: "PRINT_JOB_EXPIRED",
        title: "This print selection has expired",
        message: "A bulk print selection stays available for one day. Open Students and prepare the selection again — the tickets themselves are unchanged.",
        retryable: false,
      };
    case "unreadable":
      return {
        code: "PRINT_JOB_UNREADABLE",
        title: "This print selection could not be read",
        message: "The saved selection is damaged, so no ticket was printed. Prepare it again from Students; if it keeps happening, quote the reference below.",
        retryable: true,
      };
    case "oversize":
      return {
        code: "PRINT_JOB_OVERSIZE",
        title: "This print selection is too large",
        message: `A single print selection may hold at most ${MAX_STUDENT_SELECTION.toLocaleString()} students. Print class by class, or prepare a smaller selection from Students.`,
        retryable: false,
      };
    case "storage":
      return {
        code: "PRINT_STORE_UNAVAILABLE",
        title: "The print selection cannot be opened right now",
        message: "The database that holds saved print selections did not answer. Nothing was printed — try again in a moment, and sign in again if the panel has gone idle.",
        retryable: true,
      };
    default:
      return {
        code: "PRINT_JOB_NOT_FOUND",
        title: "This print selection is not available",
        message: `No saved bulk selection matches this link${jobId ? ` (${jobId})` : ""}. It was probably prepared on another installation or has already been cleaned up. Open Students and prepare the selection again.`,
        retryable: false,
      };
  }
}

/** Retrying keeps the same job and the same ticket language. */
function retryHref(query: Query, requestedJobId: string) {
  const params = new URLSearchParams();
  if (requestedJobId) params.set("job", requestedJobId);
  for (const key of ["lang", "auto", "fair"]) {
    const value = one(query[key]);
    if (value) params.set(key, value);
  }
  return `/sf/print/tickets?${params.toString()}`;
}

/**
 * /sf/print/tickets?job=…&lang=&auto=…
 *
 * The print view fetches every matching PAID student in one selection and lays it
 * out as a continuous sequence of physical A4 page boxes; each box keeps the
 * 2 × 2 grid of the same safe 95 × 137 mm ticket. Rows arrive in bounded chunks
 * and QRs are signed under a fixed concurrency, so a class-sized job costs
 * steady time and memory instead of one unbounded query.
 *
 * For direct links, `ids`, `student_ids`, repeated `id` parameters and `rolls`
 * are also supported. An explicit empty/invalid selection never falls back to
 * the whole roster. Bulk POST jobs snapshot their exact selected IDs server-side
 * so 500+ IDs do not have to fit into a URL.
 *
 * Anything that can go wrong before paper is produced — a missing, expired,
 * damaged or oversized job, an empty selection, a database that will not answer —
 * ends on a screen-only notice with a reference code, never a 500 page.
 */
export default async function BulkTicketsPage({ searchParams }: { searchParams: Search }) {
  const session = await getPortalSession();
  if (!session) redirect("/sf/login?next=/sf/students");
  if (!isStaffRole(session.role)) redirect("/me");

  const query = await searchParams;
  const requestedJobId = one(query.job).trim();

  let result: LoadedPrint;
  try {
    result = await loadPrintView(query, requestedJobId);
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[${LOG_TAG}] render failed · job=${requestedJobId || "none"} · PRINT_RENDER_FAILED · ${detail}`);
    result = {
      ok: false,
      refusal: {
        code: "PRINT_RENDER_FAILED",
        title: "The tickets could not be prepared",
        message: "Something went wrong while the print sheet was being built, so nothing was sent to the printer. Try again; if it keeps happening, print class by class from Students and quote the reference below.",
        retryable: true,
      },
    };
  }

  if (result.ok) return <BulkTicketSheets view={result.view} />;

  const { refusal } = result;
  console.error(`[${LOG_TAG}] refused · job=${requestedJobId || "none"} · ${refusal.code}`);
  return (
    <main className="ticket-bulk-root" data-lang={parseTicketLang(one(query.lang))}>
      <TicketPrintNotice
        title={refusal.title}
        message={refusal.message}
        code={`${refusal.code}${requestedJobId ? ` · ${requestedJobId.slice(0, 8)}` : ""}`}
        actions={[
          { label: "Back to students", href: "/sf/students", primary: true },
          ...(refusal.retryable ? [{ label: "Try again", href: retryHref(query, requestedJobId) }] : []),
        ]}
      />
    </main>
  );
}

/**
 * Everything that touches the database for one print request, resolved before a
 * single ticket is rendered. Returns a refusal instead of throwing, so the
 * controller above can answer with a sentence — and the one `catch` in the
 * controller only has to deal with genuinely unexpected faults.
 */
async function loadPrintView(query: Query, requestedJobId: string): Promise<LoadedPrint> {
  const jobLookup = requestedJobId ? await openTicketPrintJob(requestedJobId) : null;
  if (jobLookup && jobLookup.state !== "ready") return { ok: false, refusal: refuseTicketJob(jobLookup, requestedJobId) };
  const job = jobLookup?.job ?? null;

  const content = await getPublicContent();
  const mode = fairMode(content.settings);
  const fairSlug = job?.fair_slug || one(query.fair) || mode.slug;
  const fair = activeFair(content, fairSlug);
  const lang: TicketLang = parseTicketLang(one(query.lang) || job?.lang);
  const text = ticketText(lang);

  const directSelection = queryStudentIds(query);
  if (directSelection.ids.length > MAX_STUDENT_SELECTION) {
    return {
      ok: false,
      refusal: {
        code: "PRINT_SELECTION_TOO_LARGE",
        title: "Too many students in this selection",
        message: `A single print selection may hold at most ${MAX_STUDENT_SELECTION.toLocaleString()} students. Print class by class, or prepare a smaller selection from Students.`,
        retryable: false,
      },
    };
  }

  const { error: rollError, rollsRaw, scope } = readScope(query, job);
  if (rollError) return { ok: false, refusal: { code: "PRINT_ROLL_EXPRESSION_INVALID", title: "The roll range could not be read", message: rollError, retryable: false } };

  // An explicit but empty selection, and a snapshot that resolved to nobody, are
  // both reported — neither ever widens to the whole roster.
  if (job && !job.student_ids.length) {
    return {
      ok: false,
      refusal: {
        code: "PRINT_JOB_EMPTY",
        title: "This print selection is empty",
        message: "The saved selection no longer holds a single student — they have left the roster, or the selection was cleared. Open Students and prepare it again.",
        retryable: false,
      },
    };
  }
  const emptyExplicitSelection = directSelection.provided && directSelection.ids.length === 0;
  if (emptyExplicitSelection) {
    return {
      ok: false,
      refusal: {
        code: "PRINT_SELECTION_EMPTY",
        title: "No students were selected",
        message: "This link asked for a print run with an empty student list, so nothing is being printed. Select the students in the panel and prepare the print job again.",
        retryable: false,
      },
    };
  }

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
        rolls: scope.rolls,
        ...(directSelection.provided ? { student_ids: directSelection.ids } : {}),
      };

  const counts = await printableStudentCounts(filter);
  if (!counts.paid) {
    // Two different empties: a selection nobody paid for, and a selection whose
    // students are gone. The second one needs no advice about fees.
    const empty = counts.total === 0;
    return {
      ok: false,
      refusal: {
        code: empty ? "PRINT_NO_MATCHING_STUDENTS" : "PRINT_NO_PAID_STUDENTS",
        title: empty ? (job ? "No students are left in this selection" : "No students match this scope") : "No ticket can be printed for this selection",
        message: empty
          ? job
            ? "The roster no longer holds any of the students in this selection — they were re-imported or removed. Open Students and prepare the selection again."
            : "No student in the roster matches this class, section, shift, roll range or search. Adjust the filters in Students and prepare the print job again."
          : job
            ? `None of the ${counts.total.toLocaleString()} student(s) in this selection has a PAID fee for this fair, and only paid students are printed. ${describeUnpaid(scope, counts)}`
            : `Nothing in this scope has a PAID fee for this fair, and only paid students are printed. ${describeUnpaid(scope, counts)}`,
        retryable: !empty,
      },
    };
  }
  // Decide the size limit on the count, before hundreds of rows and QR codes are
  // built: this is what stops an oversized job from exhausting memory mid-render.
  if (counts.paid > MAX_BULK_PRINT_TICKETS) {
    return {
      ok: false,
      refusal: {
        code: "PRINT_SELECTION_TOO_WIDE",
        title: "This print run is too large for one sheet set",
        message: `This selection holds ${counts.paid.toLocaleString()} paid students, and one run is limited to ${MAX_BULK_PRINT_TICKETS.toLocaleString()} tickets (${Math.ceil(MAX_BULK_PRINT_TICKETS / TICKETS_PER_PAGE).toLocaleString()} A4 pages) so the sheet reaches the printer instead of timing out. Narrow it to one class or shift, or prepare it in two runs.`,
        retryable: false,
      },
    };
  }

  const students = await paidStudentsForPrint(filter);
  const expiresAt = ticketExpiry(fair?.ends_on);
  const schoolName = ticketSchoolName(readSetting(content.settings, "site_name_en") || settingValue(content.settings, "site_name"));
  const logo = readSetting(content.settings, "logo_url");
  const fairName = ticketFairName(fair);

  // Sign every ticket QR without creating an unbounded burst of QR work. This
  // list is intentionally not sliced: every selected/matching student is kept.
  const cards = await mapLimit(students, QR_CONCURRENCY, async (student) => ({
    student,
    qr: await qrSvgDataUrl(makeTicketToken({ k: "s", i: student.id, f: fairSlug, e: expiresAt }), { margin: 4 }),
  }));

  const sheets: TicketCard[][] = [];
  for (let index = 0; index < cards.length; index += TICKETS_PER_PAGE) {
    sheets.push(cards.slice(index, index + TICKETS_PER_PAGE));
  }
  const total = cards.length;

  const scopeLabel = [
    scope.class_name,
    scope.section ? `${text.labels.section.primary} ${scope.section}` : "",
    scope.shift,
    scope.rolls.size ? `${text.labels.roll.primary} ${rollsRaw}` : "",
    scope.q ? `search ${scope.q}` : "",
    job || directSelection.provided ? `${total} selected` : "",
  ].filter(Boolean).join(" · ");
  const hint = `${schoolName} · ${fairName}${scopeLabel ? ` · ${scopeLabel}` : ""} — ${total} paid student(s), ${TICKETS_PER_PAGE} tickets per A4 page, ${sheets.length} A4 sheet(s) total. 5 mm safe margins; print at 100% / Actual size.`;
  const warning = counts.unpaid
    ? `${counts.unpaid} student(s) in this scope have not paid and are not printed. ${text.notes.paidOnly.primary}`
    : text.notes.paidOnly.primary;

  return {
    ok: true,
    view: {
      lang,
      sheets,
      fairSlug,
      schoolName,
      fairName,
      logo,
      hint,
      warning,
      autoPrint: one(query.auto) !== "0",
      clubs: ticketClubs(content.clubs),
      emptySlotLabel: text.notes.emptySlot.primary,
    },
  };
}

/** The one sentence that explains a selection with nobody paid in it. */
function describeUnpaid(scope: { class_name: string; section: string; shift: string }, counts: { total: number; paid: number; unpaid: number }) {
  const where = [scope.class_name, scope.section ? `section ${scope.section}` : "", scope.shift ? `${scope.shift} shift` : ""].filter(Boolean).join(" · ");
  const pending = `${counts.unpaid} of ${counts.total} student(s) are still marked UNPAID`;
  return where
    ? `In ${where}, ${pending} — mark the fee PAID in the roster to print their tickets.`
    : `${pending} — mark the fee PAID in the roster to print their tickets.`;
}

/** The paper itself: one A4 page box per four tickets, and nothing else. */
function BulkTicketSheets({ view }: { view: BulkTicketView }) {
  const { lang, sheets, fairSlug, hint, warning, autoPrint, schoolName, fairName, logo, clubs, emptySlotLabel } = view;
  const ticketCount = sheets.reduce((sum, group) => sum + group.length, 0);

  return (
    <main className="ticket-bulk-root" data-lang={lang}>
      <BulkTicketToolbar scope={{ fair: fairSlug }} lang={lang} sheets={sheets.length} auto={autoPrint} hint={hint} warning={warning} />
      {sheets.map((group, sheetIndex) => (
        <section className="ticket-bulk-page" key={sheetIndex} aria-label={`A4 sheet ${sheetIndex + 1} of ${sheets.length} — ticket ${sheetIndex * TICKETS_PER_PAGE + 1} to ${sheetIndex * TICKETS_PER_PAGE + group.length} of ${ticketCount}`}>
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
              clubs={clubs}
            />
          ))}
          {Array.from({ length: TICKETS_PER_PAGE - group.length }, (_, index) => (
            <div className="ticket-bulk-slot-empty" key={`empty-${index}`} aria-hidden="true">
              {emptySlotLabel}
            </div>
          ))}
        </section>
      ))}

      {autoPrint && ticketCount ? <AutoPrint /> : null}
    </main>
  );
}
