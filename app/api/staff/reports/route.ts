import { defaultFairSlug, ok, staff, str } from "@/lib/api";
import { dueTotals, expenseTotals, fundTotals } from "@/lib/portal-db";
import {
  classPaymentSummary,
  guestCountsByRelation,
  listScanLogs,
  rosterSummary,
  scanDaySummary,
  scanSummary,
  ticketPrintSummary,
  type ClassPaymentRow,
  type RosterSummary,
} from "@/lib/student-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/staff/reports?fair=<slug> — the report pack behind /sf/reports.
 *
 * Class-wise payment progress, gate totals for today and overall, ticket print
 * counts and the money ledger. Every figure is a live aggregate query over the
 * students / payments / scan_logs / ticket_prints / funds / expenses tables.
 */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;

  const url = new URL(request.url);
  const fair = str(url.searchParams.get("fair")) || (await defaultFairSlug());
  const logLimit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 200)));

  const [roster, classes, gate, today, prints, funds, expenses, dues, relations] = await Promise.all([
    rosterSummary(fair),
    classPaymentSummary(fair),
    scanSummary(fair),
    scanDaySummary(fair),
    ticketPrintSummary(fair),
    fundTotals(fair),
    expenseTotals(fair),
    dueTotals(fair),
    guestCountsByRelation(fair),
  ]);
  const logs = await listScanLogs({ fair_slug: fair, limit: logLimit });

  return ok({
    fair_slug: fair,
    roster: roster satisfies RosterSummary,
    classes: classes satisfies ClassPaymentRow[],
    gate,
    today,
    prints,
    guestsByRelation: relations,
    money: {
      collected: funds.verified,
      pending: funds.pending,
      spent: expenses.total,
      balance: funds.verified - expenses.total,
      duesTotal: dues.amount,
      duesPaid: dues.paid,
      duesOutstanding: dues.outstanding,
    },
    logs,
  });
}
