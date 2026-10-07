"use client";

import { useMemo, useState } from "react";
import { Banknote, Printer, Scale, Trash2 } from "lucide-react";
import type { PublicUser, SettlementRow } from "@/lib/portal-db";
import { bn, formatDate } from "@/lib/format";
import { roleLabels, type PortalRole } from "@/lib/roles";
import { Empty, Notice, Panel, money, postJson, useApi } from "@/components/sf/console/ui";

interface LedgerSummary {
  period: string;
  collected: number;
  collectedCount: number;
  spent: number;
  spentCount: number;
  settled: number;
  settledCount: number;
  balance: number;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Monthly salary / expense adjustment ledger — reconciles the month's
 * collection balance into admin/teacher accounts. Every entry posts the
 * matching expense memo automatically (printable from the row).
 */
export function SettlementsPanel({ fairSlug, canDelete }: { fairSlug: string; canDelete: boolean }) {
  const [period, setPeriod] = useState(currentMonth());
  const query = `/api/staff/settlements?fair=${encodeURIComponent(fairSlug)}&period=${encodeURIComponent(period)}`;
  const { data, loading, error, reload } = useApi<{ summary: LedgerSummary; settlements: SettlementRow[]; staff: PublicUser[] }>(query, [fairSlug, period]);
  const [form, setForm] = useState({ user_id: "", kind: "salary", amount: "", note: "" });
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const summary = data?.summary;
  const settlements = data?.settlements ?? [];
  const staffUsers = useMemo(() => data?.staff ?? [], [data]);
  const selected = staffUsers.find((user) => user.id === form.user_id);

  async function submit(reconcile: boolean) {
    if (!form.user_id && !reconcile) { setProblem("প্রথমে শিক্ষক/অ্যাডমিন অ্যাকাউন্ট নির্বাচন করুন।"); return; }
    if (!reconcile && !(Number(form.amount) > 0)) { setProblem("টাকার পরিমাণ শূন্যের বেশি দিন।"); return; }
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      const result = await postJson<{ memo_no?: string; amount?: number }>("/api/staff/settlements", {
        fair_slug: fairSlug,
        period,
        user_id: form.user_id,
        kind: reconcile ? "adjustment" : form.kind,
        amount: reconcile ? 0 : Number(form.amount) || 0,
        note: form.note,
        reconcile,
      });
      setMessage(reconcile
        ? `অবশিষ্ট ব্যালেন্স ${money(result.amount ?? 0)} সমন্বয় হয়েছে — মেমো ${result.memo_no ?? ""}।`
        : `${selected?.name ?? "নির্বাচিত অ্যাকাউন্ট"} — ${money(form.amount)} লেজার এন্ট্রি পোস্ট হয়েছে (মেমো ${result.memo_no ?? ""})।`);
      setForm({ ...form, amount: "", note: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "লেজার এন্ট্রি পোস্ট করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: SettlementRow) {
    if (!confirm(`${row.payee_name} — ${money(row.amount)} এন্ট্রিটি মুছে ফেলবেন? সংশ্লিষ্ট খরচের মেমোও মুছে যাবে।`)) return;
    try {
      await postJson("/api/staff/settlements", { id: row.id }, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "মুছে ফেলা যায়নি।");
    }
  }

  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.35fr) minmax(290px, .65fr)" }}>
      <Panel
        title="মাসিক সমন্বয় খাতা (বেতন / ব্যালেন্স)"
        action={
          <label className="v2-label" style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            মাস
            <input className="v2-input" type="month" value={period} max={currentMonth()} onChange={(event) => setPeriod(event.target.value || currentMonth())} aria-label="Settlement period" />
          </label>
        }
      >
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        {error ? <Notice kind="bad">{error}</Notice> : null}
        <div className="pill-row" style={{ marginBottom: 14 }}>
          <span className="badge-soft">সংগৃহীত {money(summary?.collected ?? 0)} ({bn(summary?.collectedCount ?? 0)})</span>
          <span className="badge-soft">খরচ {money(summary?.spent ?? 0)} ({bn(summary?.spentCount ?? 0)})</span>
          <span className="badge-soft">সমন্বিত {money(summary?.settled ?? 0)} ({bn(summary?.settledCount ?? 0)})</span>
          <span className={`badge-soft ${(summary?.balance ?? 0) >= 0 ? "status-ok" : "status-bad"}`}>অবশিষ্ট ব্যালেন্স {money(summary?.balance ?? 0)}</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>প্রাপক</th><th>ধরন</th><th>মাস</th><th>টাকা</th><th>মেমো</th><th>তারিখ</th><th /></tr>
            </thead>
            <tbody>
              {settlements.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.payee_name}</strong>
                    <div className="v2-muted" style={{ fontSize: 12 }}>{row.payee_role ? roleLabels[row.payee_role as PortalRole] ?? row.payee_role : "—"}</div>
                  </td>
                  <td>{row.kind === "adjustment" ? "ব্যালেন্স সমন্বয়" : "বেতন"}</td>
                  <td>{row.period}</td>
                  <td><strong>{money(row.amount)}</strong></td>
                  <td className="v2-muted" style={{ fontSize: 12 }}>{row.memo_no || "—"}</td>
                  <td className="v2-muted" style={{ fontSize: 12 }}>{formatDate(row.created_at)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {row.expense_id ? <a className="v2-btn v2-btn-sm v2-btn-ghost" href={`/sf/print/memo/${row.expense_id}`} target="_blank" rel="noreferrer" title="মেমো ছাপুন"><Printer size={14} /></a> : null}{" "}
                    {canDelete ? <button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(row)} title="এন্ট্রি মুছুন"><Trash2 size={14} /></button> : null}
                  </td>
                </tr>
              ))}
              {!settlements.length && !loading ? <tr><td colSpan={7}><Empty>এই মাসে এখনো কোনো সমন্বয় এন্ট্রি নেই।</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
        {loading ? <Empty>লোড হচ্ছে…</Empty> : null}
      </Panel>

      <Panel title="নতুন লেজার এন্ট্রি">
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <label className="v2-label">প্রাপক অ্যাকাউন্ট (শিক্ষক / স্টাফ / অ্যাডমিন)</label>
            <select className="v2-select" value={form.user_id} onChange={(event) => setForm({ ...form, user_id: event.target.value })}>
              <option value="">অ্যাকাউন্ট নির্বাচন করুন…</option>
              {staffUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} — {roleLabels[user.role] ?? user.role}{user.designation ? ` · ${user.designation}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">ধরন</label>
              <select className="v2-select" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
                <option value="salary">মাসিক বেতন</option>
                <option value="adjustment">ব্যালেন্স সমন্বয়</option>
              </select>
            </div>
            <div>
              <label className="v2-label">টাকা</label>
              <input className="v2-input" type="number" min={1} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="যেমন: 5000" />
            </div>
          </div>
          <div>
            <label className="v2-label">নোট (ঐচ্ছিক)</label>
            <input className="v2-input" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="যেমন: অক্টোবর মাসের বেতন" />
          </div>
          <button className="v2-btn" type="button" disabled={busy} onClick={() => void submit(false)}>
            <Banknote size={16} /> {busy ? "পোস্ট হচ্ছে…" : "লেজার এন্ট্রি পোস্ট করুন"}
          </button>
          <button
            className="v2-btn v2-btn-ghost"
            type="button"
            disabled={busy || !form.user_id || (summary?.balance ?? 0) <= 0}
            onClick={() => void submit(true)}
            title="মাসের অবশিষ্ট সংগ্রহ ব্যালেন্স এক ক্লিকে নির্বাচিত অ্যাকাউন্টে সমন্বয় করুন"
          >
            <Scale size={16} /> অবশিষ্ট ব্যালেন্স সমন্বয় করুন ({money(summary?.balance ?? 0)})
          </button>
          <p className="v2-muted" style={{ margin: 0, fontSize: 12.5 }}>
            প্রতিটি এন্ট্রির জন্য স্বয়ংক্রিয়ভাবে একটি খরচের মেমো তৈরি হয় — খরচ ট্যাবের তালিকা ও প্রিন্ট মেমোতে সেটি দেখা যাবে, এবং মাসের ব্যালেন্স সাথে সাথে কমে যায়।
          </p>
        </div>
      </Panel>
    </div>
  );
}
