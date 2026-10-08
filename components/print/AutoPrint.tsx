"use client";

import { useEffect } from "react";

/** Opens the browser print dialog once the ticket has rendered (skip with ?auto=0). */
export function AutoPrint() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("auto") === "0") return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
