"use client";

import { en } from "@/lib/format";
import { formatSchoolDate, formatSchoolTime } from "@/lib/school-time";
import { LUNCH_RESULT_LABEL, LUNCH_RESULT_TONE, type LunchResult, type ScanMode } from "@/lib/scan-types";
import { GATE_RESULT_LABEL, gateResultClass } from "@/components/sf/gate-status";
import { Empty } from "@/components/sf/console/ui";
import type { ScannerLog } from "@/components/sf/scan-view";

export function ScannerAuditLog({ rows, mode, loading }: { rows: ScannerLog[]; mode: ScanMode; loading: boolean }) {
  const label = (result: string) => mode === "lunch" ? LUNCH_RESULT_LABEL[result as LunchResult] || "Recorded" : GATE_RESULT_LABEL[result] || "Recorded";
  const badge = (result: string) => mode === "lunch"
    ? LUNCH_RESULT_TONE[result as LunchResult] === "success" ? "is-good" : LUNCH_RESULT_TONE[result as LunchResult] === "warn" ? "is-warn" : "is-bad"
    : gateResultClass(result);
  if (!rows.length) return <Empty>{loading ? "Loading scan records…" : "No scans recorded for this filter yet."}</Empty>;
  return (
    <>
      <ol className="sf-scan-log-cards" aria-label="Recent scans">
        {rows.map((log) => (
          <li key={log.id}>
            <div><strong>{log.subject_name || "Unknown ticket"}</strong><span className={`sf-badge ${badge(log.result)}`}>{label(log.result)}</span></div>
            <p>{log.subject_code || "No verified ID"} · {log.method === "manual" ? "Manual ID" : "QR"}{log.action === "check" ? " · Check only" : ""}</p>
            <time dateTime={log.scanned_at}>{formatSchoolDate(log.scanned_at)} · {formatSchoolTime(log.scanned_at)}</time>
            <p>{log.note}</p>
            <small>Operator: {log.scanned_by_name || "—"}</small>
          </li>
        ))}
      </ol>
      <div className="sf-table-wrap sf-scan-log-table">
        <table className="sf-table">
          <caption className="sr-only">{mode === "lunch" ? "Canteen" : "Gate"} scans — all times in Bangladesh time</caption>
          <thead><tr><th>Date</th><th>Time</th><th>Result</th><th>Person</th><th>ID</th><th>Method</th><th>Operator</th><th>Note</th></tr></thead>
          <tbody>
            {rows.map((log) => (
              <tr key={log.id}>
                <td className="sf-nowrap">{formatSchoolDate(log.scanned_at)}</td>
                <td className="sf-nowrap">{formatSchoolTime(log.scanned_at)}</td>
                <td><span className={`sf-badge ${badge(log.result)}`}>{label(log.result)}</span></td>
                <td>{log.subject_name || "Unknown"}<small className="v2-muted sf-block">{log.subject_type || "Ticket"}</small></td>
                <td>{log.subject_code || "—"}</td>
                <td>{log.method === "manual" ? "Manual" : "QR"}{log.action === "check" ? " (check)" : ""}</td>
                <td>{log.scanned_by_name || "—"}</td>
                <td className="sf-note">{log.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="v2-muted sf-help">Showing the latest {en(rows.length)} attempts. Gate and canteen logs are kept separately.</p>
    </>
  );
}
