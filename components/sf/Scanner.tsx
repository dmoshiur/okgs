"use client";

/** Mobile-first gate/canteen scanner. Images stay on-device; only the decoded credential is sent. */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CameraOff, CircleAlert, Keyboard, PackageCheck, RotateCcw, ScanLine, Utensils } from "lucide-react";
import jsQR from "jsqr";
import { en } from "@/lib/format";
import { extractScanValue, isScanQr, isTicketQr } from "@/lib/scan-input";
import { guestTicketId } from "@/lib/ticket-identifiers";
import { LUNCH_RESULT_LABEL, LUNCH_RESULT_TONE, lunchStateLabel, type EntryOutcome, type LunchAction, type LunchOutcome, type ScanMethod, type ScanMode, type ScanTone } from "@/lib/scan-types";
import { GATE_RESULT_LABEL } from "@/components/sf/gate-status";
import { Notice, Panel, useApi } from "@/components/sf/console/ui";
import { ScanResultDialog } from "@/components/sf/ScanResultDialog";
import { ScannerAuditLog } from "@/components/sf/ScannerAuditLog";
import type { ScanDisplay, ScannerLogsResponse } from "@/components/sf/scan-view";
import "@/components/sf/scanner.css";

interface LegacyOutcome {
  result: string;
  tone: ScanTone;
  title: string;
  message: string;
  pass?: { id: string; holder_name: string; holder_role: string; student_id: string; class_level: string; section: string; parent_pass_id: string };
}

const ENTRY_TONE: Record<EntryOutcome["result"], ScanTone> = { success: "success", duplicate: "warn", expired: "warn", invalid: "danger" };

async function scanRequest<T>(url: string, body: Record<string, unknown>, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const payload = await response.json().catch(() => null) as (T & { ok?: boolean; error?: string }) | null;
  if (!response.ok || !payload || payload.ok === false) throw new Error(payload?.error || `Verification failed (HTTP ${response.status}). Check status before serving.`);
  return payload;
}

export function Scanner({ fairSlug, fairName, initialMode = "gate" }: { fairSlug: string; fairName: string; initialMode?: ScanMode }) {
  const mode = initialMode;
  const isLunch = mode === "lunch";
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const lastQrRef = useRef("");
  const noCodeSinceRef = useRef(0);
  const busyRef = useRef(false);
  const pausedRef = useRef(false);
  const mountedRef = useRef(false);
  const startingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);
  const credentialRef = useRef<{ value: string; method: ScanMethod } | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<ScanDisplay | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [onlyToday, setOnlyToday] = useState(true);
  const logsUrl = `/api/staff/${isLunch ? "lunch" : "entry"}/logs?fair=${encodeURIComponent(fairSlug)}&limit=150&today=${onlyToday ? "1" : "0"}`;
  const logs = useApi<ScannerLogsResponse>(logsUrl, [logsUrl]);
  const summary = logs.data?.summary;
  const reloadLogs = useRef(logs.reload);
  reloadLogs.current = logs.reload;

  const dismissPopup = useCallback(() => {
    if (busyRef.current) return;
    setPopupOpen(false);
    pausedRef.current = false;
    // Keep lastQrRef: a stationary QR must leave the camera before re-scanning.
  }, []);

  const submit = useCallback(async (value: string, method: ScanMethod = "qr", action: LunchAction = "claim", fromPopup = false) => {
    const text = extractScanValue(value);
    if (!text || busyRef.current || (pausedRef.current && !fromPopup)) return;
    busyRef.current = true; // synchronous lock: React state alone cannot stop rapid camera frames/double taps.
    pausedRef.current = true;
    setBusy(true);
    credentialRef.current = { value: text, method };
    const version = ++requestVersionRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    const deadline = setTimeout(() => controller.abort(), 20_000);
    try {
      let display: ScanDisplay;
      const identity = method === "qr" ? { token: text, fair_slug: fairSlug } : { code: text, fair_slug: fairSlug };
      if (mode === "lunch") {
        // Never route a canteen QR through a gate/project verifier. It cannot consume entry rights.
        const outcome = await scanRequest<LunchOutcome>("/api/staff/lunch/scan", { ...identity, action }, controller.signal);
        display = { mode, tone: LUNCH_RESULT_TONE[outcome.result], label: LUNCH_RESULT_LABEL[outcome.result], title: outcome.title,
          message: outcome.message, subject: outcome.subject, lunch: outcome.lunch, outcome };
      } else if (method === "qr" && !isTicketQr(text)) {
        const legacy = await scanRequest<LegacyOutcome>("/api/staff/scan", identity, controller.signal);
        const pass = legacy.pass;
        const guest = pass?.holder_role === "guest" || Boolean(pass?.parent_pass_id);
        display = { mode, tone: legacy.tone, label: legacy.result === "ok" ? "Success" : GATE_RESULT_LABEL[legacy.result] || "Denied",
          title: legacy.title, message: legacy.message, subject: pass ? { type: guest ? "guest" : "student", id: pass.id,
            name: pass.holder_name, code: guest ? guestTicketId(pass.id) : pass.student_id, detail: [pass.class_level, pass.section].filter(Boolean).join(" · "), photo_url: "" } : null };
      } else {
        const outcome = await scanRequest<EntryOutcome>("/api/staff/entry/scan", identity, controller.signal);
        display = { mode, tone: ENTRY_TONE[outcome.result], label: GATE_RESULT_LABEL[outcome.result], title: outcome.title,
          message: outcome.message, subject: outcome.subject, lunch: outcome.lunch, outcome };
      }
      if (!mountedRef.current || version !== requestVersionRef.current) return;
      setResult(display);
      setPopupOpen(true);
      setManual("");
      try { navigator.vibrate?.(display.tone === "success" ? 60 : [80, 40, 80]); } catch { /* Haptics must never hide a recorded decision. */ }
      // Show the verification popup immediately; log refresh is not on its critical path.
      void reloadLogs.current();
    } catch (issue) {
      if (!mountedRef.current || version !== requestVersionRef.current) return;
      setResult({ mode, tone: "danger", label: "Not verified", title: "Verification unavailable", subject: null,
        message: controller.signal.aborted ? "The request timed out. No handover is confirmed; check status before serving."
          : issue instanceof Error ? issue.message : "The scan could not be checked. Check status before serving." });
      setPopupOpen(true);
    } finally {
      clearTimeout(deadline);
      if (version === requestVersionRef.current) {
        controllerRef.current = null;
        busyRef.current = false;
        if (mountedRef.current) setBusy(false);
      }
    }
  }, [fairSlug, mode]);
  const submitRef = useRef(submit);
  submitRef.current = submit;

  const stopCamera = useCallback(() => {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (mountedRef.current) setActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (startingRef.current || streamRef.current) return;
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access requires HTTPS and browser permission. You can still use manual verification below.");
      return;
    }
    startingRef.current = true;
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      if (!mountedRef.current || document.hidden) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stopCamera(); return; }
      video.srcObject = stream;
      await video.play();
      if (!mountedRef.current || !streamRef.current) return;
      setActive(true);
      let lastDecoded = 0;
      const tick = (at: number) => {
        frameRef.current = window.requestAnimationFrame(tick);
        if (pausedRef.current || busyRef.current || at - lastDecoded < 250) return;
        lastDecoded = at;
        const node = videoRef.current;
        const canvas = canvasRef.current;
        if (!node || !canvas || node.readyState < 2 || !node.videoWidth) return;
        const width = Math.min(960, node.videoWidth);
        const height = Math.round(width * node.videoHeight / node.videoWidth);
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(node, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height);
        const code = jsQR(pixels.data, width, height, { inversionAttempts: "attemptBoth" });
        if (!code?.data) {
          if (!noCodeSinceRef.current) noCodeSinceRef.current = at;
          if (at - noCodeSinceRef.current > 500) lastQrRef.current = "";
          return;
        }
        noCodeSinceRef.current = 0;
        if (code.data === lastQrRef.current) return;
        lastQrRef.current = code.data;
        void submitRef.current(code.data, "qr", "claim");
      };
      frameRef.current = window.requestAnimationFrame(tick);
    } catch {
      setCameraError("The camera could not be started. Allow camera access, or type/paste the ticket credential below.");
      stopCamera();
    } finally {
      startingRef.current = false;
      if (mountedRef.current) setStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    const visibility = () => { if (document.hidden) stopCamera(); else void reloadLogs.current(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", stopCamera);
    return () => {
      mountedRef.current = false;
      ++requestVersionRef.current;
      controllerRef.current?.abort();
      stopCamera();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", stopCamera);
    };
  }, [stopCamera]);

  useEffect(() => {
    ++requestVersionRef.current;
    controllerRef.current?.abort();
    busyRef.current = false;
    pausedRef.current = false;
    credentialRef.current = null;
    lastQrRef.current = "";
    setBusy(false); setPopupOpen(false); setResult(null);
  }, [fairSlug, mode]);

  // Refresh/reset from SERVER time, not the phone's clock or its timezone.
  useEffect(() => {
    if (!logs.data?.next_reset_at || !logs.data.server_time) return;
    const delay = new Date(logs.data.next_reset_at).getTime() - new Date(logs.data.server_time).getTime() + 500;
    const timer = setTimeout(() => {
      setResult(null); setPopupOpen(false); pausedRef.current = false; credentialRef.current = null;
      void reloadLogs.current();
    }, Math.max(1000, Math.min(delay, 24 * 60 * 60 * 1000)));
    return () => clearTimeout(timer);
  }, [logs.data]);

  const confirmHandover = () => {
    const credential = credentialRef.current;
    if (credential && result?.mode === "lunch" && result.outcome?.result === "ready") {
      void submit(credential.value, credential.method, "claim", true);
    }
  };
  const rows = logs.data?.logs || [];
  return (
    <div className="v2 app-shell sf-console sf-scan-page">
      <header className="app-top"><div className="v2-wrap app-top-inner">
        <div className="brand"><div className="brand-copy"><strong>{isLunch ? "Canteen scanner" : "Gate scanner"}</strong><small>{fairName}</small></div></div>
        <div className="app-top-actions"><Link className="v2-btn v2-btn-sm v2-btn-ghost" href="/sf">Dashboard</Link><Link className="v2-btn v2-btn-sm v2-btn-ghost" href="/sf/students">Students</Link></div>
      </div></header>
      <main className="v2-wrap app-body sf-main sf-stack">
        <div className="sf-scan-page-head">
          <div><h1 className="sf-page-title">{isLunch ? "Canteen lunch boxes" : "Gate scanner"}</h1><span className="sf-page-fair">{fairName} · Bangladesh time{logs.data?.day ? ` · ${logs.data.day}` : ""}</span></div>
          <div className="sf-scan-mode-tabs" aria-label="Scanner station">
            <Link href="/sf/scan" aria-current={!isLunch ? "page" : undefined}><ScanLine size={18} /> Gate entry</Link>
            <Link href="/sf/canteen" aria-current={isLunch ? "page" : undefined}><Utensils size={18} /> Lunch boxes</Link>
          </div>
        </div>
        {isLunch ? <Notice kind="ok">Paid students and paid lunch-box guests only. Scanning records one lunch claim for today. Gate admission is unchanged.</Notice> : null}
        <div className="sf-scan-workspace">
          <Panel title="Ticket camera" action={<span className="sf-badge">{busy ? "Checking…" : popupOpen ? "Paused for review" : active ? "Live" : "Camera off"}</span>}>
            <div className="sf-camera">
              <video ref={videoRef} autoPlay muted playsInline className={active ? "is-live" : ""} />
              <canvas ref={canvasRef} hidden />
              {active ? <><div className="sf-scan-camera-target" aria-hidden="true" /><div className="sf-scan-camera-status">{busy ? "Verifying securely…" : popupOpen ? "Review the result before the next ticket" : "Place the ticket QR inside the frame"}</div></> : <div className="sf-camera-idle"><ScanLine size={32} /><strong>Ready to scan</strong><span>Start the camera or use the quick form.</span></div>}
            </div>
            <div className="sf-scan-camera-actions"><button className="v2-btn" type="button" disabled={starting} onClick={() => active ? stopCamera() : void startCamera()}>{active ? <><CameraOff size={17} /> Stop camera</> : <><Camera size={17} /> {starting ? "Starting…" : "Start camera"}</>}</button></div>
            {cameraError ? <Notice kind="bad">{cameraError}</Notice> : null}
            <p className="v2-muted sf-help">Camera images never leave this phone. Scanning pauses while the popup is open; remove a ticket from view before scanning it again.</p>
          </Panel>
          <div className="sf-scan-controls">
            <Panel title="Quick verification form">
              <form className="sf-manual" onSubmit={(event) => { event.preventDefault(); void submit(manual, isScanQr(manual) ? "qr" : "manual"); }}>
                <label><span className="v2-label">Student ID or signed QR / pass URL</span><input className="v2-input" value={manual} onChange={(event) => setManual(event.target.value)} placeholder="Type a student ID or paste a ticket QR" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="text" maxLength={2048} disabled={busy} /></label>
                <div className="sf-scan-buttons">
                  {isLunch ? <button type="button" className="v2-btn v2-btn-ghost" disabled={busy || !manual.trim()} onClick={() => void submit(manual, isScanQr(manual) ? "qr" : "manual", "check")}><Keyboard size={16} /> Check only</button> : null}
                  <button type="submit" className="v2-btn" disabled={busy || !manual.trim()}>{isLunch ? <PackageCheck size={17} /> : <Keyboard size={17} />}{busy ? "Checking…" : isLunch ? "Claim lunch box" : "Verify entry"}</button>
                  <button type="button" className="v2-btn v2-btn-ghost" disabled={busy} onClick={() => { setManual(""); setResult(null); credentialRef.current = null; }} aria-label="Clear manual input"><RotateCcw size={16} /></button>
                </div>
                <p className="v2-muted sf-help">{isLunch ? "Check only does not consume a lunch. Use Confirm handover in its popup to claim. Guests must present their own signed ticket, not a student's ID." : "Manual IDs are matched against live roster payments. Signed QRs are verified on the server."}</p>
              </form>
            </Panel>
            <section className={`sf-scan-last-result sf-result-${result?.tone || "idle"}`} aria-label="Last verification status">
              <h2>Confirmation & status tracking</h2>
              <dl className="sf-scan-mini-status">
                <div><dt>Name</dt><dd>{result?.subject?.name || "Awaiting a scan"}</dd></div>
                <div><dt>ID</dt><dd>{result?.subject?.code || "—"}</dd></div>
                <div className="is-wide"><dt>Lunch box status</dt><dd>{lunchStateLabel(result?.lunch)}</dd></div>
              </dl>
              {result ? <><p className="sf-help">{result.message}</p><button type="button" className="v2-btn v2-btn-ghost" onClick={() => { pausedRef.current = true; setPopupOpen(true); }}>Open last result</button></> : <p className="v2-muted sf-help">Verified name, ID and today's lunch status appear here and in a prominent popup.</p>}
            </section>
          </div>
        </div>
        <div className="sf-scan-stat-strip">
          <span className="sf-stat sf-stat-good"><b>{en(isLunch ? summary?.claimed || 0 : summary?.admitted || 0)}</b> {isLunch ? "served today" : onlyToday ? "admitted today" : "admitted"}</span>
          <span className="sf-stat sf-stat-warn"><b>{en(summary?.duplicate || 0)}</b> {isLunch ? "already claimed today" : "duplicates"}</span>
          <span className="sf-stat sf-stat-bad"><b>{en((summary?.denied || 0) + (summary?.invalid || 0) + (summary?.expired || 0))}</b> denied</span>
        </div>
        <Panel title={isLunch ? "Canteen audit log" : "Gate audit log"} action={<div className="sf-scan-audit-heading"><label className="sf-radio"><input type="checkbox" checked={onlyToday} onChange={(event) => setOnlyToday(event.target.checked)} /> Today only</label><button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={() => void logs.reload()}><RotateCcw size={14} /> Refresh</button></div>}>
          {logs.error ? <Notice kind="bad">{logs.error}</Notice> : null}
          <ScannerAuditLog rows={rows} mode={mode} loading={logs.loading} />
        </Panel>
        <p className="v2-muted sf-help"><CircleAlert size={14} /> {isLunch ? "Lunch claims reset automatically at 00:00 Asia/Dhaka. Previous days remain in the audit trail." : "Student/guest tickets and legacy family/project QRs keep their separate verification and audit rules."}</p>
      </main>
      <ScanResultDialog result={popupOpen ? result : null} busy={busy} onClose={dismissPopup} onConfirm={confirmHandover} />
    </div>
  );
}
