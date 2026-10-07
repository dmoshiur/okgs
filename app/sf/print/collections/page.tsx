import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { listClasses, listFunds } from "@/lib/portal-db";
import { getPublicContent } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PrintButton } from "@/components/print/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collection report", robots: { index: false, follow: false } };
function money(value: number) { return `৳${Math.round(Number(value) || 0).toLocaleString("bn-BD")}`; }

type Search = Promise<Record<string, string | string[] | undefined>>;
export default async function CollectionReportPage({ searchParams }: { searchParams: Search }) {
  const session = await getPortalSession();
  if (!session) redirect("/sf/login?next=/sf");
  if (!isStaffRole(session.role)) redirect("/me");
  const params = await searchParams;
  const single = (key: string) => String(params[key] ?? "");
  const fair = single("fair");
  const classLevel = single("class");
  const status = single("status");
  const from = single("from");
  const to = single("to");
  const [content, classes] = await Promise.all([getPublicContent(), listClasses(true)]);
  const settings = Object.fromEntries(content.settings.map((item) => [item.key, item.value]));
  const fairName = content.fairs.find((item) => item.slug === fair)?.name || "All collections";
  const rows = await listFunds({ fair_slug: fair || undefined, class_level: classLevel || undefined, status: status || undefined, limit: 2000 });
  const filtered = rows.filter((row) => {
    const date = String(row.verified_at || row.created_at || "").slice(0, 10);
    return (!from || date >= from) && (!to || date <= to);
  });
  const totals = filtered.reduce((out, row) => {
    const amount = Number(row.amount) || 0;
    out.count += 1;
    if (row.status === "verified") out.collected += amount;
    else if (row.status === "pending") out.pending += amount;
    else out.rejected += amount;
    return out;
  }, { collected: 0, pending: 0, rejected: 0, count: 0 });
  const byClass = new Map<string, { count: number; amount: number }>();
  for (const row of filtered.filter((item) => item.status === "verified")) {
    const key = `${row.class_level || "শ্রেণি উল্লেখ নেই"}${row.section ? ` · ${row.section}` : ""}`;
    const item = byClass.get(key) ?? { count: 0, amount: 0 };
    item.count += 1;
    item.amount += Number(row.amount) || 0;
    byClass.set(key, item);
  }

  return (
    <main className="print-page v2">
      <form className="collection-report-filters no-print" method="GET">
        {fair ? <input type="hidden" name="fair" value={fair} /> : null}
        <label>From <input type="date" name="from" defaultValue={from} /></label>
        <label>To <input type="date" name="to" defaultValue={to} /></label>
        <label>Class <select name="class" defaultValue={classLevel}><option value="">All classes</option>{classes.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
        <label>Status <select name="status" defaultValue={status}><option value="">All statuses</option><option value="verified">Verified</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select></label>
        <button className="v2-btn v2-btn-sm" type="submit">Apply filters</button>
      </form>
      <div className="print-actions"><PrintButton label="Print report" /></div>
      <article className="print-document print-report">
        <header className="print-document-head"><div><p className="print-kicker">ACCOUNTING · COLLECTION REPORT</p><h1>{settings.site_name || "OKGS School"}</h1><p>{fairName}</p></div><div className="print-number"><span>Report period</span><strong>{from || "All dates"}{to ? ` — ${to}` : ""}</strong><small>Generated {formatDate(new Date().toISOString())}</small></div></header>
        <div className="print-rule" />
        <p className="print-filter-line">Filters: {classLevel || "All classes"} · {status || "All statuses"} · {from || "Start"} — {to || "Today"}</p>
        <div className="print-report-metrics"><div><small>Verified collections</small><strong>{money(totals.collected)}</strong></div><div><small>Pending</small><strong>{money(totals.pending)}</strong></div><div><small>Entries</small><strong>{totals.count.toLocaleString("bn-BD")}</strong></div></div>
        <h2 className="print-section-title">Class summary</h2>
        <table className="print-table"><thead><tr><th>Class / section</th><th>Verified entries</th><th className="print-amount">Collected</th></tr></thead><tbody>{Array.from(byClass.entries()).map(([name, summary]) => <tr key={name}><td>{name}</td><td>{summary.count.toLocaleString("bn-BD")}</td><td className="print-amount">{money(summary.amount)}</td></tr>)}{!byClass.size ? <tr><td colSpan={3}>No verified collection entries in this period.</td></tr> : null}</tbody></table>
        <h2 className="print-section-title">Transactions</h2>
        <table className="print-table"><thead><tr><th>Date</th><th>Receipt</th><th>Payer</th><th>Class</th><th>Purpose / method</th><th>Status</th><th className="print-amount">Amount</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td>{formatDate(row.created_at)}</td><td>{row.receipt_no}</td><td>{row.payer_name}{row.student_id ? <small className="print-subline">{row.student_id}</small> : null}</td><td>{row.class_level}{row.section ? ` · ${row.section}` : ""}</td><td>{row.purpose}<small className="print-subline">{row.method}{row.trx_id ? ` · ${row.trx_id}` : ""}</small></td><td>{row.status}</td><td className="print-amount">{money(row.amount)}</td></tr>)}{!filtered.length ? <tr><td colSpan={7}>No collection entries match these filters.</td></tr> : null}</tbody></table>
        <footer className="print-footer"><span>{settings.site_name || "OKGS School"}</span><span>Collected {money(totals.collected)} · Pending {money(totals.pending)}</span></footer>
      </article>
    </main>
  );
}
