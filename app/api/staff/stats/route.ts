import { ok, staff } from "@/lib/api";
import {
  dueTotals,
  expenseTotals,
  expenseTotalsByCategory,
  fundTotals,
  fundTotalsByClass,
  fundTotalsByMethod,
  listFunds,
  listScans,
  passStats,
  recentActivity,
  scanStats,
  studentsByClass,
  userCountsByRole,
} from "@/lib/portal-db";

export const dynamic = "force-dynamic";

/** GET /api/staff/stats?fair=<slug> — everything the console dashboard shows. */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;

  const fairSlug = new URL(request.url).searchParams.get("fair") || undefined;

  const [
    funds,
    byClass,
    byMethod,
    expenses,
    byCategory,
    dues,
    passes,
    scans,
    recentScans,
    students,
    roles,
    activity,
  ] = await Promise.all([
    fundTotals(fairSlug),
    fundTotalsByClass(fairSlug),
    fundTotalsByMethod(fairSlug),
    expenseTotals(fairSlug),
    expenseTotalsByCategory(fairSlug),
    dueTotals(fairSlug),
    passStats(fairSlug),
    scanStats(fairSlug),
    listScans({ fair_slug: fairSlug, limit: 15 }),
    studentsByClass(),
    userCountsByRole(),
    recentActivity(12),
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
    recentScans,
    pendingFunds,
    roles,
    activity,
  });
}
