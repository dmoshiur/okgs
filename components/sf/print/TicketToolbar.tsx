"use client";

/**
 * Toolbar above the printed sheets. Screen-only (`no-print`), and the one piece
 * of UI a teacher needs on a phone: a full-screen landscape preview, the number
 * of copies, and whether the print dialog should open by itself.
 *
 * Nothing here is remembered in the browser — the copy count travels in the URL
 * so a shared or re-opened link always prints what the link says.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, Minimize2, Printer, RotateCw } from "lucide-react";

export function TicketToolbar({
  copies,
  fairSlug,
  guestId,
  auto,
  hint,
  total,
}: {
  copies: number;
  fairSlug: string;
  guestId?: string;
  auto: boolean;
  hint: string;
  /** Names of the copies, e.g. ["Student copy", "Parent copy", "School copy"]. */
  total: string[];
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [full, setFull] = useState(false);
  const [portrait, setPortrait] = useState(false);

  const href = useCallback(
    (next: number, nextAuto: boolean) => {
      const params = new URLSearchParams();
      if (fairSlug) params.set("fair", fairSlug);
      if (next > 1) params.set("copies", String(next));
      if (guestId) params.set("guest", guestId);
      params.set("auto", nextAuto ? "1" : "0");
      return `${window.location.pathname}?${params.toString()}`;
    },
    [fairSlug, guestId],
  );

  useEffect(() => {
    const sync = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // A phone held upright prints a cropped ticket — nudge towards landscape.
  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  async function toggleFull() {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    else await rootRef.current?.requestFullscreen?.().catch(() => undefined);
  }

  return (
    <div className="ticket-toolbar no-print" ref={rootRef}>
      <span className="ticket-hint">{hint}</span>
      <div className="ticket-toolbar-group" role="group" aria-label="Number of copies">
        <span className="ticket-toolbar-label">Copies</span>
        {[1, 2, 3].map((value) => (
          <button
            key={value}
            type="button"
            className={value === copies ? "is-active" : ""}
            aria-pressed={value === copies}
            onClick={() => router.push(href(value, auto))}
          >
            {value}
            <small>{total[value - 1] ? `— ${total[value - 1]}` : ""}</small>
          </button>
        ))}
      </div>
      <button type="button" className={auto ? "is-active" : ""} aria-pressed={auto} onClick={() => router.push(href(copies, !auto))}>
        Open print dialog {auto ? "on" : "off"}
      </button>
      <button type="button" onClick={toggleFull} aria-pressed={full}>
        {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />} {full ? "Exit full screen" : "Full screen"}
      </button>
      <button type="button" className="ticket-print-now" onClick={() => window.print()}>
        <Printer size={15} /> Print {copies === 1 ? "ticket" : `${copies} tickets`}
      </button>
      {portrait ? (
        <p className="ticket-rotate-hint">
          <RotateCw size={14} /> Turn the phone sideways — the ticket is laid out for landscape paper.
        </p>
      ) : null}
    </div>
  );
}
