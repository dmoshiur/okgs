import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { getExpenseById } from "@/lib/portal-db";
import { getPublicContent } from "@/lib/db";
import { formatDateEn } from "@/lib/format";
import { PrintButton } from "@/components/print/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Expense memo", robots: { index: false, follow: false } };
function money(value: number) { return `৳${Math.round(Number(value) || 0).toLocaleString("en-US")}`; }

export default async function ExpenseMemoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSession();
  if (!session) redirect("/sf/login?next=/sf");
  if (!isStaffRole(session.role)) redirect("/me");
  const { id } = await params;
  const expense = await getExpenseById(id);
  if (!expense) notFound();
  const content = await getPublicContent();
  const settings = Object.fromEntries(content.settings.map((item) => [item.key, item.value]));
  const school = settings.site_name || "OKGS School";

  return (
    <main className="print-page v2">
      <div className="print-actions"><PrintButton label="Print expense memo" /></div>
      <article className="print-document">
        <header className="print-document-head">
          <div><p className="print-kicker">EXPENSE VOUCHER / PAYMENT MEMO</p><h1>{school}</h1><p>{settings.address || "Shibganj, Rajshahi, Bangladesh"}</p></div>
          <div className="print-number"><span>Expense memo</span><strong>{expense.memo_no || expense.voucher_no || expense.id.slice(0, 8).toUpperCase()}</strong><small>{formatDateEn(expense.paid_at || expense.created_at)}</small></div>
        </header>
        <div className="print-rule" />
        <div className="print-two-column">
          <div><small>Paid to</small><strong>{expense.paid_to || "—"}</strong><span>Prepared by: {expense.created_by || "School office"}</span></div>
          <div><small>Payment status</small><strong>{expense.status || "approved"}</strong><span>Payment method: {expense.method}</span></div>
        </div>
        <table className="print-table"><thead><tr><th>Expense description</th><th>Category</th><th>Payment date</th><th className="print-amount">Amount</th></tr></thead><tbody><tr><td>{expense.title}</td><td>{expense.category}</td><td>{formatDateEn(expense.paid_at || expense.created_at)}</td><td className="print-amount"><strong>{money(expense.amount)}</strong></td></tr></tbody></table>
        {expense.note ? <p className="print-note"><b>Note:</b> {expense.note}</p> : null}
        <p className="print-amount-words">Total paid: <strong>{money(expense.amount)}</strong></p>
        <div className="print-signatures"><div><span>Received by</span></div><div><span>Approved by</span></div><div><span>Accounts / cashier</span></div></div>
        <footer className="print-footer"><span>{school}</span><span>Memo {expense.memo_no || expense.voucher_no || expense.id.slice(0, 8).toUpperCase()} · Printed {formatDateEn(new Date().toISOString())}</span></footer>
      </article>
    </main>
  );
}
