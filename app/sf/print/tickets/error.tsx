"use client";

/**
 * Last line of defence for the bulk ticket route.
 *
 * The page itself already answers a bad `?job=` link with a notice, so anything
 * that reaches this boundary is genuinely unexpected (a render fault, a failed
 * import, a database that died mid-request). Before, that was the raw server
 * error page — a printer left with a stack trace and the office with no idea
 * which job to re-prepare. Now it is the same notice, with the Next.js error
 * digest so the line can be found in the server log.
 */
import { TicketPrintNotice } from "@/components/sf/print/TicketPrintNotice";
import "@/components/sf/print/ticket-bulk.css";

export default function BulkTicketsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // The error text itself is deliberately not shown: it is a database or render
  // detail, and the office needs an instruction, not a stack. The digest is what
  // the server log can be searched with.
  return (
    <main className="ticket-bulk-root">
      <TicketPrintNotice
        title="The tickets could not be prepared"
        message="Something went wrong while the print sheet was being built, so nothing was sent to the printer. Try again; if it keeps happening, print class by class from Students and quote the reference below."
        code={error?.digest ? `PRINT_ROUTE_ERROR · ${error.digest}` : "PRINT_ROUTE_ERROR"}
        actions={[
          { label: "Back to students", href: "/sf/students", primary: true },
          { label: "Try again", onSelect: reset },
        ]}
      />
    </main>
  );
}
