"use client";

/**
 * Toolbar for the bulk ticket sheet (screen only — `no-print`).
 *
 * Every control writes to the URL, never to browser storage: the class scope,
 * the language, the page and the auto-print flag all travel in the query string,
 * so a link pasted into the office chat prints exactly what it says.
 */
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Languages, Printer } from "lucide-react";
import { ticketLangOptions, type TicketLang } from "@/lib/ticket-locale";

export interface BulkTicketScope {
  fair: string;
  class_name: string;
  section: string;
  shift: string;
  rolls: string;
}

export function BulkTicketToolbar({
  scope,
  lang,
  run,
  runs,
  sheets,
  totalSheets,
  size,
  auto,
  hint,
  warning,
}: {
  scope: BulkTicketScope;
  lang: TicketLang;
  /** Which print run this is (each run carries `size` tickets). */
  run: number;
  runs: number;
  /** A4 pages in this run — four tickets each. */
  sheets: number;
  /** A4 pages the whole scope needs. */
  totalSheets: number;
  size: number;
  auto: boolean;
  hint: string;
  /** e.g. "18 unpaid students are not printed." */
  warning: string;
}) {
  const router = useRouter();

  const href = useCallback(
    (next: Partial<{ run: number; size: number; lang: TicketLang; auto: boolean }>) => {
      const params = new URLSearchParams();
      if (scope.fair) params.set("fair", scope.fair);
      if (scope.class_name) params.set("class", scope.class_name);
      if (scope.section) params.set("section", scope.section);
      if (scope.shift) params.set("shift", scope.shift);
      if (scope.rolls) params.set("rolls", scope.rolls);
      const target = next.run ?? run;
      if (target > 1) params.set("page", String(target));
      const perPage = next.size ?? size;
      if (perPage !== 20) params.set("size", String(perPage));
      const language = next.lang ?? lang;
      if (language !== "en") params.set("lang", language);
      params.set("auto", (next.auto ?? auto) ? "1" : "0");
      return `${window.location.pathname}?${params.toString()}`;
    },
    [scope, run, size, lang, auto],
  );

  return (
    <div className="ticket-bulk-toolbar no-print">
      <span className="ticket-bulk-hint">{hint}</span>
      <div className="ticket-bulk-group" role="group" aria-label="A4 sheets in this run">
        <span className="ticket-bulk-label">
          {sheets} A4 sheet{sheets === 1 ? "" : "s"}
          {runs > 1 ? ` · run ${run} / ${runs}` : ` · ${totalSheets} in total`}
        </span>
        <button type="button" disabled={run <= 1} onClick={() => router.push(href({ run: run - 1, auto: false }))} aria-label="Previous run">
          <ChevronLeft size={15} />
        </button>
        <button type="button" disabled={run >= runs} onClick={() => router.push(href({ run: run + 1, auto: false }))} aria-label="Next run">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="ticket-bulk-group" role="group" aria-label="Tickets per print run">
        <span className="ticket-bulk-label">Per run</span>
        {[20, 40, 100].map((value) => (
          <button
            key={value}
            type="button"
            className={value === size ? "is-active" : ""}
            aria-pressed={value === size}
            title={`${value} tickets — ${value / 4} A4 pages`}
            onClick={() => router.push(href({ size: value, run: 1, auto: false }))}
          >
            {value}
          </button>
        ))}
      </div>
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
      <button type="button" className="ticket-bulk-print" onClick={() => window.print()}>
        <Printer size={15} /> Print {sheets === 1 ? "1 A4 sheet" : `${sheets} A4 sheets`}
      </button>
      {warning ? <p className="ticket-bulk-warning">{warning}</p> : null}
    </div>
  );
}
