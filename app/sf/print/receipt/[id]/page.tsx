import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { getFundById } from "@/lib/portal-db";
import { getPublicContent } from "@/lib/db";
import { formatDateEn } from "@/lib/format";
import { ticketSchoolName } from "@/lib/ticket-locale";
import { PrintButton } from "@/components/print/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Money receipt", robots: { index: false, follow: false } };

function money(value: number) { return `৳${Math.round(Number(value) || 0).toLocaleString("en-US")}`; }

export default async function ReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSession();
  if (!session) redirect("/sf/login?next=/sf");
  if (!isStaffRole(session.role)) redirect("/me");
  const { id } = await params;
  const receipt = await getFundById(id);
  if (!receipt) notFound();
  const content = await getPublicContent();
  const settings = Object.fromEntries(content.settings.map((item) => [item.key, item.value]));
  const school = ticketSchoolName(settings.site_name_en || settings.site_name);

  return (
    <main className="print-page v2">
      <div className="print-actions"><PrintButton /></div>
      <article className="print-document">
        <header className="print-document-head">
          <div><p className="print-kicker">OFFICIAL RECEIPT</p><h1>{school}</h1><p>{settings.address || "Shibganj, Rajshahi, Bangladesh"}</p></div>
          <div className="print-number"><span>Money receipt</span><strong>{receipt.receipt_no || receipt.id.slice(0, 8).toUpperCase()}</strong><small>{formatDateEn(receipt.created_at)}</small></div>
        </header>
        <div className="print-rule" />
        <div className="print-two-column">
          <div><small>Received from</small><strong>{receipt.payer_name}</strong><span>{receipt.student_id || ""}{receipt.class_level ? ` · ${receipt.class_level}` : ""}{receipt.section ? ` · ${receipt.section}` : ""}</span></div>
          <div><small>Payment status</small><strong>{receipt.status === "verified" ? "Verified / Received" : receipt.status === "pending" ? "Pending verification" : "Rejected"}</strong><span>Received by: {receipt.collected_by || "School office"}</span></div>
        </div>
        <table className="print-table"><thead><tr><th>Description</th><th>Payment method</th><th>Transaction / reference</th><th className="print-amount">Amount</th></tr></thead><tbody><tr><td>{receipt.purpose || "School collection"}{receipt.due_id ? <small className="print-subline">Linked to student due</small> : null}</td><td>{receipt.method}</td><td>{receipt.trx_id || "—"}</td><td className="print-amount"><strong>{money(receipt.amount)}</strong></td></tr></tbody></table>
        {receipt.note ? <p className="print-note"><b>Note:</b> {receipt.note}</p> : null}
        <p className="print-amount-words">Amount received: <strong>{money(receipt.amount)}</strong></p>
        <div className="print-signatures"><div><span>Student / payer signature</span></div><div><span>Cashier / authorized signature</span></div></div>
        <footer className="print-footer"><span>{school}</span><span>Receipt {receipt.receipt_no || receipt.id.slice(0, 8).toUpperCase()} · Printed {formatDateEn(new Date().toISOString())}</span></footer>
      </article>
    </main>
  );
}
