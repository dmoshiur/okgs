"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return <button className="v2-btn no-print" type="button" onClick={() => window.print()}><Printer size={15} /> {label}</button>;
}
