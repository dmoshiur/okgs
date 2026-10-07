import { defaultFairSlug, fail, num, ok, safeId, staff, str } from "@/lib/api";
import { createExpense, deleteExpense, getExpenseById, listExpenses, logActivity, updateExpense } from "@/lib/portal-db";

export const dynamic = "force-dynamic";

/** Fair expenses — what the science fair (or the general fund) spent. */
export async function GET(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const params = new URL(request.url).searchParams;
  const expenses = await listExpenses(params.get("fair") || undefined, num(params.get("limit"), 500));
  return ok({ expenses });
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
    const id = await createExpense({
      fair_slug: str(row.fair_slug) || (await defaultFairSlug()),
      title,
      category: str(row.category, "সাধারণ") || "সাধারণ",
      amount,
      paid_to: str(row.paid_to),
      paid_at: str(row.paid_at) || new Date().toISOString().slice(0, 10),
      method: str(row.method, "নগদ") || "নগদ",
      voucher_no: str(row.voucher_no),
      note: str(row.note),
      status: str(row.status, "approved") || "approved",
      created_by: session.user.name,
    });
    created.push(id);
  }
  if (!created.length) return fail("খরচের বিবরণ আর টাকার পরিমাণ দিন।", 422);
  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: "expense.create",
    entity: "expenses",
    detail: `${created.length} টি খরচ`,
  });
  return ok({ created }, 201);
}

export async function PATCH(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("আইডি ঠিক নেই।", 422);
  if (!(await getExpenseById(id))) return fail("খরচের মেমো পাওয়া যায়নি।", 404);
  if ("amount" in body && (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0)) return fail("খরচের পরিমাণ শূন্যের বেশি হতে হবে।", 422);
  await updateExpense(id, {
    ...(("title" in body) ? { title: str(body.title) } : {}),
    ...(("category" in body) ? { category: str(body.category) } : {}),
    ...(("amount" in body) ? { amount: Number(body.amount) || 0 } : {}),
    ...(("paid_to" in body) ? { paid_to: str(body.paid_to) } : {}),
    ...(("paid_at" in body) ? { paid_at: str(body.paid_at) } : {}),
    ...(("method" in body) ? { method: str(body.method) } : {}),
    ...(("voucher_no" in body) ? { voucher_no: str(body.voucher_no) } : {}),
    ...(("memo_no" in body) ? { memo_no: str(body.memo_no) } : {}),
    ...(("note" in body) ? { note: str(body.note) } : {}),
    ...(("status" in body) ? { status: str(body.status) } : {}),
  });
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "expense.update", entity: "expenses", entity_id: id, detail: Object.keys(body).filter((key) => key !== "id").join(", ") });
  return ok({ updated: true });
}

export async function DELETE(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = safeId(str(body.id));
  if (!id) return fail("আইডি ঠিক নেই।", 422);
  const removed = await deleteExpense(id);
  await logActivity({ actor_id: session.user.id, actor_name: session.user.name, actor_role: session.role, action: "expense.delete", entity: "expenses", entity_id: id });
  return ok({ deleted: removed });
}
