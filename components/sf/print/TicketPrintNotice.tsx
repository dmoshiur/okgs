/**
 * Screen-only notice for a bulk print job that cannot be rendered.
 *
 * The print route used to answer a bad `?job=` link with an empty page (when the
 * snapshot was unreadable) or with a server error (when a query threw). This is
 * the one surface both cases share: a plain sentence telling the office *what*
 * went wrong and *what to do next*, plus the actions that fix it. It carries the
 * `no-print` class, so nothing of it can ever reach the paper.
 */
export interface TicketPrintNoticeAction {
  label: string;
  /** Either a link to follow … */
  href?: string;
  /** … or an in-place action (the route error boundary retries). */
  onSelect?: () => void;
  primary?: boolean;
}

export function TicketPrintNotice({
  title,
  message,
  code,
  actions,
}: {
  /** What happened, in one line. */
  title: string;
  /** What the operator can do about it. */
  message: string;
  /** Stable diagnostic tag for the server log, e.g. `PRINT_JOB_EXPIRED`. */
  code?: string;
  actions: TicketPrintNoticeAction[];
}) {
  return (
    <div className="ticket-bulk-toolbar ticket-bulk-notice no-print" role="alert">
      <div className="ticket-bulk-notice-copy">
        <p className="ticket-bulk-notice-title">{title}</p>
        <p className="ticket-bulk-hint">{message}</p>
        {code ? (
          <p className="ticket-bulk-notice-code">
            <span>Reference</span> {code}
          </p>
        ) : null}
      </div>
      {actions.map((action, index) =>
        action.href ? (
          <a className={action.primary ? "ticket-bulk-print" : ""} href={action.href} key={`${action.label}-${index}`}>
            {action.label}
          </a>
        ) : (
          <button type="button" className={action.primary ? "ticket-bulk-print" : ""} onClick={action.onSelect} key={`${action.label}-${index}`}>
            {action.label}
          </button>
        ),
      )}
    </div>
  );
}
