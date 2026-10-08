"use client";

import { useMemo, useState } from "react";
import { Banknote, Printer, Scale, Trash2 } from "lucide-react";
import type { PublicUser, SettlementRow } from "@/lib/portal-db";
import { en, formatDateEn } from "@/lib/format";
import { roleLabelsEn as roleLabels, type PortalRole } from "@/lib/roles";
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
    if (!form.user_id && !reconcile) { setProblem("Select a teacher/admin account first."); return; }
    if (!reconcile && !(Number(form.amount) > 0)) { setProblem("Enter an amount greater than zero."); return; }
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
        ? `Remaining balance ${money(result.amount ?? 0)} settled — memo ${result.memo_no ?? ""}.`
        : `${selected?.name ?? "selected account"} — ${money(form.amount)} ledger entry posted (memo ${result.memo_no ?? ""}).`);
      setForm({ ...form, amount: "", note: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not post the ledger entry.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: SettlementRow) {
    if (!confirm(`${row.payee_name} — ${money(row.amount)} Delete this entry? The linked expense memo will also be deleted.`)) return;
    try {
      await postJson("/api/staff/settlements", { id: row.id }, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not delete.");
    }
  }

  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.35fr) minmax(290px, .65fr)" }}>
      <Panel
        title="Monthly settlement ledger (salary / balance)"
        action={
          <label className="v2-label" style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            Month
            <input className="v2-input" type="month" value={period} max={currentMonth()} onChange={(event) => setPeriod(event.target.value || currentMonth())} aria-label="Settlement period" />
          </label>
        }
      >
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        {error ? <Notice kind="bad">{error}</Notice> : null}
        <div className="pill-row" style={{ marginBottom: 14 }}>
          <span className="badge-soft">Collected {money(summary?.collected ?? 0)} ({en(summary?.collectedCount ?? 0)})</span>
          <span className="badge-soft">Spent {money(summary?.spent ?? 0)} ({en(summary?.spentCount ?? 0)})</span>
          <span className="badge-soft">Settled {money(summary?.settled ?? 0)} ({en(summary?.settledCount ?? 0)})</span>
          <span className={`badge-soft ${(summary?.balance ?? 0) >= 0 ? "status-ok" : "status-bad"}`}>Remaining balance {money(summary?.balance ?? 0)}</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Payee</th><th>Type</th><th>Month</th><th>Tk</th><th>Memo</th><th>Date</th><th /></tr>
            </thead>
            <tbody>
              {settlements.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.payee_name}</strong>
                    <div className="v2-muted" style={{ fontSize: 12 }}>{row.payee_role ? roleLabels[row.payee_role as PortalRole] ?? row.payee_role : "—"}</div>
                  </td>
                  <td>{row.kind === "adjustment" ? "Balance settlement" : "Salary"}</td>
                  <td>{row.period}</td>
                  <td><strong>{money(row.amount)}</strong></td>
                  <td className="v2-muted" style={{ fontSize: 12 }}>{row.memo_no || "—"}</td>
                  <td className="v2-muted" style={{ fontSize: 12 }}>{formatDateEn(row.created_at)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {row.expense_id ? <a className="v2-btn v2-btn-sm v2-btn-ghost" href={`/sf/print/memo/${row.expense_id}`} target="_blank" rel="noreferrer" title="Print memo"><Printer size={14} /></a> : null}{" "}
                    {canDelete ? <button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(row)} title="Entry Delete"><Trash2 size={14} /></button> : null}
                  </td>
                </tr>
              ))}
              {!settlements.length && !loading ? <tr><td colSpan={7}><Empty>No settlement entries this month yet.</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
        {loading ? <Empty>Loading…</Empty> : null}
      </Panel>

      <Panel title="New ledger entry">
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <label className="v2-label">Payee account (teacher / staff / admin)</label>
            <select className="v2-select" value={form.user_id} onChange={(event) => setForm({ ...form, user_id: event.target.value })}>
              <option value="">Choose an account…</option>
              {staffUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} — {roleLabels[user.role] ?? user.role}{user.designation ? ` · ${user.designation}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">Type</label>
              <select className="v2-select" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
                <option value="salary">Monthly salary</option>
                <option value="adjustment">Balance settlement</option>
              </select>
            </div>
            <div>
              <label className="v2-label">Tk</label>
              <input className="v2-input" type="number" min={1} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="e.g. 5000" />
            </div>
          </div>
          <div>
            <label className="v2-label">Note (optional)</label>
            <input className="v2-input" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="e.g. October salary" />
          </div>
          <button className="v2-btn" type="button" disabled={busy} onClick={() => void submit(false)}>
            <Banknote size={16} /> {busy ? "Posting…" : "Post ledger entry"}
          </button>
          <button
            className="v2-btn v2-btn-ghost"
            type="button"
            disabled={busy || !form.user_id || (summary?.balance ?? 0) <= 0}
            onClick={() => void submit(true)}
            title="Settle the month's remaining balance to the selected account in one click"
          >
            <Scale size={16} /> Settle remaining balance ({money(summary?.balance ?? 0)})
          </button>
          <p className="v2-muted" style={{ margin: 0, fontSize: 12.5 }}>
            Each entry automatically creates an expense memo — it appears in the Expenses list and print memos, and the month's balance drops immediately.
          </p>
        </div>
      </Panel>
    </div>
  );
}
