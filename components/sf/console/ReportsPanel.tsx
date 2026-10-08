"use client";

/**
 * ReportsPanel — class-wise payment, ticket and gate report.
 *
 * One request to `/api/staff/reports`, which aggregates the live tables
 * (students + payments + scan_logs + ticket_prints + funds + expenses). The CSV
 * export is generated from that same response — no browser storage, no cache.
 */
import { useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Printer, ScanLine, Ticket, Users, Wallet } from "lucide-react";
import { en, formatDateEn, formatDateTimeEn } from "@/lib/format";
import { Bars, Empty, Metric, Notice, Panel, money, useApi } from "@/components/sf/console/ui";
import { GATE_RESULT_LABEL, gateResultClass } from "@/components/sf/gate-status";

interface ReportRow {
  class_name: string;
  section: string;
  shift: string;
  total: number;
  paid: number;
  unpaid: number;
  printed: number;
  entered: number;
  guests: number;
}

interface ReportLog {
  id: string;
  subject_type: string;
  subject_name: string;
  subject_code: string;
  method: string;
  result: string;
  entry_time: string;
  scanned_at: string;
  scanned_by_name: string;
  note: string;
}

interface ReportData {
  fair_slug: string;
  roster: { total: number; paid: number; unpaid: number; printed: number; entered: number; guests: number };
  classes: ReportRow[];
  gate: { success: number; duplicate: number; expired: number; invalid: number; admitted: number };
  today: { success: number; duplicate: number; expired: number; invalid: number; admitted: number; since: string };
  prints: { prints: number; copies: number; students: number; guestSheets: number };
  guestsByRelation: { relation: string; total: number }[];
  money: { collected: number; pending: number; spent: number; balance: number; duesTotal: number; duesPaid: number; duesOutstanding: number };
  logs: ReportLog[];
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

/** Class report → CSV, built from the response the panel already holds. */
function downloadCsv(rows: ReportRow[], fair: string) {
  const header = ["Class", "Section", "Shift", "Students", "Paid", "Unpaid", "Tickets printed", "Entered", "Guests"];
  const body = rows.map((row) => [row.class_name, row.section, row.shift, row.total, row.paid, row.unpaid, row.printed, row.entered, row.guests].map(csvCell).join(","));
  const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `class-payments-${fair || "fair"}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsPanel({ fairSlug, fairName }: { fairSlug: string; fairName: string }) {
  const [busy, setBusy] = useState(false);
  const report = useApi<ReportData>(`/api/staff/reports?fair=${encodeURIComponent(fairSlug)}&limit=60`, [fairSlug]);

  const data = report.data;
  const paidRatio = (row: ReportRow) => (row.total ? Math.round((row.paid / row.total) * 100) : 0);

  async function refresh() {
    setBusy(true);
    await report.reload();
    setBusy(false);
  }

  if (report.error) return <Notice kind="bad">{report.error}</Notice>;

  return (
    <div className="sf-stack">
      <div className="sf-page-actions">
        <button type="button" className="v2-btn v2-btn-sm" onClick={refresh} disabled={busy || !data}>
          <Download size={14} /> {busy ? "Reloading…" : "Reload from database"}
        </button>
        <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={() => data && downloadCsv(data.classes, data.fair_slug)} disabled={!data?.classes.length}>
          <Download size={14} /> Export class report (CSV)
        </button>
        <Link className="v2-btn v2-btn-sm v2-btn-ghost" href={`/sf/print/collections?fair=${encodeURIComponent(fairSlug)}`}>
          <Printer size={14} /> Printable collection report
        </Link>
      </div>

      <div className="metric-grid">
        <Metric accent label="Collected (verified)" value={money(data?.money.collected ?? 0)} note={`Pending ${money(data?.money.pending ?? 0)}`} icon={<Wallet size={14} />} />
        <Metric label="Balance" value={money(data?.money.balance ?? 0)} note={data && data.money.balance >= 0 ? "Surplus" : "Deficit"} />
        <Metric label="Students paid" value={en(data?.roster.paid ?? 0)} note={`${en(data?.roster.unpaid ?? 0)} unpaid of ${en(data?.roster.total ?? 0)}`} icon={<Users size={14} />} />
        <Metric label="Ticket sheets" value={en(data?.prints.copies ?? 0)} note={`${en(data?.prints.students ?? 0)} students · ${en(data?.prints.guestSheets ?? 0)} guest sheets`} icon={<Ticket size={14} />} />
        <Metric label="Admitted today" value={en(data?.today.admitted ?? 0)} note={`${en(data?.gate.admitted ?? 0)} since the fair opened`} icon={<ScanLine size={14} />} />
        <Metric label="Outside guests" value={en(data?.roster.guests ?? 0)} note="Active guardians registered by staff" />
      </div>

      <Panel title="Class-wise payment and ticket report" action={<span className="badge-soft">{en(data?.classes.length ?? 0)} classes</span>}>
        <div className="sf-table-wrap">
          <table className="sf-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Section</th>
                <th>Shift</th>
                <th>Students</th>
                <th>Paid</th>
                <th>Unpaid</th>
                <th>Coverage</th>
                <th>Tickets printed</th>
                <th>Entered</th>
                <th>Guests</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {(data?.classes ?? []).map((row) => (
                <tr key={`${row.class_name}-${row.section}-${row.shift}`}>
                  <td><strong>{row.class_name || "—"}</strong></td>
                  <td>{row.section || "—"}</td>
                  <td>{row.shift || "—"}</td>
                  <td>{en(row.total)}</td>
                  <td><span className="sf-badge is-good">{en(row.paid)}</span></td>
                  <td>{row.unpaid ? <span className="sf-badge is-bad">{en(row.unpaid)}</span> : <span className="v2-muted">0</span>}</td>
                  <td>
                    <span className="sf-progress" role="img" aria-label={`${paidRatio(row)} percent paid`}>
                      <span className="sf-progress-fill" style={{ width: `${paidRatio(row)}%` }} />
                      <b>{en(paidRatio(row))}%</b>
                    </span>
                  </td>
                  <td>{row.printed ? en(row.printed) : "—"}</td>
                  <td>{row.entered ? en(row.entered) : "—"}</td>
                  <td>{row.guests ? en(row.guests) : "—"}</td>
                  <td className="sf-actions">
                    <Link
                      className="v2-btn v2-btn-sm v2-btn-ghost"
                      href={`/sf/students?${new URLSearchParams({ class: row.class_name, section: row.section, shift: row.shift }).toString()}`}
                    >
                      <Users size={14} /> Collect fees
                    </Link>
                  </td>
                </tr>
              ))}
              {!data?.classes.length && !report.loading ? (
                <tr>
                  <td colSpan={11}>
                    <Empty>
                      Nothing to report yet — the roster is empty for this fair.{" "}
                      <Link className="text-link" href="/sf/students">Import the Excel roster</Link>.
                    </Empty>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="v2-muted sf-help">
          {fairName}. Figures come straight from the roster, payment, ticket-print and gate tables every time this page is opened.
        </p>
      </Panel>

      <div className="sf-grid-2">
        <Panel title="Payment coverage by class">
          <Bars unit=" %" rows={(data?.classes ?? []).map((row) => ({ label: `${row.class_name}${row.section ? ` · ${row.section}` : ""}`, value: paidRatio(row) }))} total={100} />
        </Panel>
        <Panel title="Gate results">
          <div className="sf-list">
            {(["success", "duplicate", "expired", "invalid"] as const).map((key) => (
              <div key={key} className="sf-list-row">
                <span className={`sf-badge ${gateResultClass(key)}`}>{GATE_RESULT_LABEL[key]}</span>
                <span className="sf-list-main"><strong>{en(data?.gate[key] ?? 0)}</strong><small className="v2-muted">All day for this fair</small></span>
                <strong>{en(data?.today[key] ?? 0)}</strong>
              </div>
            ))}
          </div>
          <p className="v2-muted sf-help">The right-hand column counts today only, from {data?.today.since ? formatDateTimeEn(data.today.since) : "—"}</p>
        </Panel>
        <Panel title="Guests by relation" action={<Link className="badge-soft" href="/sf/students">Register a guest <ExternalLink size={11} /></Link>}>
          <Bars unit=" guests" rows={(data?.guestsByRelation ?? []).map((row) => ({ label: row.relation, value: row.total }))} />
        </Panel>
        <Panel title="Recent gate audit" action={<Link className="badge-soft" href="/sf/scan">Open scanner <ExternalLink size={11} /></Link>}>
          <div className="sf-list">
            {(data?.logs ?? []).slice(0, 12).map((log) => (
              <div key={log.id} className="sf-list-row">
                <span className={`sf-badge ${gateResultClass(log.result)}`}>{GATE_RESULT_LABEL[log.result] ?? "Recorded"}</span>
                <span className="sf-list-main">
                  <strong>{log.subject_name || "Unknown ticket"}</strong>
                  <small className="v2-muted">{log.subject_code || "—"} · {log.method === "manual" ? "Manual entry" : "QR scan"} · {log.scanned_by_name || "—"}</small>
                </span>
                <span className="v2-muted sf-nowrap">{formatDateEn(log.scanned_at, "short")}</span>
              </div>
            ))}
            {!data?.logs.length ? <Empty>No scans recorded yet.</Empty> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
