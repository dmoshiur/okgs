import { defaultFairSlug, fail, ok, staff, str } from "@/lib/api";
import { countStudents, listStudentsWithStatus, studentFilterOptions, studentStatusCounts } from "@/lib/student-db";
import { parseRollExpression } from "@/lib/roll-range";

export const dynamic = "force-dynamic";

/** Rows per page. 50 keeps the DOM small; the table asks for the next page on scroll. */
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * GET /api/staff/students — the class-wise roster with payment status.
 *
 * Query: fair, class, section, shift, q, payment (paid|unpaid), rolls
 * ("1, 2, 5, 12-15"), page, page_size.
 *
 * Paginated on purpose: a 1,200-row roster used to be sent in one response and
 * painted in one table, which is what made the panel feel stuck. `summary` is
 * aggregated in SQL over the *whole* filter, so the header figures stay correct
 * for the class while only one page of rows crosses the wire.
 */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const url = new URL(request.url);
  const fair = str(url.searchParams.get("fair")) || (await defaultFairSlug());
  const paymentParam = str(url.searchParams.get("payment")).toLowerCase();
  const payment: "" | "PAID" | "UNPAID" = paymentParam === "paid" ? "PAID" : paymentParam === "unpaid" ? "UNPAID" : "";

  const rollsParam = str(url.searchParams.get("rolls"));
  const parsed = rollsParam ? parseRollExpression(rollsParam) : { rolls: new Set<string>(), error: "" };
  if (parsed.error) return fail(parsed.error, 422);

  const filter = {
    fair_slug: fair,
    class_name: str(url.searchParams.get("class")),
    section: str(url.searchParams.get("section")),
    shift: str(url.searchParams.get("shift")),
    q: str(url.searchParams.get("q")),
    payment,
    rolls: parsed.rolls,
  };
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(10, Math.floor(Number(url.searchParams.get("page_size")) || DEFAULT_PAGE_SIZE)));
  const page = Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1));

  const [students, total, summary, options] = await Promise.all([
    listStudentsWithStatus({ ...filter, limit: pageSize, offset: (page - 1) * pageSize }),
    countStudents(filter),
    studentStatusCounts(filter),
    studentFilterOptions(),
  ]);

  return ok({
    students,
    options,
    summary,
    total,
    page,
    page_size: pageSize,
    has_more: page * pageSize < total,
    fair_slug: fair,
  });
}
