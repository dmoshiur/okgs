# OKGS — student ticket resized to A6 portrait (105 × 148 mm)

The single student ticket (`/sf/print/ticket/:id`, and the guest pass that
shares its sheet) used to be authored as an A4 portrait document. On an A6
print target the fixed-height blocks collided: the QR escaped the card border
and overlapped the footer, and the two `@media print` blocks disagreed about
the sheet height (271.6mm vs 184mm) while forcing `overflow: visible`, which
is what let content break out of the frame at all.

## What changed

* **Print contract is now A6.** `@page ticket-portrait { size: A6 portrait; margin: 0; }`
  and, in print, `.ticket-sheet { width: 105mm; height: 148mm; overflow: hidden; }`
  — exactly one A6 page per copy, no second page, nothing outside the border.
  The two contradictory print blocks were unified on the same geometry.
* **Screen preview is the same document.** The preview card is `min(105mm, 100%)`
  wide with `aspect-ratio: 105 / 148`, so the browser view and the print
  preview show identical geometry. All ticket typography is now mm-based
  instead of viewport-relative clamps, which resolve unpredictably in print.
* **Layout is a single flex column with one flexible member.**
  `head → photo → name/details → status badges → QR → foot` stack in a
  bordered frame (`box-sizing: border-box` everywhere via the global reset,
  `overflow: hidden` on sheet, frame and body). The QR block is the only
  flex member: it absorbs whatever height remains, capped at a 32mm square
  inside a `.ticket-qr-fit` container — so it can shrink, but it can never
  overlap the footer or cross the frame.
* **Details grid is 3 columns** (ID · Roll · Class / Section · Shift · Group),
  values wrap anywhere, so long text never blows a column.
* **Ticket numbers never carry grouping commas.** `ticketNumber()` used
  `Intl` thousands separators, which turned a roll/ID of 1024 into "1,024" /
  "১,০২৪". IDs now print as plain digits in every language mode.
* **Full sheets compact themselves.** Parent copies (family block on board)
  shrink the photo and tighten the gaps via `:has(.ticket-family)`, keeping
  the QR scannable even on a bilingual sheet.
* Toolbar hints and docs now say A6 instead of A4 for the single ticket
  (bulk printing stays A4, four per page — untouched).

## Verification

* `npx tsc --noEmit` clean.
* `npm run smoke` green — the ticket suite now pins the A6 contract
  (`size: A6 portrait; margin: 0`, 105/148 ratio, 3-column grid, flex QR
  with a scannable floor, `width: 105mm; height: 148mm` in print, no-comma
  IDs in English and Bangla).
* `npx next build` clean.
* Bulk A4 printing, receipts, memos and reports keep their own named pages.
