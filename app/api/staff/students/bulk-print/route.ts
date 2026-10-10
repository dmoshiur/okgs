import { defaultFairSlug, fail, ok, staff, str } from "@/lib/api";
import { logActivity } from "@/lib/portal-db";
import {
  createTicketPrintJob,
  paidStudentsForPrint,
  printableStudentCounts,
  recordTicketPrints,
} from "@/lib/student-db";
import { MAX_STUDENT_SELECTION, normalizeStudentIdentifiers, studentIdentifiersFromSearchParams } from "@/lib/student-selection";
import { parseRollExpression } from "@/lib/roll-range";

export const dynamic = "force-dynamic";

/** Four A6 portrait tickets occupy each physical A4 sheet. */
const TICKETS_PER_A4_SHEET = 4;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hasAny(source: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(source, key));
}

/**
 * POST /api/staff/students/bulk-print
 *
 * Accepts filters and explicit student IDs in either the JSON payload or query
 * string. Explicit IDs (database IDs or roster student codes) and roll ranges
 * are applied in SQL. With no explicit IDs/rolls, the requested class/search
 * scope is used; with no scope, all PAID roster students are included.
 *
 * Every job snapshots the exact matching PAID student IDs server-side. The
 * resulting short URL remains reliable for large selections, and the print view
 * cannot accidentally broaden a specific selection to the entire roster.
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const url = new URL(request.url);
  // A malformed selection must never silently become an unfiltered whole-roster job.
  if (request.headers.get("sec-fetch-site") === "cross-site") return fail("Cross-site print requests are not allowed.", 403);
  const text = await request.text();
  let value: unknown = {};
  if (text.trim()) {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return fail("Send print selections as JSON.", 415);
    try { value = JSON.parse(text); } catch { return fail("Send a valid JSON print selection.", 400); }
  } else if (!url.search) return fail("Provide a print selection or an explicit filter scope.", 422);
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("Send a JSON object with the print selection.", 422);
  const body = record(value);
  const nestedScope = record(body.scope);
  const queryIds = studentIdentifiersFromSearchParams(url.searchParams);

  const read = (keys: string[], queryKeys = keys, joinQueryValues = false) => {
    for (const source of [body, nestedScope]) {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
      }
    }
    for (const key of queryKeys) {
      const values = url.searchParams.getAll(key);
      if (values.length) return joinQueryValues ? values.join(",") : values[0];
    }
    return "";
  };

  const fair = str(read(["fair_slug", "fair"])) || (await defaultFairSlug());
  const scope = {
    class_name: str(read(["class_name", "class"])),
    section: str(read(["section"])),
    shift: str(read(["shift"])),
    rolls: str(read(["rolls", "roll"], ["rolls", "roll"], true)),
    q: str(read(["q", "search"])),
  };

  const bodyIdKeys = ["student_ids", "student_id", "selected_student_ids", "ids", "id"];
  const bodyHasIds = hasAny(body, bodyIdKeys) || hasAny(nestedScope, bodyIdKeys);
  let hasExplicitIds = bodyHasIds || queryIds.provided;
  let studentIds = bodyHasIds
    ? normalizeStudentIdentifiers(...bodyIdKeys.flatMap((key) => [body[key], nestedScope[key]]))
    : queryIds.ids;

  if (hasExplicitIds && !studentIds.length) return fail("Provide at least one valid student ID to print.", 422);
  if (studentIds.length > MAX_STUDENT_SELECTION) {
    return fail(`A single print selection can contain up to ${MAX_STUDENT_SELECTION.toLocaleString()} students.`, 422);
  }

  const parsedRolls = scope.rolls ? parseRollExpression(scope.rolls) : { rolls: new Set<string>(), error: "" };
  if (parsedRolls.error) return fail(parsedRolls.error, 422);

  const filter = {
    fair_slug: fair,
    class_name: scope.class_name,
    section: scope.section,
    shift: scope.shift,
    q: scope.q,
    rolls: parsedRolls.rolls,
    ...(hasExplicitIds ? { student_ids: studentIds } : {}),
  };

  const [counts, students] = await Promise.all([
    printableStudentCounts(filter),
    paidStudentsForPrint(filter),
  ]);
  if (!students.length) {
    return fail(
      counts.total
        ? `No PAID students in this selection — ${counts.unpaid} student(s) have not paid yet.`
        : "No students match this selection.",
      422,
    );
  }

  const printedIds = students.map((student) => student.id);
  const langValue = str(read(["lang"])).toLowerCase();
  const lang = langValue === "bn" || langValue === "both" ? langValue : "en";

  // Keep the exact paid roster snapshot out of the URL. This supports selections
  // of hundreds or thousands of students without request-line length limits.
  const jobId = await createTicketPrintJob({
    fair_slug: fair,
    student_ids: printedIds,
    class_name: scope.class_name,
    section: scope.section,
    shift: scope.shift,
    rolls: scope.rolls,
    q: scope.q,
    lang,
    created_by: session.user.id,
  });

  const recorded = await recordTicketPrints({
    fair_slug: fair,
    student_ids: printedIds,
    copies: 1,
    printed_by: session.user.id,
    printed_by_name: session.user.name,
  });

  const scopeLabel = hasExplicitIds
    ? `${printedIds.length} selected student(s)`
    : [scope.class_name, scope.section ? `section ${scope.section}` : "", scope.shift ? `${scope.shift} shift` : "", scope.rolls ? `rolls ${scope.rolls}` : "", scope.q ? `search ${scope.q}` : ""]
        .filter(Boolean)
        .join(" · ") || "whole roster";
  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: "tickets.bulk_print",
    entity: "students",
    entity_id: fair,
    detail: `${recorded} ticket(s) prepared · ${scopeLabel} · ${Math.max(0, counts.total - students.length)} unpaid excluded`,
  });

  const params = new URLSearchParams({ job: jobId });
  if (lang !== "en") params.set("lang", lang);

  return ok({
    url: `/sf/print/tickets?${params.toString()}`,
    paid: students.length,
    unpaid: Math.max(0, counts.total - students.length),
    total: counts.total,
    excluded: Math.max(0, counts.total - students.length),
    sheets_total: Math.ceil(students.length / TICKETS_PER_A4_SHEET),
    tickets_per_sheet: TICKETS_PER_A4_SHEET,
    recorded,
  });
}
