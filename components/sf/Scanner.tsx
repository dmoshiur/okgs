"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CameraOff, CheckCircle2, Keyboard, RotateCcw, ScanLine, TriangleAlert, XCircle } from "lucide-react";
import jsQR from "jsqr";
import type { PassRow, ScanRow } from "@/lib/portal-db";
import { bn, formatDate } from "@/lib/format";
import { Empty, Notice, Panel, postJson, useApi } from "@/components/sf/console/ui";

interface ScanResult {
  result: "ok" | "duplicate" | "invalid" | "expired" | "revoked";
  tone: "success" | "warn" | "danger";
  title: string;
  message: string;
  pass?: PassRow;
}

/** Camera QR scanner for teachers — verifies a fair pass in one tap. */
export function Scanner({ fairSlug, fairName }: { fairSlug: string; fairName: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const [active, setActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, reload } = useApi<{ scans: ScanRow[]; stats: Record<string, number> }>(`/api/staff/scan?fair=${encodeURIComponent(fairSlug)}`, [fairSlug]);

  const submit = useCallback(
    async (value: string) => {
      if (!value.trim()) return;
      setBusy(true);
      try {
        const payload = await postJson<ScanResult>("/api/staff/scan", { token: value, fair_slug: fairSlug });
        setResult(payload as ScanResult);
        if (navigator.vibrate) navigator.vibrate(payload.result === "ok" ? 60 : [40, 60, 40]);
        void reload();
      } catch (issue) {
        setResult({
          result: "invalid",
          tone: "danger",
          title: "স্ক্যান ব্যর্থ",
          message: issue instanceof Error ? issue.message : "আবার চেষ্টা করুন।",
        });
      } finally {
        setBusy(false);
      }
    },
    [fairSlug, reload],
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
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
        setCameraError("ক্যামেরা চালু করা যায়নি। অনুমতি দিন, অথবা নিচে টোকেন লিখে যাচাই করুন।");
        setActive(false);
      }
    }

    function tick() {
      frame = window.requestAnimationFrame(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          const width = video.videoWidth;
          const height = video.videoHeight;
          if (width && height) {
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (context) {
              context.drawImage(video, 0, 0, width, height);
              const image = context.getImageData(0, 0, width, height);
              const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
              if (code?.data) {
                const now = Date.now();
                // Ignore the same code within 4 seconds so one card is not scanned 30 times.
                if (code.data !== lastRef.current.value || now - lastRef.current.at > 4000) {
                  lastRef.current = { value: code.data, at: now };
                  void submit(code.data);
                }
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

  const toneClass = result?.tone === "success" ? "scan-ok" : result?.tone === "warn" ? "scan-warn" : "scan-bad";
  const stats = data?.stats ?? {};

  return (
    <div className="v2 app-shell">
      <header className="app-top">
        <div className="v2-wrap app-top-inner">
          <div className="brand">
            <div className="brand-copy">
              <strong>QR যাচাই</strong>
              <small>{fairName}</small>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="v2-btn v2-btn-sm v2-btn-ghost" href="/sf">
              কনসোলে ফিরুন
            </Link>
            <button className="v2-btn v2-btn-sm" type="button" onClick={() => setActive(!active)}>
              {active ? <CameraOff size={15} /> : <Camera size={15} />} {active ? "বন্ধ" : "ক্যামেরা"}
            </button>
          </div>
        </div>
      </header>

      <main className="v2-wrap app-body" style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr) minmax(280px, .8fr)" }}>
        <div>
          <div className="scanner-stage">
            <video ref={videoRef} muted playsInline />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            {active ? <span className="scan-frame" /> : (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", textAlign: "center", padding: 24 }}>
                <div>
                  <ScanLine size={46} />
                  <p style={{ opacity: 0.85 }}>“ক্যামেরা” চাপ দিয়ে QR কোড স্ক্যান করুন।</p>
                </div>
              </div>
            )}
          </div>

          {cameraError ? <Notice kind="bad">{cameraError}</Notice> : null}

          {result ? (
            <div className={`scan-result ${toneClass}`}>
              <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {result.tone === "success" ? <CheckCircle2 size={20} /> : result.tone === "warn" ? <TriangleAlert size={20} /> : <XCircle size={20} />}
                {result.title}
              </strong>
              <span>{result.message}</span>
              {result.pass ? (
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                  {result.pass.class_level}{result.pass.section ? ` · শাখা ${result.pass.section}` : ""} · স্ক্যান {bn(result.pass.scan_count ?? 0)} বার
                </div>
              ) : null}
              <button className="v2-btn v2-btn-sm v2-btn-ghost" style={{ marginTop: 10 }} type="button" onClick={() => { setResult(null); lastRef.current = { value: "", at: 0 }; }}>
                <RotateCcw size={14} /> আবার স্ক্যান
              </button>
            </div>
          ) : null}

          <Panel title="টোকেন দিয়ে যাচাই" className="" >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input className="v2-input" style={{ flex: 1, minWidth: 220 }} value={manual} onChange={(e) => setManual(e.target.value)} placeholder="যেমন: a1b2c3d4.signature অথবা /pass/..." />
              <button className="v2-btn" type="button" disabled={busy || !manual.trim()} onClick={() => submit(manual)}>
                <Keyboard size={16} /> যাচাই
              </button>
            </div>
            <p className="v2-muted" style={{ fontSize: 12.5, marginBottom: 0 }}>
              QR না পড়লে শিক্ষার্থীর কার্ডে লেখা টোকেন / লিংক লিখে দিন — HMAC স্বাক্ষর মিললেই যাচাই হবে।
            </p>
          </Panel>
        </div>

        <div className="v2-grid" style={{ alignContent: "start" }}>
          <Panel title="এই মেলার স্ক্যান">
            <div className="pill-row">
              <span className="badge-soft">সফল {bn(stats.ok ?? 0)}</span>
              <span className="badge-soft">পুনরায় {bn(stats.duplicate ?? 0)}</span>
              <span className="badge-soft">ভুল {bn(stats.invalid ?? 0)}</span>
              <span className="badge-soft">মেয়াদোত্তীর্ণ {bn(stats.expired ?? 0)}</span>
            </div>
          </Panel>
          <Panel title="সাম্প্রতিক">
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              {(data?.scans ?? []).map((scan) => (
                <div key={scan.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--okgs-line)", fontSize: 13 }}>
                  <span className={`badge-soft ${scan.result === "ok" ? "status-ok" : scan.result === "duplicate" ? "status-pending" : "status-bad"}`}>{scan.result}</span>
                  <span style={{ flex: 1 }}>{scan.scanned_by_name || "—"}</span>
                  <span className="v2-muted">{formatDate(scan.created_at)}</span>
                </div>
              ))}
              {!(data?.scans ?? []).length ? <Empty>এখনো কোনো স্ক্যান হয়নি।</Empty> : null}
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}
