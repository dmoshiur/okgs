import { assignPassword, passwordProblemEn, verifyPassword } from "@/lib/portal-auth";
import { getUser } from "@/lib/portal-db";
import { currentSession, fail, ok, str } from "@/lib/api";
import {
  createFund,
  dueReceiptTotals,
  listPasses,
  listStudentDues,
  listStudentFunds,
  logActivity,
  studentVerifiedTotal,
} from "@/lib/portal-db";
import { getPublicContent } from "@/lib/db";
import { activeFair } from "@/lib/site";
import { getStudentByCode, getPaymentStatus } from "@/lib/student-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/portal/me — my roster row, my dues and receipts (live from the
 * ledger), my contribution totals and my QR pass(es).
 *
 * Totals are computed here on every request:
 *   contributed = verified receipts linked to me (by account or school ID)
 *   outstanding = Σ max(0, due − verified receipts linked to that due)
 * Pending receipts are reported separately and are never counted as paid.
 */
export async function GET() {
  const session = await currentSession();
  if (!session) return fail("লগইন প্রয়োজন।", 401);

  const { user, role } = session;
  const studentCode = user.student_id ?? "";
  const roster = role === "student" && studentCode ? await getStudentByCode(studentCode) : null;
  const fair = activeFair(await getPublicContent());
  const [dues, funds, passes, contributed] = await Promise.all([
    listStudentDues(user.id, studentCode, 200),
    listStudentFunds(user.id, studentCode, 100),
    listPasses({ user_id: user.id, limit: 20 }),
    studentVerifiedTotal(user.id, studentCode),
  ]);

  // Main pass first; guest passes are read-only children of it.
  const mainPass = passes.find((pass) => !pass.parent_pass_id) ?? null;
  const guestPasses = mainPass ? passes.filter((pass) => pass.parent_pass_id === mainPass.id) : [];
  const dueRows = dues.map((due) => {
    const balance = Math.max(0, Number(due.amount) - Number(due.paid_amount));
    const pending = Number(due.pending_amount ?? 0);
    return { ...due, balance, payable: Math.max(0, balance - pending) };
  });
  const outstanding = dueRows.reduce((sum, due) => sum + due.balance, 0);
  const pendingReceipts = funds.filter((fund) => fund.status === "pending").reduce((sum, fund) => sum + Number(fund.amount), 0);

  return ok({
    user,
    role,
    roster: roster
      ? {
          ...roster,
          payment_status: await getPaymentStatus(roster.id, fair?.slug ?? ""),
          ticket_url: `/sf/print/ticket/${encodeURIComponent(roster.id)}?fair=${encodeURIComponent(fair?.slug ?? "")}`,
        }
      : null,
    dues: dueRows,
    funds,
    passes: mainPass ? [mainPass] : [],
    guest_passes: guestPasses,
    outstanding,
    contributed,
    pending_receipts: pendingReceipts,
    dues_total: dueRows.reduce((sum, due) => sum + Number(due.amount), 0),
  });
}

/**
 * POST /api/portal/me — what a student may ask for:
 *   { action: "password", current_password, new_password }
 *   { action: "fund", amount, method, trx_id, purpose }  → submit a payment for verification
 *   { action: "pay-dues", due_id, amount, method, trx_id } → record a payment against one due
 *
 * QR passes are never created from here. They are issued by the system when the
 * office marks a student PAID, or by an administrator.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return fail("লগইন প্রয়োজন।", 401);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = str(body.action);

  const { user, role } = session;

  if (action === "pass" || action === "guest-passes") {
    return fail("QR পাস শিক্ষার্থী নিজে তৈরি করতে পারে না — বিদ্যালয় কর্তৃপক্ষ পেমেন্ট নিশ্চিত হলে পাস ইস্যু করবে।", 403);
  }

  if (action === "password") {
    const current = String(body.current_password ?? "");
    const next = String(body.new_password ?? "");
    const problem = passwordProblemEn(next, "en");
    if (problem) return fail(problem, 422);
    const account = await getUser(user.id);
    if (!account || !verifyPassword(current, account.password_hash, account.password_salt)) return fail("Current password is incorrect.", 401);
    await assignPassword(account, next);
    return ok({ message: "Password updated" });
  }

  if (action === "fund") {
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return fail("টাকার পরিমাণ ঠিকভাবে লিখুন।", 422);
    const fairSlug = str(body.fair_slug);
    const fundId = await createFund({
      fair_slug: fairSlug,
      user_id: user.id,
      payer_name: user.name,
      payer_role: role,
      class_level: user.class_level,
      section: user.section,
      student_id: user.student_id,
      phone: user.phone,
      amount,
      method: str(body.method, "নগদ") || "নগদ",
      trx_id: str(body.trx_id),
      purpose: str(body.purpose, "বিজ্ঞান মেলা ফান্ড") || "বিজ্ঞান মেলা ফান্ড",
      status: "pending",
      note: str(body.note),
    });
    await logActivity({
      actor_id: user.id,
      actor_name: user.name,
      actor_role: role,
      action: "fund.submit",
      entity: "funds",
      entity_id: fundId,
      detail: `${amount} টাকা · ${str(body.method, "নগদ")}`,
    });
    return ok({ id: fundId, status: "pending" }, 201);
  }

  if (action === "pay-dues") {
    // Records what the student paid; a teacher still verifies it in the console.
    const id = str(body.due_id);
    if (!id) return fail("কোন পাওনাটি পরিশোধ করছেন তা বাছুন।", 422);
    const amount = Number(body.amount ?? 0);
    const dues = await listStudentDues(user.id, user.student_id ?? "", 500);
    const due = dues.find((row) => row.id === id);
    if (!due) return fail("এই পাওনাটি খুঁজে পাওয়া যায়নি।", 404);
    const receipts = await dueReceiptTotals(due.id);
    const outstanding = Math.max(0, Number(due.amount) - receipts.verified - receipts.pending);
    if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding) return fail(`বকেয়া সর্বোচ্চ ${outstanding} টাকা।`, 422);
    const fundId = await createFund({
      fair_slug: due.fair_slug,
      due_id: due.id,
      user_id: user.id,
      payer_name: user.name,
      payer_role: role,
      class_level: user.class_level,
      section: user.section,
      student_id: user.student_id,
      phone: user.phone,
      amount,
      method: str(body.method, "নগদ") || "নগদ",
      trx_id: str(body.trx_id),
      purpose: due.title || "পাওনা পরিশোধ",
      status: "pending",
      note: `due:${id}`,
    });
    return ok({ due, fund_id: fundId, status: "pending" });
  }

  return fail("অজানা অনুরোধ।", 400);
}
