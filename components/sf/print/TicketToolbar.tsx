"use client";

/**
 * Toolbar above the printed sheets. Screen-only (`no-print`), and the one piece
 * of UI a teacher needs on a phone: a full-screen portrait preview, the number
 * of copies, the sheet language, and whether the print dialog opens by itself.
 *
 * Nothing here is remembered in the browser — the copy count and the language
 * travel in the URL, so a shared or re-opened link always prints what it says.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Languages, Maximize2, Minimize2, Printer } from "lucide-react";
import { ticketLangOptions, type TicketLang } from "@/lib/ticket-locale";

export function TicketToolbar({
  copies,
  fairSlug,
  guestId,
  auto,
  hint,
  lang,
}: {
  copies: number;
  fairSlug: string;
  guestId?: string;
  auto: boolean;
  hint: string;
  /** When set, the language toggle is shown and written back to `?lang=`. */
  lang?: TicketLang;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [full, setFull] = useState(false);

  const href = useCallback(
    (next: number, nextAuto: boolean, nextLang?: TicketLang) => {
      const params = new URLSearchParams();
      if (fairSlug) params.set("fair", fairSlug);
      if (next > 1) params.set("copies", String(next));
      if (guestId) params.set("guest", guestId);
      if (nextLang && nextLang !== "en") params.set("lang", nextLang);
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
            onClick={() => router.push(href(value, auto, lang))}
          >
            {value}
          </button>
        ))}
      </div>
      {lang ? (
        <div className="ticket-toolbar-group" role="group" aria-label="Ticket language">
          <span className="ticket-toolbar-label">
            <Languages size={12} /> Language
          </span>
          {ticketLangOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              title={option.hint}
              className={option.id === lang ? "is-active" : ""}
              aria-pressed={option.id === lang}
              onClick={() => router.push(href(copies, auto, option.id))}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      <button type="button" className={auto ? "is-active" : ""} aria-pressed={auto} onClick={() => router.push(href(copies, !auto, lang))}>
        Open print dialog {auto ? "on" : "off"}
      </button>
      <button type="button" onClick={toggleFull} aria-pressed={full}>
        {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />} {full ? "Exit full screen" : "Full screen"}
      </button>
      <button type="button" className="ticket-print-now" onClick={() => window.print()}>
        <Printer size={15} /> Print {copies === 1 ? "ticket" : `${copies} tickets`}
      </button>
    </div>
  );
}
