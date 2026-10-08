"use client";

/**
 * Gate scanner — the one screen of the panel that is not a console section.
 *
 * It verifies a signed ticket QR (student or outside guest), admits a person by
 * school ID when the code cannot be read, and writes every attempt — accepted or
 * refused — to `scan_logs` with the exact date and time. The camera never leaves
 * the device: only the decoded string is posted for verification.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CameraOff, CheckCircle2, CircleAlert, Keyboard, RotateCcw, ScanLine, TriangleAlert, XCircle } from "lucide-react";
import jsQR from "jsqr";
import { en, formatDateEn, formatDateTimeEn, formatTimeEn } from "@/lib/format";
import { GATE_RESULT_LABEL, gateResultClass } from "@/components/sf/gate-status";
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

const RESULT_TONE: Record<EntryResult, "success" | "warn" | "danger"> = {
  success: "success",
  duplicate: "warn",
  expired: "warn",
  invalid: "danger",
};

/** A signed ticket token is base64url JSON, so it always starts with "eyJr". */
function isTicketToken(value: string) {
  return value.startsWith("eyJr") && value.includes(".");
}

function errorText(issue: unknown) {
  return issue instanceof Error ? issue.message : "The scan could not be checked. Try again.";
}

export function Scanner({ fairSlug, fairName }: { fairSlug: string; fairName: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const lastRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const [active, setActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<{ tone: "success" | "warn" | "danger"; label: string; title: string; message: string; outcome?: EntryOutcome } | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [onlyToday, setOnlyToday] = useState(false);

  const logs = useApi<LogsResponse>(`/api/staff/entry/logs?fair=${encodeURIComponent(fairSlug)}&limit=150`, [fairSlug]);
  const summary = logs.data?.summary ?? { success: 0, duplicate: 0, expired: 0, invalid: 0, admitted: 0 };
  // Kept in a ref so the camera loop is never restarted by a re-render.
  const reloadLogs = useRef(logs.reload);
  reloadLogs.current = logs.reload;

  const submit = useCallback(
    async (value: string, method: "qr" | "manual" = "qr") => {
      const text = value.trim();
      if (!text) return;
      setBusy(true);
      try {
        if (method === "qr" && !isTicketToken(text)) {
          // Legacy family/guest passes keep using their original verifier.
          const legacy = await postJson<LegacyOutcome>("/api/staff/scan", { token: text, fair_slug: fairSlug });
          setResult({ tone: legacy.tone, label: (legacy.result || "").toUpperCase() || "RECORDED", title: legacy.title, message: legacy.message });
        } else {
          const payload = await postJson<EntryOutcome>(
            "/api/staff/entry/scan",
            method === "qr" ? { token: text, fair_slug: fairSlug } : { code: text, fair_slug: fairSlug },
          );
          setResult({
            tone: RESULT_TONE[payload.result],
            label: GATE_RESULT_LABEL[payload.result]?.toUpperCase() ?? "RECORDED",
            title: payload.title,
            message: payload.message,
            outcome: payload,
          });
        }
        if (navigator.vibrate) navigator.vibrate(60);
        setManual("");
        await reloadLogs.current();
      } catch (issue) {
        setResult({ tone: "danger", label: GATE_RESULT_LABEL.invalid.toUpperCase(), title: "Scan failed", message: errorText(issue) });
      } finally {
        setBusy(false);
      }
    },
    [fairSlug],
  );

  const stopCamera = useCallback(() => {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    if (streamRef.current) {
      setActive(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play().catch(() => undefined);
      }
      setActive(true);

      const tick = () => {
        frameRef.current = window.requestAnimationFrame(tick);
        const node = videoRef.current;
        const canvas = canvasRef.current;
        if (!node || !canvas || node.readyState !== node.HAVE_ENOUGH_DATA || !node.videoWidth) return;
        canvas.width = node.videoWidth;
        canvas.height = node.videoHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(node, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
        if (!code?.data) return;
        const now = Date.now();
        // The same ticket is read many times per second — one log every 4s.
        if (code.data !== lastRef.current.value || now - lastRef.current.at > 4000) {
          lastRef.current = { value: code.data, at: now };
          void submit(code.data, "qr");
        }
      };
      tick();
    } catch {
      setCameraError("The camera could not be started. Allow camera access, or type the ticket code below.");
      stopCamera();
    }
  }, [stopCamera, submit]);

  // The torch stays off the moment the admin walks to another screen.
  useEffect(() => () => stopCamera(), [stopCamera]);

  const rows = (logs.data?.logs ?? []).filter((log) => {
    if (!onlyToday) return true;
    const day = new Date().toISOString().slice(0, 10);
    return String(log.scanned_at ?? "").slice(0, 10) === day;
  });

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
            <Link className="v2-btn v2-btn-sm v2-btn-ghost" href="/sf">Dashboard</Link>
            <Link className="v2-btn v2-btn-sm v2-btn-ghost" href="/sf/students">Students</Link>
            <button className="v2-btn v2-btn-sm" type="button" onClick={() => (active ? stopCamera() : void startCamera())}>
              {active ? <><CameraOff size={15} /> Stop camera</> : <><Camera size={15} /> Start camera</>}
            </button>
          </div>
        </div>
      </header>

      <main className="v2-wrap app-body sf-main sf-stack">
        <div className="sf-page-head">
          <h1 className="sf-page-title">Gate scanner</h1>
          <span className="sf-page-fair">{en(summary.admitted)} people admitted · {fairName}</span>
        </div>

        <div className="sf-scan-grid">
          <Panel title="Camera">
            <div className="sf-camera">
              <video ref={videoRef} muted playsInline className={active ? "is-live" : ""} />
              <canvas ref={canvasRef} hidden />
              {!active ? (
                <div className="sf-camera-idle">
                  <ScanLine size={30} />
                  <span>Camera is off</span>
                  <span className="v2-muted">Press “Start camera”, or use manual entry below.</span>
                </div>
              ) : null}
            </div>
            <p className="v2-muted sf-help">The picture stays on this device — nothing is uploaded, only the code inside the QR is sent for verification.</p>
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
                <input className="v2-input" value={manual} onChange={(event) => setManual(event.target.value)} placeholder="e.g. 2026-0001" autoComplete="off" inputMode="text" />
              </label>
              <div className="sf-scan-buttons">
                <button type="submit" className="v2-btn" disabled={busy || !manual.trim()}><Keyboard size={15} /> {busy ? "Checking…" : "Admit"}</button>
                <button type="button" className="v2-btn v2-btn-ghost" onClick={() => { setManual(""); setResult(null); }}><RotateCcw size={14} /> Clear</button>
              </div>
              <p className="v2-muted sf-help">A student ID is matched against the roster and logged as a manual entry. Tickets scanned by camera are verified by signature first.</p>
            </form>
          </Panel>

          <div className={`sf-result sf-result-${result?.tone ?? "idle"}`} role="status" aria-live="assertive">
            {!result ? (
              <div className="sf-result-idle">
                <ScanLine size={28} />
                <strong>Ready to scan</strong>
                <span>Point the camera at a ticket or enter an ID.</span>
              </div>
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

        <Panel
          title="Scan audit log"
          action={
            <div className="sf-scan-buttons">
              <label className="sf-radio">
                <input type="checkbox" checked={onlyToday} onChange={(event) => setOnlyToday(event.target.checked)} />
                Today only
              </label>
              <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={() => logs.reload()}><RotateCcw size={14} /> Refresh</button>
            </div>
          }
        >
          {logs.error ? <Notice kind="bad">{logs.error}</Notice> : null}
          <div className="sf-table-wrap">
            <table className="sf-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Result</th>
                  <th>Person</th>
                  <th>ID</th>
                  <th>Method</th>
                  <th>Gate operator</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((log) => (
                  <tr key={log.id}>
                    <td className="sf-nowrap">{formatDateEn(log.scanned_at, "short") || "—"}</td>
                    <td className="sf-nowrap">{formatTimeEn(log.scanned_at) || "—"}</td>
                    <td><span className={`sf-badge ${gateResultClass(log.result)}`}>{GATE_RESULT_LABEL[log.result] ?? "Recorded"}</span></td>
                    <td>{log.subject_name || <span className="v2-muted">Unknown</span>}<small className="v2-muted sf-block">{log.subject_type === "guest" ? "Guest" : log.subject_type === "student" ? "Student" : "Ticket"}</small></td>
                    <td>{log.subject_code || "—"}</td>
                    <td>{log.method === "manual" ? "Manual" : "QR"}</td>
                    <td>{log.scanned_by_name || "—"}</td>
                    <td className="sf-note">{log.note || "—"}</td>
                  </tr>
                ))}
                {!rows.length && !logs.loading ? <tr><td colSpan={8}><Empty>No scans recorded yet. Every scan or manual admission appears here with its exact date and time.</Empty></td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>
        <p className="v2-muted sf-help"><CircleAlert size={13} /> Scanner for {fairName}. Legacy family and guest passes are still verified by their original rules; student and guardian tickets by their HMAC signature.</p>
      </main>
    </div>
  );
}
