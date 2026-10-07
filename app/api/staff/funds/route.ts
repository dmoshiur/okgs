import { defaultFairSlug, fail, num, ok, safeId, staff, str } from "@/lib/api";
import { createFund, deleteFund, dueReceiptTotals, getDueById, getFundById, listFunds, logActivity, syncDuePayment, updateFund } from "@/lib/portal-db";

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
    const requestedFair = str(row.fair_slug);
    const requestedUser = str(row.user_id);
    const dueIdInput = str(row.due_id);
    const dueId = safeId(dueIdInput);
    if (dueIdInput && !dueId) return fail("পাওনার আইডি ঠিক নেই।", 422);
    const linkedDue = dueId ? await getDueById(dueId) : null;
    const status = str(row.status, "verified") || "verified";
    if (!["verified", "pending", "rejected"].includes(status)) return fail("রসিদের অবস্থা ঠিক নেই।", 422);
    if (dueId && !linkedDue) return fail("এই পাওনাটি খুঁজে পাওয়া যায়নি।", 404);
    if (linkedDue?.user_id && requestedUser && linkedDue.user_id !== requestedUser) return fail("পাওনা ও ব্যবহারকারীর তথ্য মেলে না।", 422);
    if (linkedDue?.fair_slug && requestedFair && linkedDue.fair_slug !== requestedFair) return fail("পাওনা ও মেলার তথ্য মেলে না।", 422);
    if (linkedDue && ["verified", "pending"].includes(status)) {
      const reserved = await dueReceiptTotals(dueId);
      const remaining = Math.max(0, Number(linkedDue.amount) - reserved.verified - reserved.pending);
      if (amount > remaining + 0.000001) return fail(`এই পাওনার সর্বোচ্চ অবশিষ্ট জমা ${remaining} টাকা।`, 422);
    }
    const fairSlug = requestedFair || linkedDue?.fair_slug || (await defaultFairSlug());
    const userId = requestedUser || linkedDue?.user_id || "";
    const id = await createFund({
      fair_slug: fairSlug,
      user_id: userId,
      due_id: dueId,
      payer_name: str(row.payer_name) || str(row.student_name) || linkedDue?.student_name || "অজ্ঞাত",
      payer_role: str(row.payer_role, "student") || "student",
      class_level: str(row.class_level) || linkedDue?.class_level || "",
      section: str(row.section) || linkedDue?.section || "",
      student_id: str(row.student_id || linkedDue?.student_id).toUpperCase(),
      phone: str(row.phone),
      amount,
      method: str(row.method, "নগদ") || "নগদ",
      trx_id: str(row.trx_id),
      purpose: str(row.purpose, linkedDue?.title || "বিজ্ঞান মেলা ফান্ড") || "বিজ্ঞান মেলা ফান্ড",
      status,
      note: str(row.note),
      collected_by: session.user.name,
    });
    created.push(id);

    // Linked receipts are the source of truth for a due; only verified money counts.
    if (dueId) await syncDuePayment(dueId);
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

  const existing = await getFundById(id);
  if (!existing) return fail("ফান্ড এন্ট্রি পাওয়া যায়নি।", 404);
  const status = str(body.status);
  if (status && !["verified", "pending", "rejected"].includes(status)) return fail("অবস্থা ঠিক নেই।", 422);
  const nextStatus = status || existing.status;
  const nextAmount = "amount" in body ? Number(body.amount) : Number(existing.amount);
  if ("amount" in body && (!Number.isFinite(nextAmount) || nextAmount <= 0)) return fail("টাকার পরিমাণ শূন্যের বেশি হতে হবে।", 422);
  const dueIdInput = "due_id" in body ? str(body.due_id) : existing.due_id;
  const targetDueId = safeId(dueIdInput);
  if (dueIdInput && !targetDueId) return fail("পাওনার আইডি ঠিক নেই।", 422);
  const linkedDue = targetDueId ? await getDueById(targetDueId) : null;
  if (targetDueId && !linkedDue) return fail("এই পাওনাটি খুঁজে পাওয়া যায়নি।", 404);
  const requestedUserId = str(body.user_id);
  if (linkedDue?.user_id && requestedUserId && linkedDue.user_id !== requestedUserId) return fail("পাওনা ও ব্যবহারকারীর তথ্য মেলে না।", 422);
  if (linkedDue?.user_id && existing.user_id && linkedDue.user_id !== existing.user_id && !requestedUserId) return fail("পাওনা ও ব্যবহারকারীর তথ্য মেলে না।", 422);
  if (linkedDue && ["verified", "pending"].includes(nextStatus) && ("amount" in body || "status" in body || "due_id" in body)) {
    const reserved = await dueReceiptTotals(targetDueId, id);
    const remaining = Math.max(0, Number(linkedDue.amount) - reserved.verified - reserved.pending);
    if (nextAmount > remaining + 0.000001) return fail(`এই পাওনার সর্বোচ্চ অবশিষ্ট জমা ${remaining} টাকা।`, 422);
  }

  const patch: Record<string, string | number> = {};
  if (status) {
    patch.status = status;
    patch.verified_by = status === "verified" ? session.user.name : "";
    patch.verified_at = status === "verified" ? new Date().toISOString() : "";
  }
  if ("amount" in body) patch.amount = nextAmount;
  if ("method" in body) patch.method = str(body.method);
  if ("trx_id" in body) patch.trx_id = str(body.trx_id);
  if ("purpose" in body) patch.purpose = str(body.purpose);
  if ("note" in body) patch.note = str(body.note);
  if ("class_level" in body) patch.class_level = str(body.class_level);
  if ("section" in body) patch.section = str(body.section);
  if ("student_id" in body) patch.student_id = str(body.student_id).toUpperCase();
  if ("payer_name" in body) patch.payer_name = str(body.payer_name);
  if ("receipt_no" in body) patch.receipt_no = str(body.receipt_no);
  if ("user_id" in body) patch.user_id = requestedUserId;
  if ("due_id" in body) patch.due_id = targetDueId;
  if (linkedDue?.user_id && (!existing.user_id || requestedUserId)) patch.user_id = linkedDue.user_id;

  await updateFund(id, patch);
  const dueIds = new Set([existing.due_id, String(patch.due_id ?? "")].filter(Boolean));
  for (const dueId of dueIds) await syncDuePayment(dueId);
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
    const existing = await getFundById(id);
    const removed = await deleteFund(id);
    if (existing?.due_id) await syncDuePayment(existing.due_id);
    await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "fund.delete", entity: "funds", entity_id: id });
    return ok({ deleted: removed });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("আইডি ঠিক নেই।", 422);
  const existing = await getFundById(id);
  const removed = await deleteFund(id);
  if (existing?.due_id) await syncDuePayment(existing.due_id);
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "fund.delete", entity: "funds", entity_id: id });
  return ok({ deleted: removed });
}
