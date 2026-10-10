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
    // A 500-student run can contain more than 1,500 Cloudinary photos. Give
    // those large print sheets longer to decode before falling back, without
    // slowing down single tickets or small print batches.
    const isLargeBulkPrint = document.querySelectorAll(".ticket-bulk-page").length > 20;
    const fallbackMs = isLargeBulkPrint ? 30_000 : 8_000;
    const fallback = new Promise<void>((resolve) => { timeout = setTimeout(resolve, fallbackMs); });
    void Promise.race([ready, fallback]).then(() => {
      clearTimeout(timeout);
      requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) window.print(); }));
    });
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);
  return null;
}
