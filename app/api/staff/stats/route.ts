import { defaultFairSlug, ok, staff, str } from "@/lib/api";
import {
  dueTotals,
  expenseTotals,
  expenseTotalsByCategory,
  fundTotals,
  fundTotalsByClass,
  fundTotalsByMethod,
  listFunds,
  passStats,
  recentActivity,
  scanStats,
  studentsByClass,
  userCountsByRole,
} from "@/lib/portal-db";
import { listScanLogs, rosterSummary, scanSummary } from "@/lib/student-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/staff/stats?fair=<slug> — everything the console dashboard shows.
 *
 * Every number is a live query: money from the funds/expenses/dues tables, the
 * roster from `students` joined with `payments`, and the gate figures from the
 * `scan_logs` audit table. There is no fallback payload — an empty database
 * answers with zeroes.
 */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;

  const url = new URL(request.url);
  const requested = str(url.searchParams.get("fair"));
  const fairSlug = requested || undefined;
  const fair = fairSlug || (await defaultFairSlug());

  const [
    funds,
    byClass,
    byMethod,
    expenses,
    byCategory,
    dues,
    passes,
    scans,
    students,
    roles,
    activity,
    gate,
    ticketScans,
    roster,
  ] = await Promise.all([
    fundTotals(fairSlug),
    fundTotalsByClass(fairSlug),
    fundTotalsByMethod(fairSlug),
    expenseTotals(fairSlug),
    expenseTotalsByCategory(fairSlug),
    dueTotals(fairSlug),
    passStats(fairSlug),
    scanStats(fairSlug),
    studentsByClass(),
    userCountsByRole(),
    recentActivity(12),
    scanSummary(fair),
    listScanLogs({ fair_slug: fair, limit: 12 }),
    rosterSummary(fair),
  ]);

  const pendingFunds = await listFunds({ fair_slug: fairSlug, status: "pending", limit: 25 });

  return ok({
    money: {
      collected: funds.verified,
      pending: funds.pending,
      today: funds.today,
      entries: funds.count,
      spent: expenses.total,
      balance: funds.verified - expenses.total,
      duesOutstanding: dues.outstanding,
      duesTotal: dues.amount,
      duesPaid: dues.paid,
    },
    fundsByClass: byClass,
    fundsByMethod: byMethod,
    expensesByCategory: byCategory,
    dues,
    studentsByClass: students,
    passes,
    scans,
    ticketScans,
    gate,
    roster,
    pendingFunds,
    roles,
    activity,
    fair_slug: fair,
  });
}
