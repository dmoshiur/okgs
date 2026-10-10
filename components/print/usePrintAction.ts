"use client";

import { useEffect, useRef, useState } from "react";
import { fitTicketText, preparePrint, printPreparationNotice } from "@/lib/print-ready";

/** Manual printing follows the same readiness contract as automatic printing. */
export function usePrintAction(context = "") {
  const [ready, setReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState("");
  const busyRef = useRef(false);
  const reviewedRef = useRef(false);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    setReady(true);
    const beforePrint = () => { fitTicketText(); };
    window.addEventListener("beforeprint", beforePrint);
    return () => { mountedRef.current = false; controllerRef.current?.abort(); window.removeEventListener("beforeprint", beforePrint); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => { if (!cancelled) fitTicketText(); });
    return () => { cancelled = true; };
  }, [context]);
  async function print() {
    if (busyRef.current) return;
    busyRef.current = true;
    setPreparing(true); setNotice("Preparing photos and fonts…");
    const controller = new AbortController();
    const sourceUrl = window.location.href;
    controllerRef.current = controller;
    try {
      const state = await preparePrint(controller.signal);
      if (!mountedRef.current) return;
      if (window.location.href !== sourceUrl) { setNotice("The print selection changed. Press Print again for the current view."); return; }
      const warning = printPreparationNotice(state);
      if (state.missingQr || state.unsafeTickets || (warning && !reviewedRef.current)) {
        reviewedRef.current = true;
        setNotice(warning);
        return;
      }
      reviewedRef.current = false; setNotice("");
      // Two frames let updated font sizes reach the printable layout.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (!controller.signal.aborted && mountedRef.current && window.location.href === sourceUrl) window.print();
    } catch { if (!controller.signal.aborted && mountedRef.current) setNotice("Could not prepare the print view. Refresh and try again."); }
    finally { busyRef.current = false; if (mountedRef.current) setPreparing(false); }
  }
  return { print, preparing, notice, ready };
}
