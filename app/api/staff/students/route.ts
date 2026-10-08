import { defaultFairSlug, fail, ok, staff, str } from "@/lib/api";
import { listStudentsWithStatus, studentFilterOptions } from "@/lib/student-db";
import { normalizeRoll, parseRollExpression } from "@/lib/roll-range";

export const dynamic = "force-dynamic";

/**
 * GET /api/staff/students — the class-wise roster with payment status.
 * Query: fair, class, section, shift, q, payment (paid|unpaid), rolls ("1, 2, 5, 12-15").
 */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const url = new URL(request.url);
  const fair = str(url.searchParams.get("fair")) || (await defaultFairSlug());
  const paymentParam = str(url.searchParams.get("payment")).toLowerCase();
  const payment = paymentParam === "paid" ? "PAID" : paymentParam === "unpaid" ? "UNPAID" : "";

  const rollsParam = str(url.searchParams.get("rolls"));
  const parsed = rollsParam ? parseRollExpression(rollsParam) : { rolls: new Set<string>(), error: "" };
  if (parsed.error) return fail(parsed.error, 422);

  const rows = await listStudentsWithStatus({
    fair_slug: fair,
    class_name: str(url.searchParams.get("class")),
    section: str(url.searchParams.get("section")),
    shift: str(url.searchParams.get("shift")),
    q: str(url.searchParams.get("q")),
    payment,
    limit: 5000,
  });
  const students = parsed.rolls.size ? rows.filter((row) => parsed.rolls.has(normalizeRoll(row.roll))) : rows;

  const options = await studentFilterOptions();
  const summary = {
    total: students.length,
    paid: students.filter((row) => row.payment_status === "PAID").length,
    unpaid: students.filter((row) => row.payment_status === "UNPAID").length,
    printed: students.filter((row) => row.print_count > 0).length,
    entered: students.filter((row) => Boolean(row.entered_at)).length,
  };
  return ok({ students, options, summary, fair_slug: fair });
}

