/** Browser-only print preparation. Never scales cards or QR codes, and never drops a selection. */
export interface PrintPreparation {
  timedOut: boolean;
  missingImages: number;
  missingQr: boolean;
  unsafeTickets: number;
}

/** Fit only overflowing text; batch reads/writes so 500+ cards do not cause thousands of forced layouts. */
export function fitTicketText(): number {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(".ticket-fit-text"));
  for (const node of nodes) node.style.fontSize = "";
  const fits = (node: HTMLElement) => node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1;
  const work = nodes.filter((node) => !fits(node)).map((node) => ({ node,
    low: Number(node.dataset.fitMin || 8), high: parseFloat(getComputedStyle(node).fontSize), good: false }));
  for (const item of work) item.node.style.fontSize = `${item.low}px`;
  for (const item of work) item.good = fits(item.node);
  const searchable = work.filter((item) => item.good);
  for (let round = 0; round < 5; round++) {
    for (const item of searchable) item.node.style.fontSize = `${(item.low + item.high) / 2}px`;
    const decisions = searchable.map((item) => fits(item.node));
    searchable.forEach((item, index) => { const middle = (item.low + item.high) / 2; if (decisions[index]) item.low = middle; else item.high = middle; });
  }
  for (const item of searchable) item.node.style.fontSize = `${item.low}px`;
  const unsafe = new Set<Element>();
  for (const node of nodes) if (!fits(node)) { const ticket = node.closest(".ticket-sheet"); if (ticket) unsafe.add(ticket); }
  for (const frame of document.querySelectorAll<HTMLElement>(".ticket-frame")) {
    if (frame.scrollHeight > frame.clientHeight + 1) { const ticket = frame.closest(".ticket-sheet"); if (ticket) unsafe.add(ticket); }
  }
  return unsafe.size;
}

/** Wait for all printable photos/fonts, with bounded decode concurrency and a cancellable deadline. */
export async function preparePrint(signal?: AbortSignal): Promise<PrintPreparation> {
  const images = Array.from(document.querySelectorAll<HTMLImageElement>(".ticket-sheet img, .print-page img"));
  // Repeated logos/signatures share a decoded resource. Decode each source only once.
  const unique = Array.from(new Map(images.map((image) => [image.currentSrc || image.src, image])).values());
  let cursor = 0;
  let stopped = false;
  let timedOut = false;
  const decode = async () => {
    while (!stopped && !signal?.aborted && cursor < unique.length) {
      const image = unique[cursor++];
      try { if (image.decode) await image.decode(); } catch { /* Report failed/unfinished images below. */ }
    }
  };
  const ready = Promise.all([document.fonts?.ready ?? Promise.resolve(), ...Array.from({ length: Math.min(10, unique.length) }, decode)]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const budget = images.length > 200 ? 45_000 : 12_000;
  const deadline = new Promise<void>((resolve) => { timer = setTimeout(() => { timedOut = true; resolve(); }, budget); });
  const cancelled = new Promise<void>((resolve) => { abort = () => resolve(); signal?.addEventListener("abort", abort, { once: true }); if (signal?.aborted) resolve(); });
  try { await Promise.race([ready, deadline, cancelled]); }
  finally { stopped = true; clearTimeout(timer); if (abort) signal?.removeEventListener("abort", abort); }
  if (signal?.aborted) throw new DOMException("Print preparation cancelled", "AbortError");
  const missing = unique.filter((image) => !image.complete || !image.naturalWidth);
  const missingQr = images.some((image) => image.closest(".ticket-qr") && (!image.complete || !image.naturalWidth));
  return { timedOut, missingImages: missing.length, missingQr, unsafeTickets: fitTicketText() };
}

export function printPreparationNotice(state: PrintPreparation): string {
  if (state.missingQr) return "A ticket QR has not loaded. Refresh the print view before printing.";
  if (state.unsafeTickets) return `${state.unsafeTickets} ticket(s) have unusually long fields that cannot fit safely. Review those names/details before printing; the QR has not been reduced.`;
  if (state.missingImages || state.timedOut) return `${state.missingImages ? `${state.missingImages} image(s) have not loaded. ` : "Fonts/images are still loading. "}Review the preview and press Print again to continue, or reload to retry. All selected tickets remain in this view.`;
  return "";
}
