import { defaultFairSlug, fail, ok, staff, str } from "@/lib/api";
import { logActivity } from "@/lib/portal-db";
import { paidStudentsForPrint, printableStudentCounts, recordTicketPrints } from "@/lib/student-db";
import { parseRollExpression } from "@/lib/roll-range";

export const dynamic = "force-dynamic";

/** Tickets per print run — a whole number of A4 pages, four tickets each. */
const TICKETS_PER_PAGE = 4;
const MAX_RUN = 100;
/** Audit rows written for one bulk job. A whole-school job is asked to narrow the scope. */
const MAX_JOB_ROWS = 500;

/**
 * POST /api/staff/students/bulk-print
 *
 * Body: `{ fair_slug?, class_name?, section?, shift?, rolls?, size?, page?, lang? }`
 *
 * Resolves the scope, reports how many students are PAID (and how many are
 * therefore excluded), writes one `ticket_prints` row per student in the job so
 * the audit log answers "who printed Class 8 and when", and returns the URL of
 * the A4 sheet for the browser to open.
 *
 * The PAID filter lives in the query, not in the client — an unpaid student can
 * never reach a printed ticket.
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const fair = str(body.fair_slug) || (await defaultFairSlug());
  const scope = {
    class_name: str(body.class_name),
    section: str(body.section),
    shift: str(body.shift),
    rolls: str(body.rolls),
  };

  const parsed = scope.rolls ? parseRollExpression(scope.rolls) : { rolls: new Set<string>(), error: "" };
  if (parsed.error) return fail(parsed.error, 422);

  const filter = { fair_slug: fair, ...scope, rolls: parsed.rolls };
  const counts = await printableStudentCounts(filter);
  if (!counts.paid) {
    return fail(
      counts.total
        ? `No PAID students in this scope — ${counts.unpaid} student(s) have not paid yet.`
        : "No students match this scope.",
      422,
    );
  }

  const size = Math.min(MAX_RUN, Math.max(TICKETS_PER_PAGE, Math.round((Number(body.size) || 20) / TICKETS_PER_PAGE) * TICKETS_PER_PAGE));
  // `runs` counts how many times the office presses print; `sheets` counts A4
  // pages (four tickets each). The two are different numbers and both are useful.
  const runs = Math.max(1, Math.ceil(counts.paid / size));
  const page = Math.min(runs, Math.max(1, Math.floor(Number(body.page) || 1)));
  const sheetsInRun = Math.ceil(Math.min(size, counts.paid - (page - 1) * size) / TICKETS_PER_PAGE);
  const lang = ["bn", "both"].includes(str(body.lang).toLowerCase()) ? str(body.lang).toLowerCase() : "";

  // The job covers the printed run; the audit write is capped so a whole-school
  // print cannot turn into a 5,000-row transaction.
  const jobStudents = await paidStudentsForPrint({ ...filter, limit: Math.min(size, MAX_JOB_ROWS), offset: (page - 1) * size });
  const recorded = await recordTicketPrints({
    fair_slug: fair,
    student_ids: jobStudents.map((student) => student.id),
    copies: 1,
    printed_by: session.user.id,
    printed_by_name: session.user.name,
  });

  const scopeLabel = [scope.class_name, scope.section ? `section ${scope.section}` : "", scope.shift ? `${scope.shift} shift` : "", scope.rolls ? `rolls ${scope.rolls}` : ""]
    .filter(Boolean)
    .join(" · ");
  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: "tickets.bulk_print",
    entity: "students",
    entity_id: fair,
    detail: `${recorded} ticket(s) printed · ${scopeLabel || "whole roster"} · ${counts.unpaid} unpaid excluded`,
  });

  const params = new URLSearchParams();
  if (fair) params.set("fair", fair);
  if (scope.class_name) params.set("class", scope.class_name);
  if (scope.section) params.set("section", scope.section);
  if (scope.shift) params.set("shift", scope.shift);
  if (scope.rolls) params.set("rolls", scope.rolls);
  if (size !== 20) params.set("size", String(size));
  if (page > 1) params.set("page", String(page));
  if (lang) params.set("lang", lang);

  return ok({
    url: `/sf/print/tickets?${params.toString()}`,
    paid: counts.paid,
    unpaid: counts.unpaid,
    total: counts.total,
    excluded: counts.unpaid,
    runs,
    run: page,
    sheets_in_run: sheetsInRun,
    sheets_total: Math.ceil(counts.paid / TICKETS_PER_PAGE),
    size,
    per_page: TICKETS_PER_PAGE,
    recorded,
  });
}
