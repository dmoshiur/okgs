"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Maximize2, Minimize2, PackageCheck, TriangleAlert, X, XCircle } from "lucide-react";
import { optimizedImage } from "@/lib/cloudinary";
import { formatSchoolDateTime } from "@/lib/school-time";
import { lunchStateLabel } from "@/lib/scan-types";
import type { ScanDisplay } from "@/components/sf/scan-view";

/** Native modal: focus trap, Escape handling and top-layer placement above mobile navigation. */
export function ScanResultDialog({ result, busy, onClose, onConfirm }: {
  result: ScanDisplay | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !result) return;
    setExpanded(false);
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [result]);
  if (!result) return null;
  const outcome = result.outcome;
  const canClaim = result.mode === "lunch" && outcome?.result === "ready" && result.lunch?.eligible && !result.lunch.claimed_today;
  const photo = optimizedImage(result.subject?.photo_url || "", { width: 120, height: 160, fit: "cover" });
  const recordedTime = outcome && "claim_time" in outcome ? outcome.claim_time : outcome && "entry_time" in outcome ? outcome.entry_time : "";
  return (
    <dialog
      ref={dialogRef}
      className={`sf-scan-dialog sf-result-${result.tone}${expanded ? " is-expanded" : ""}`}
      aria-labelledby="scan-result-title"
      aria-describedby="scan-result-message"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const dialog = event.currentTarget;
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])"))
          .filter((node) => node.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        // Native dialogs block the background, but some browsers tab onward to
        // browser chrome. Keep the confirmation workflow's keyboard focus inside.
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <header className="sf-scan-dialog-head">
        <span className="sf-result-label">
          {result.tone === "success" ? <CheckCircle2 size={22} /> : result.tone === "warn" ? <TriangleAlert size={22} /> : <XCircle size={22} />}
          {result.label}
        </span>
        <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" aria-label="Close scan result" disabled={busy} onClick={onClose}><X size={20} /></button>
      </header>
      <div className="sf-scan-dialog-body">
        <div role="status" aria-live="assertive" aria-atomic="true">
          <h2 id="scan-result-title" className="sf-result-title">{result.title}</h2>
          <p id="scan-result-message" className="sf-result-message">{result.message}</p>
        </div>
        <form className="sf-scan-person-form" onSubmit={(event) => { event.preventDefault(); if (canClaim && !busy) onConfirm(); }}>
          {photo ? <img className="sf-scan-person-photo" src={photo} alt={result.subject?.name || "Ticket holder"} /> : null}
          <label><span>Name</span><input readOnly value={result.subject?.name || "Not identified"} aria-label="Verified name" /></label>
          <label><span>{result.subject?.type === "guest" ? "Guest ID" : "Student ID"}</span><input readOnly value={result.subject?.code || "—"} aria-label="Verified ID" /></label>
          <label className="sf-scan-person-status"><span>Lunch box status</span><output aria-live="polite">{lunchStateLabel(result.lunch)}</output></label>
          {canClaim ? <button type="submit" className="v2-btn sf-scan-handover" disabled={busy}><PackageCheck size={18} /> {busy ? "Recording claim…" : "Confirm lunch box handover"}</button> : null}
        </form>
        <button type="button" className="sf-scan-expand" aria-expanded={expanded} aria-controls="scan-expanded-details" onClick={() => setExpanded((value) => !value)}>
          {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {expanded ? "Show compact view" : "Open full expanded view"}<ChevronDown size={16} />
        </button>
        {expanded ? (
          <dl id="scan-expanded-details" className="sf-scan-expanded-details">
            <div><dt>Full name</dt><dd>{result.subject?.name || "—"}</dd></div>
            <div><dt>Holder ID</dt><dd>{result.subject?.code || "—"}</dd></div>
            <div><dt>Holder type</dt><dd>{result.subject?.type || "Not identified"}</dd></div>
            <div><dt>Details</dt><dd>{result.subject?.detail || "—"}</dd></div>
            <div><dt>{result.mode === "lunch" ? "Claim time" : "Entry time"}</dt><dd>{formatSchoolDateTime(recordedTime)}</dd></div>
            <div><dt>Scanned at (Bangladesh)</dt><dd>{formatSchoolDateTime(outcome?.scanned_at || "")}</dd></div>
            <div><dt>School day</dt><dd>{result.lunch?.day || "—"}</dd></div>
            <div><dt>Next daily reset</dt><dd>{formatSchoolDateTime(result.lunch?.next_reset_at || "")}</dd></div>
            <div><dt>Record ID</dt><dd>{result.subject?.id || "—"}</dd></div>
            {outcome && "reason" in outcome && outcome.reason ? <div><dt>Verification detail</dt><dd>{outcome.reason}</dd></div> : null}
          </dl>
        ) : null}
      </div>
      <footer className="sf-scan-dialog-foot">
        <small>{result.mode === "lunch" ? "One lunch per person per Bangladesh day. Reprints do not add lunches." : "Gate entry does not claim a lunch box."}</small>
        <button type="button" className="v2-btn" disabled={busy} onClick={onClose}>Next scan</button>
      </footer>
    </dialog>
  );
}
