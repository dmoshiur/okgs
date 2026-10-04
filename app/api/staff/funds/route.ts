import { defaultFairSlug, fail, num, ok, safeId, staff, str } from "@/lib/api";
import { createFund, deleteFund, listDues, listFunds, logActivity, updateDue, updateFund } from "@/lib/portal-db";

export const dynamic = "force-dynamic";

/**
 * Funds are the money coming in: class fees, science-fair collection, dues,
 * alumni donations. Teachers can add cash they received and verify the pending
 * submissions students make from /me.
 */

export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const params = new URL(request.url).searchParams;
  const funds = await listFunds({
    fair_slug: params.get("fair") || undefined,
    status: params.get("status") || undefined,
    class_level: params.get("class") || undefined,
    limit: num(params.get("limit"), 500),
  });
  return ok({ funds });
}

/** POST — record money received (status "verified" by default, "pending" to queue it). */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const rows = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : [body];
  const created: string[] = [];
  for (const row of rows) {
    const amount = Number(row.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const fairSlug = str(row.fair_slug) || (await defaultFairSlug());
    const id = await createFund({
      fair_slug: fairSlug,
      user_id: str(row.user_id),
      payer_name: str(row.payer_name) || str(row.student_name) || "অজ্ঞাত",
      payer_role: str(row.payer_role, "student") || "student",
      class_level: str(row.class_level),
      section: str(row.section),
      student_id: str(row.student_id).toUpperCase(),
      phone: str(row.phone),
      amount,
      method: str(row.method, "নগদ") || "নগদ",
      trx_id: str(row.trx_id),
      purpose: str(row.purpose, "বিজ্ঞান মেলা ফান্ড") || "বিজ্ঞান মেলা ফান্ড",
      status: str(row.status, "verified") || "verified",
      note: str(row.note),
      collected_by: session.user.name,
    });
    created.push(id);

    // A payment logged against a due should reduce that due automatically.
    const dueId = safeId(str(row.due_id));
    if (dueId) {
      const dues = await listDues({ limit: 500 });
      const due = dues.find((item) => item.id === dueId);
      if (due) {
        const paid = Number(due.paid_amount) + amount;
        await updateDue(dueId, {
          paid_amount: paid,
          status: paid >= Number(due.amount) ? "paid" : paid > 0 ? "partial" : "due",
        });
      }
    }
  }

  if (!created.length) return fail("কোনো বৈধ এন্ট্রি পাওয়া যায়নি (টাকার পরিমাণ দিন)।", 422);
  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: "fund.create",
    entity: "funds",
    detail: `${created.length} টি এন্ট্রি`,
  });
  return ok({ created }, 201);
}

/** PATCH — verify / reject / edit a fund entry, or attach it to a due. */
export async function PATCH(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("আইডি ঠিক নেই।", 422);

  const status = str(body.status);
  const patch: Record<string, string | number> = {};
  if (status) {
    if (!["verified", "pending", "rejected"].includes(status)) return fail("অবস্থা ঠিক নেই।", 422);
    patch.status = status;
    patch.verified_by = session.user.name;
    patch.verified_at = new Date().toISOString();
  }
  if ("amount" in body) patch.amount = Number(body.amount) || 0;
  if ("method" in body) patch.method = str(body.method);
  if ("trx_id" in body) patch.trx_id = str(body.trx_id);
  if ("purpose" in body) patch.purpose = str(body.purpose);
  if ("note" in body) patch.note = str(body.note);
  if ("class_level" in body) patch.class_level = str(body.class_level);
  if ("section" in body) patch.section = str(body.section);
  if ("student_id" in body) patch.student_id = str(body.student_id).toUpperCase();
  if ("payer_name" in body) patch.payer_name = str(body.payer_name);

  await updateFund(id, patch);
  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: status === "verified" ? "fund.verify" : "fund.update",
    entity: "funds",
    entity_id: id,
    detail: status || Object.keys(patch).join(", "),
  });
  return ok({ updated: true });
}

export async function DELETE(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  if (session.role === "teacher") {
    // Teachers may correct their own typos, but not silently wipe the ledger.
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = safeId(str(body.id));
    if (!id) return fail("আইডি ঠিক নেই।", 422);
    if (str(body.confirm) !== "delete") return fail("মুছে ফেলতে নিশ্চিত করুন (confirm: 'delete')।", 400);
    const removed = await deleteFund(id);
    await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "fund.delete", entity: "funds", entity_id: id });
    return ok({ deleted: removed });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("আইডি ঠিক নেই।", 422);
  const removed = await deleteFund(id);
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "fund.delete", entity: "funds", entity_id: id });
  return ok({ deleted: removed });
}
