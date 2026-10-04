import { NextResponse } from "next/server";
import { currentSession, fail, ok, str } from "@/lib/api";
import {
  createDue,
  createFund,
  createPass,
  dueTotals,
  findPassForUser,
  listDues,
  listFunds,
  listPasses,
  logActivity,
  updateDue,
} from "@/lib/portal-db";
import { makePassToken } from "@/lib/qr";

export const dynamic = "force-dynamic";

/** GET /api/portal/me — my profile, my dues, my contributions, my pass. */
export async function GET() {
  const session = await currentSession();
  if (!session) return fail("লগইন প্রয়োজন।", 401);

  const { user, role } = session;
  const [dues, funds, passes] = await Promise.all([
    listDues({ user_id: user.id, limit: 100 }),
    listFunds({ user_id: user.id, limit: 50 }),
    listPasses({ user_id: user.id, limit: 20 }),
  ]);
  const byStudentId = user.student_id ? await listDues({ student_id: user.student_id, limit: 100 }) : [];
  const mergedDues = [...dues, ...byStudentId.filter((row) => !dues.some((due) => due.id === row.id))];
  const totals = await dueTotals();

  return ok({
    user,
    role,
    dues: mergedDues,
    funds,
    passes,
    outstanding: mergedDues
      .filter((due) => due.status === "due" || due.status === "partial")
      .reduce((sum, due) => sum + Math.max(0, Number(due.amount) - Number(due.paid_amount)), 0),
    contributed: funds.filter((fund) => fund.status === "verified").reduce((sum, fund) => sum + Number(fund.amount), 0),
    fairOutstanding: totals.outstanding,
  });
}

/**
 * POST /api/portal/me — two student actions:
 *   { action: "fund", amount, method, trx_id, purpose, note }  → submit a payment
 *   { action: "pass", fair_slug }                              → get / refresh my QR pass
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return fail("লগইন প্রয়োজন।", 401);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = str(body.action);

  const { user, role } = session;

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

  if (action === "dues") {
    // A student can ask for a due to be logged for them (payable at the office).
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return fail("টাকার পরিমাণ ঠিকভাবে লিখুন।", 422);
    const id = await createDue({
      fair_slug: str(body.fair_slug),
      user_id: user.id,
      student_name: user.name,
      student_id: user.student_id,
      class_level: user.class_level,
      section: user.section,
      title: str(body.title, "বিজ্ঞান মেলা ফি") || "বিজ্ঞান মেলা ফি",
      amount,
      note: str(body.note),
      status: "due",
    });
    return ok({ id }, 201);
  }

  if (action === "pay-dues") {
    // Records what the student paid; a teacher still verifies it in the console.
    const id = str(body.due_id);
    if (!id) return fail("কোন পাওনাটি পরিশোধ করছেন তা বাছুন।", 422);
    const amount = Number(body.amount ?? 0);
    const dues = await listDues({ user_id: user.id, limit: 100 });
    const due = dues.find((row) => row.id === id);
    if (!due) return fail("এই পাওনাটি খুঁজে পাওয়া যায়নি।", 404);
    const paid = Math.max(0, Number(due.paid_amount) + (Number.isFinite(amount) && amount > 0 ? amount : 0));
    const status = paid <= 0 ? "due" : paid >= Number(due.amount) ? "paid" : "partial";
    await updateDue(id, { paid_amount: paid, status });
    await createFund({
      fair_slug: due.fair_slug,
      user_id: user.id,
      payer_name: user.name,
      payer_role: role,
      class_level: user.class_level,
      section: user.section,
      student_id: user.student_id,
      phone: user.phone,
      amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
      method: str(body.method, "নগদ") || "নগদ",
      trx_id: str(body.trx_id),
      purpose: due.title || "পাওনা পরিশোধ",
      status: "pending",
      note: `due:${id}`,
    });
    return ok({ due: { ...due, paid_amount: paid, status } });
  }

  if (action === "pass") {
    const fairSlug = str(body.fair_slug);
    const existing = await findPassForUser(user.id, fairSlug);
    if (existing) {
      return ok({ pass: { ...existing, token: existing.token || makePassToken(existing.id) } });
    }
    const pass = await createPass({
      fair_slug: fairSlug,
      user_id: user.id,
      holder_name: user.name,
      holder_role: role,
      student_id: user.student_id,
      class_level: user.class_level,
      section: user.section,
      email: user.email,
      phone: user.phone,
      token: "",
      expires_at: str(body.expires_at),
    });
    await createPassToken(pass.id);
    const withToken = await listPasses({ user_id: user.id, limit: 1 });
    return ok({ pass: withToken[0] ?? pass }, 201);
  }

  return fail("অজানা অনুরোধ।", 400);
}

/** The pass token can only be minted after the row exists (it signs the id). */
async function createPassToken(passId: string) {
  const { db } = await import("@/lib/db");
  const token = makePassToken(passId);
  await db.execute({ sql: `UPDATE passes SET token = ? WHERE id = ?`, args: [token, passId] });
}
