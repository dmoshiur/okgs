import { defaultFairSlug, fail, num, ok, safeId, staff, str } from "@/lib/api";
import { 
  createMemo, 
  deleteMemo, 
  getMemoById, 
  listMemos, 
  logActivity,
  updateMemo,
  getMemoStats 
} from "@/lib/portal-db";

export const dynamic = "force-dynamic";

/**
 * Memo Ledger System API
 * Handles voucher/memo generation, real-time calculations, and ledger tracking
 */

export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  
  const params = new URL(request.url).searchParams;
  const fairSlug = params.get("fair") || undefined;
  const search = params.get("search") || "";
  const status = params.get("status") || "all";
  const category = params.get("category") || "all";
  const limit = num(params.get("limit"), 100);

  const result = await getMemoStats(fairSlug, { search, status, category, limit });
  return ok(result);
}

export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const rows = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : [body];
  const created: string[] = [];
  
  for (const row of rows) {
    const title = str(row.title);
    const amount = Number(row.amount ?? 0);
    
    if (!title || !Number.isFinite(amount) || amount <= 0) continue;
    
    // Generate memo number if not provided
    const memoNo = str(row.memo_no) || generateMemoNumber();
    
    const id = await createMemo({
      fair_slug: str(row.fair_slug) || (await defaultFairSlug()),
      memo_no: memoNo,
      title,
      amount,
      category: str(row.category, "Other") || "Other",
      paid_to: str(row.paid_to, ""),
      paid_at: str(row.paid_at) || new Date().toISOString().slice(0, 10),
      method: str(row.method, "cash") || "cash",
      voucher_no: str(row.voucher_no, ""),
      note: str(row.note, ""),
      status: str(row.status, "approved") || "approved",
      created_by: session.user.name,
    });
    
    created.push(id);
    
    // Log activity for each memo creation
    await logActivity({
      actor_id: session.user.id,
      actor_name: session.user.name,
      actor_role: session.role,
      action: "memo.create",
      entity: "memos",
      entity_id: id,
      detail: `Memo #${memoNo} - ${title} (${amount} BDT)`,
    });
  }
  
  if (!created.length) return fail("Memo title and amount are required.", 422);
  
  return ok({ created, message: `${created.length} memo(s) created successfully` }, 201);
}

export async function PATCH(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  
  if (!id) return fail("Invalid ID.", 422);
  if (!(await getMemoById(id))) return fail("Memo not found.", 404);
  
  if ("amount" in body && (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0)) {
    return fail("Amount must be greater than zero.", 422);
  }
  
  const updates: Record<string, unknown> = {};
  if ("title" in body) updates.title = str(body.title);
  if ("amount" in body) updates.amount = Number(body.amount) || 0;
  if ("category" in body) updates.category = str(body.category);
  if ("paid_to" in body) updates.paid_to = str(body.paid_to);
  if ("paid_at" in body) updates.paid_at = str(body.paid_at);
  if ("method" in body) updates.method = str(body.method);
  if ("voucher_no" in body) updates.voucher_no = str(body.voucher_no);
  if ("memo_no" in body) updates.memo_no = str(body.memo_no);
  if ("note" in body) updates.note = str(body.note);
  if ("status" in body) updates.status = str(body.status);
  
  await updateMemo(id, updates);
  
  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: "memo.update",
    entity: "memos",
    entity_id: id,
    detail: Object.keys(updates).filter((key) => key !== "id").join(", "),
  });
  
  return ok({ updated: true });
}

export async function DELETE(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  
  if (!id) return fail("Invalid ID.", 422);
  
  const memo = await getMemoById(id);
  if (!memo) return fail("Memo not found.", 404);
  
  const removed = await deleteMemo(id);
  
  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: "memo.delete",
    entity: "memos",
    entity_id: id,
    detail: `Memo #${memo.memo_no || id.slice(0, 8).toUpperCase()}`,
  });
  
  return ok({ deleted: removed });
}

/**
 * Generate a unique memo number
 */
function generateMemoNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MEM-${year}${month}${day}-${random}`;
}
