"use client";

/** Screen-only controls for one complete, unpaginated bulk print selection. */
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Languages, Printer } from "lucide-react";
import { ticketLangOptions, type TicketLang } from "@/lib/ticket-locale";
import { usePrintAction } from "@/components/print/usePrintAction";

export interface BulkTicketScope {
  fair: string;
}

export function BulkTicketToolbar({
  scope,
  lang,
  sheets,
  auto,
  hint,
  warning,
}: {
  scope: BulkTicketScope;
  lang: TicketLang;
  /** Total A4 page boxes in this continuous print view. */
  sheets: number;
  auto: boolean;
  hint: string;
  warning: string;
}) {
  const router = useRouter();
  const printAction = usePrintAction(hint + (lang || "en"));

  const href = useCallback(
    (next: { lang?: TicketLang; auto?: boolean }) => {
      // Preserve the job snapshot, selected IDs, rolls and filters exactly as
      // received; changing a display preference must not broaden the selection.
      const params = new URLSearchParams(window.location.search);
      if (scope.fair) params.set("fair", scope.fair);
      const language = next.lang ?? lang;
      if (language === "en") params.delete("lang");
      else params.set("lang", language);
      params.set("auto", (next.auto ?? auto) ? "1" : "0");
      return `${window.location.pathname}?${params.toString()}`;
    },
    [scope.fair, lang, auto],
  );

  return (
    <div className="ticket-bulk-toolbar no-print">
      <span className="ticket-bulk-hint">{hint}</span>
      <div className="ticket-bulk-group" role="group" aria-label="Ticket language">
        <span className="ticket-bulk-label">
          <Languages size={12} /> Language
        </span>
        {ticketLangOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            title={option.hint}
            className={option.id === lang ? "is-active" : ""}
            aria-pressed={option.id === lang}
            onClick={() => router.push(href({ lang: option.id, auto: false }))}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button type="button" className={auto ? "is-active" : ""} aria-pressed={auto} onClick={() => router.push(href({ auto: !auto }))}>
        Open print dialog {auto ? "on" : "off"}
      </button>
      <button type="button" className="ticket-bulk-print" disabled={!printAction.ready || printAction.preparing} onClick={() => void printAction.print()}>
        <Printer size={15} /> {!printAction.ready ? "Loading view…" : printAction.preparing ? "Preparing…" : `Print ${sheets === 1 ? "1 A4 sheet" : `${sheets} A4 sheets`}`}
      </button>
      {warning ? <p className="ticket-bulk-warning">{warning}</p> : null}
      {printAction.notice ? <p className="print-ready-note" role="status">{printAction.notice}</p> : null}
    </div>
  );
}
