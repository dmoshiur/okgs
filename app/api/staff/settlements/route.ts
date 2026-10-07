import { defaultFairSlug, fail, num, ok, safeId, staff, str } from "@/lib/api";
import {
  currentPeriod,
  createSettlement,
  deleteSettlement,
  getUser,
  listSettlements,
  listUsers,
  logActivity,
  monthlyLedger,
  normalizePeriod,
  publicUser,
} from "@/lib/portal-db";

export const dynamic = "force-dynamic";

/** Roles whose accounts may receive monthly salary / reconciliation entries. */
const payeeRoles = new Set(["teacher", "staff", "admin", "superadmin", "club"]);

/**
 * GET /api/staff/settlements?period=YYYY-MM&fair=<slug>
 * Month-end ledger: collections vs expenses vs posted settlements, the
 * remaining balance and the staff accounts that can receive an entry.
 */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;

  const params = new URL(request.url).searchParams;
  const fairSlug = str(params.get("fair")) || (await defaultFairSlug());
  const period = normalizePeriod(params.get("period")) || currentPeriod();

  const [summary, settlements, staffUsers] = await Promise.all([
    monthlyLedger(period, fairSlug),
    listSettlements({ period, fair_slug: fairSlug }),
    listUsers({ limit: 1000 }),
  ]);

  return ok({
    period,
    fair_slug: fairSlug,
    summary,
    settlements,
    staff: staffUsers
      .filter((user) => Number(user.is_active) === 1 && payeeRoles.has(user.role))
      .map((user) => publicUser(user)),
  });
}

/**
 * POST — post a salary or balance-reconciliation entry for the period.
 * `reconcile: true` settles the month's remaining collection balance in one
 * click; otherwise an explicit amount is required. Every entry creates the
 * linked expense memo automatically.
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const fairSlug = str(body.fair_slug) || (await defaultFairSlug());
  const period = normalizePeriod(body.period) || currentPeriod();
  const reconcile = body.reconcile === true;
  // A one-click balance reconciliation is an adjustment unless the caller says otherwise.
  const kind = str(body.kind) === "adjustment" || (reconcile && !str(body.kind)) ? "adjustment" : "salary";

  const userId = safeId(str(body.user_id));
  const payee = userId ? await getUser(userId) : null;
  const payeeName = str(body.payee_name) || payee?.name || "";
  if (!payeeName) return fail("যার হিসাবে সমন্বয় হবে সেই অ্যাকাউন্ট/নাম নির্বাচন করুন।", 422);
  if (payee && !payeeRoles.has(payee.role)) {
    return fail("শুধু শিক্ষক/স্টাফ/অ্যাডমিন অ্যাকাউন্টে মাসিক সমন্বয় পোস্ট করা যায়।", 422);
  }

  let amount = Math.round(num(body.amount, 0) * 100) / 100;
  if (reconcile) {
    const ledger = await monthlyLedger(period, fairSlug);
    amount = Math.round(ledger.balance * 100) / 100;
    if (amount <= 0) return fail("এই মাসে সমন্বয়ের মতো অবশিষ্ট ব্যালেন্স নেই।", 422);
  }
  if (!(amount > 0)) return fail("টাকার পরিমাণ শূন্যের বেশি হতে হবে।", 422);

  const created = await createSettlement({
    fair_slug: fairSlug,
    period,
    kind,
    user_id: payee?.id ?? "",
    payee_name: payeeName,
    payee_role: payee?.role ?? "",
    amount,
    note: str(body.note),
    created_by: session.user.name,
  });

  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: kind === "salary" ? "settlement.salary" : "settlement.reconcile",
    entity: "settlements",
    entity_id: created.id,
    detail: `${payeeName} · ${period} · ৳${amount}${created.memo_no ? ` · মেমো ${created.memo_no}` : ""}`,
  });

  const summary = await monthlyLedger(period, fairSlug);
  return ok({ ...created, summary }, 201);
}

/** DELETE — reverse a posted settlement (removes the linked expense memo). */
export async function DELETE(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  if (session.role !== "admin" && session.role !== "superadmin") {
    return fail("সমন্বয় এন্ট্রি মুছতে অ্যাডমিন দরকার।", 403);
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("আইডি ঠিক নেই।", 422);
  const removed = await deleteSettlement(id);
  if (!removed) return fail("সমন্বয় এন্ট্রি পাওয়া যায়নি।", 404);
  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: "settlement.delete",
    entity: "settlements",
    entity_id: id,
  });
  return ok({ deleted: true });
}
