"use client";

import { useEffect, useState } from "react";
import { preparePrint, printPreparationNotice } from "@/lib/print-ready";

/** Only print automatically when fonts, photos, QR and safe-area text are ready. */
export function AutoPrint() {
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("auto") === "0") return;
    const controller = new AbortController();
    void preparePrint(controller.signal).then((state) => {
      if (controller.signal.aborted) return;
      const warning = printPreparationNotice(state);
      if (warning) { setNotice(`Automatic printing paused. ${warning}`); return; }
      requestAnimationFrame(() => requestAnimationFrame(() => { if (!controller.signal.aborted) window.print(); }));
    }).catch(() => { if (!controller.signal.aborted) setNotice("Automatic printing paused. Use Print after reviewing the loaded preview."); });
    return () => controller.abort();
  }, []);
  return notice ? <p className="print-ready-note no-print" role="status">{notice}</p> : null;
}
