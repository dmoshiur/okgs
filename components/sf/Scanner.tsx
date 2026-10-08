"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CameraOff, CheckCircle2, CircleAlert, Keyboard, RotateCcw, ScanLine, TriangleAlert, XCircle } from "lucide-react";
import jsQR from "jsqr";
import { en, formatDateTimeEn } from "@/lib/format";
import { Empty, Notice, Panel, postJson, useApi } from "@/components/sf/console/ui";

type EntryResult = "success" | "duplicate" | "expired" | "invalid";

interface EntryOutcome {
  result: EntryResult;
  title: string;
  message: string;
  subject: { type: "student" | "guest"; id: string; name: string; code: string; detail: string } | null;
  entry_time: string;
  scanned_at: string;
}

interface LegacyOutcome {
  result: string;
  tone: "success" | "warn" | "danger";
  title: string;
  message: string;
}

interface ScanLog {
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

interface LogsResponse {
  logs: ScanLog[];
  summary: { success: number; duplicate: number; expired: number; invalid: number; admitted: number };
}

const RESULT_STYLE: Record<EntryResult, { tone: "success" | "warn" | "danger"; label: string }> = {
  success: { tone: "success", label: "SUCCESS" },
  duplicate: { tone: "warn", label: "DUPLICATE" },
  expired: { tone: "warn", label: "EXPIRED" },
  invalid: { tone: "danger", label: "INVALID" },
};

/** A signed ticket token is base64url JSON, so it always starts with "eyJr". */
function isTicketToken(value: string) {
  return value.startsWith("eyJr") && value.includes(".");
}

function errorText(issue: unknown) {
  return issue instanceof Error ? issue.message : "Scan failed. Please try again.";
}

/** Gate scanner: verifies signed student/guest tickets, admits by manual ID, and logs every attempt. */
export function Scanner({ fairSlug, fairName }: { fairSlug: string; fairName: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const [active, setActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<{ tone: "success" | "warn" | "danger"; label: string; title: string; message: string; outcome?: EntryOutcome } | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);

  const logs = useApi<LogsResponse>(`/api/staff/entry/logs?fair=${encodeURIComponent(fairSlug)}&limit=150`, [fairSlug]);
  const summary = logs.data?.summary ?? { success: 0, duplicate: 0, expired: 0, invalid: 0, admitted: 0 };
  // Kept in a ref so the camera effect below is not restarted on every render.
  const reloadLogs = useRef(logs.reload);
  reloadLogs.current = logs.reload;

  const submit = useCallback(
    async (value: string, method: "qr" | "manual" = "qr") => {
      const text = value.trim();
      if (!text) return;
      setBusy(true);
      try {
        if (method === "qr" && !isTicketToken(text)) {
          // Legacy pass / project QR codes keep using the original verifier.
          const legacy = await postJson<LegacyOutcome>("/api/staff/scan", { token: text, fair_slug: fairSlug });
          setResult({ tone: legacy.tone, label: legacy.result.toUpperCase(), title: legacy.title, message: legacy.message });
        } else {
          const payload = await postJson<EntryOutcome>(
            "/api/staff/entry/scan",
            method === "qr" ? { token: text, fair_slug: fairSlug } : { code: text, fair_slug: fairSlug },
          );
          const style = RESULT_STYLE[payload.result];
          setResult({ tone: style.tone, label: style.label, title: payload.title, message: payload.message, outcome: payload });
        }
        if (navigator.vibrate) navigator.vibrate(60);
        await reloadLogs.current();
      } catch (issue) {
        setResult({ tone: "danger", label: "INVALID", title: "Scan failed", message: errorText(issue) });
      } finally {
        setBusy(false);
      }
    },
    [fairSlug],
  );

  useEffect(() => {
    if (!active) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }
    let cancelled = false;
    let frame = 0;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          await video.play().catch(() => undefined);
        }
        tick();
      } catch {
        setCameraError("The camera could not be started. Allow camera access, or type the ticket code below.");
        setActive(false);
      }
    }

    function tick() {
      frame = window.requestAnimationFrame(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
            if (code?.data) {
              const now = Date.now();
              // Ignore the same code for 4 seconds so one ticket is not logged 30 times.
              if (code.data !== lastRef.current.value || now - lastRef.current.at > 4000) {
                lastRef.current = { value: code.data, at: now };
                void submit(code.data, "qr");
              }
            }
          }
        }
        tick();
      });
    }

    void start();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [active, submit]);

  return (
    <div className="v2 app-shell sf-console sf-scan-page">
      <header className="app-top">
        <div className="v2-wrap app-top-inner">
          <div className="brand">
            <div className="brand-copy">
              <strong>Gate scanner</strong>
              <small>{fairName}</small>
            </div>
          </div>
          <div className="app-top-actions">
            <Link className="v2-btn v2-btn-sm v2-btn-ghost" href="/sf">Back to console</Link>
          </div>
        </div>
      </header>

      <main className="v2-wrap app-body sf-stack">
        <div className="sf-scan-grid">
          <Panel title="Camera">
            <div className="sf-camera">
              <video ref={videoRef} muted playsInline className={active ? "is-live" : ""} />
              <canvas ref={canvasRef} hidden />
              {!active ? <div className="sf-camera-idle"><ScanLine size={30} /><span>Camera is off</span></div> : null}
            </div>
            <div className="sf-scan-buttons">
              <button type="button" className="v2-btn" onClick={() => { setCameraError(""); setActive((value) => !value); }}>
                {active ? <><CameraOff size={15} /> Stop camera</> : <><Camera size={15} /> Start camera</>}
              </button>
            </div>
            {cameraError ? <Notice kind="bad">{cameraError}</Notice> : null}
          </Panel>

          <Panel title="Manual entry">
            <form
              className="sf-manual"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(manual, isTicketToken(manual.trim()) ? "qr" : "manual");
              }}
            >
              <label>
                <span className="v2-label">Student ID, or a ticket code pasted from the QR</span>
                <input className="v2-input" value={manual} onChange={(event) => setManual(event.target.value)} placeholder="e.g. 2026-0001" autoComplete="off" />
              </label>
              <div className="sf-scan-buttons">
                <button type="submit" className="v2-btn" disabled={busy || !manual.trim()}><Keyboard size={15} /> {busy ? "Checking…" : "Admit"}</button>
                <button type="button" className="v2-btn v2-btn-ghost" onClick={() => { setManual(""); setResult(null); }}><RotateCcw size={14} /> Clear</button>
              </div>
              <p className="v2-muted sf-help">A student ID is matched against the roster and logged as a manual entry. Tickets scanned by camera are verified by signature first.</p>
            </form>
          </Panel>

          <div className={`sf-result sf-result-${result?.tone ?? "idle"}`} role="status" aria-live="polite">
            {!result ? (
              <div className="sf-result-idle"><ScanLine size={28} /><strong>Ready to scan</strong><span>Point the camera at a ticket or enter an ID.</span></div>
            ) : (
              <>
                <span className="sf-result-label">
                  {result.tone === "success" ? <CheckCircle2 size={18} /> : result.tone === "warn" ? <TriangleAlert size={18} /> : <XCircle size={18} />}
                  {result.label}
                </span>
                <strong className="sf-result-title">{result.title}</strong>
                <span className="sf-result-message">{result.message}</span>
                {result.outcome?.subject ? (
                  <dl className="sf-result-subject">
                    <div><dt>{result.outcome.subject.type === "guest" ? "Guest" : "Student"}</dt><dd>{result.outcome.subject.name}</dd></div>
                    <div><dt>ID</dt><dd>{result.outcome.subject.code || "—"}</dd></div>
                    <div><dt>Details</dt><dd>{result.outcome.subject.detail || "—"}</dd></div>
                    <div><dt>Entry time</dt><dd>{result.outcome.entry_time ? formatDateTimeEn(result.outcome.entry_time) : "—"}</dd></div>
                    <div><dt>Scanned at</dt><dd>{formatDateTimeEn(result.outcome.scanned_at)}</dd></div>
                  </dl>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="sf-stat-row">
          <span className="sf-stat sf-stat-good"><b>{en(summary.admitted)}</b> admitted</span>
          <span className="sf-stat sf-stat-good"><b>{en(summary.success)}</b> success</span>
          <span className="sf-stat sf-stat-warn"><b>{en(summary.duplicate)}</b> duplicate</span>
          <span className="sf-stat sf-stat-warn"><b>{en(summary.expired)}</b> expired</span>
          <span className="sf-stat sf-stat-bad"><b>{en(summary.invalid)}</b> invalid</span>
        </div>

        <Panel title="Scan audit log" action={<button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={() => logs.reload()}><RotateCcw size={14} /> Refresh</button>}>
          {logs.error ? <Notice kind="bad">{logs.error}</Notice> : null}
          <div className="sf-table-wrap">
            <table className="sf-table">
              <thead>
                <tr>
                  <th>Scanned at</th>
                  <th>Entry time</th>
                  <th>Result</th>
                  <th>Person</th>
                  <th>ID</th>
                  <th>Method</th>
                  <th>Scanned by</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {(logs.data?.logs ?? []).map((log) => (
                  <tr key={log.id}>
                    <td className="sf-nowrap">{formatDateTimeEn(log.scanned_at)}</td>
                    <td className="sf-nowrap">{log.entry_time ? formatDateTimeEn(log.entry_time) : "—"}</td>
                    <td><span className={`sf-badge ${log.result === "success" ? "is-good" : log.result === "duplicate" || log.result === "expired" ? "is-warn" : "is-bad"}`}>{log.result.toUpperCase()}</span></td>
                    <td>{log.subject_name || <span className="v2-muted">Unknown</span>}{log.subject_type ? <small className="v2-muted sf-block">{log.subject_type}</small> : null}</td>
                    <td>{log.subject_code || "—"}</td>
                    <td>{log.method === "manual" ? "Manual" : "QR"}</td>
                    <td>{log.scanned_by_name || "—"}</td>
                    <td className="sf-note">{log.note || "—"}</td>
                  </tr>
                ))}
                {!logs.data?.logs?.length && !logs.loading ? <tr><td colSpan={8}><Empty>No scans yet. Scans appear here with the exact time they happened.</Empty></td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>
        <p className="v2-muted sf-help"><CircleAlert size={13} /> Scanner for {fairName}. Legacy pass and project codes are still verified by their original rules.</p>
      </main>
    </div>
  );
}
