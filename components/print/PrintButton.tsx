"use client";

import { Printer } from "lucide-react";
import { usePrintAction } from "@/components/print/usePrintAction";

export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  const action = usePrintAction();
  return <span className="no-print"><button className="v2-btn" type="button" disabled={!action.ready || action.preparing} onClick={() => void action.print()}><Printer size={15} /> {!action.ready ? "Loading view…" : action.preparing ? "Preparing print…" : label}</button>{action.notice ? <small className="print-ready-note" role="status">{action.notice}</small> : null}</span>;
}
