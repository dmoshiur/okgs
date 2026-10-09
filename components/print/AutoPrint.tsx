"use client";

import { useEffect } from "react";

/** Wait for fonts and printable images before opening the dialog. */
export function AutoPrint() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("auto") === "0") return;
    let cancelled = false;
    const images = Array.from(document.querySelectorAll<HTMLImageElement>(".ticket-sheet img, .print-page img"));
    const ready = Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      ...images.map((image) => image.decode?.().catch(() => undefined) ?? Promise.resolve()),
    ]);
    let timeout: ReturnType<typeof setTimeout>;
    const fallback = new Promise<void>((resolve) => { timeout = setTimeout(resolve, 8000); });
    void Promise.race([ready, fallback]).then(() => {
      clearTimeout(timeout);
      requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) window.print(); }));
    });
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);
  return null;
}
