# OKGS — student / guest entry ticket: layout & print refresh

The A6 portrait entry ticket (single print, guest pass and the 4-per-A4 bulk
sheet all render the same `TicketSheet`) gets the final layout. Card geometry
is unchanged: a **95 × 137 mm** card on **A6 portrait** paper, 5 mm margins.

## Layout (top to bottom)

1. **Header** — school crest · **Omar Kindergarten School** and
   **Scholars Residential School** · Scholars logo. Both names share one style
   class (`.ticket-school-name`): same size (3.3 mm), weight (800) and colour.
2. **Fair title** — **OKGS GENESIS 2026**, then the tagline
   **Exploring The Universe Of Science** directly beneath it.
3. **Photos & name** — father · student (large) · mother, student's full name.
4. **Details** — Student ID, Roll, Class / Section, Shift, Group (guest tickets
   keep their own fields).
5. **Club logos** — the five clubs (ALSSM, AYPG, ALPCG, AYGSM, ARTDS) in one
   horizontal strip. Logos come from each club's `logo_url`; a club with no
   record falls back to the bundled artwork, and a club with no logo prints as
   a short-code monogram.
6. **Website** — `okgs.info`, directly under the club logos.
7. **Contacts** — Telephone `05725-56351-52` · President `01329-625713` ·
   Help Line `01711-857205`, in three compact columns. Labels follow the sheet's
   language (English / বাংলা / both); digits follow the sheet too.
8. **Bottom row** — signed QR **22 mm** bottom-left (was 26 mm; still no
   caption), Fair President signature bottom-right.

**Removed:** the "Valid until 31 December 2026" and "Issued …" line under the
QR. The ticket is still bound to its fair through the signed QR token; the
`ticketValidUntil` / `ticketDate` helpers are kept, so the line can be restored
with one change to the sheet if the office wants it back.

## Print

- Single ticket: `@page ticket-portrait { size: 105mm 148mm; margin: 5mm }`,
  one A6 page per copy, card 95 × 137 mm.
- Bulk: four identical cards per A4 page (2 × 2, 4 mm gutter), unchanged
  geometry. Verified in a headless Chromium print: 1 A4 page for four tickets,
  1 A6 page per single ticket, no card overflow in any language mode.
- Card contents are measured at print geometry: no element crosses the frame
  in English, Bangla or bilingual sheets (the bilingual sheet is the tightest).

## Code

- `lib/ticket-brand.ts` — tagline, website, contact numbers, the five clubs and
  `ticketClubs(clubs)` (resolves logos from live club records).
- `lib/ticket-locale.ts` — contact and "Our clubs" labels in en / bn.
- `components/sf/print/TicketSheet.tsx` — new `clubs` prop; `validUntil` and
  `issuedAt` props removed.
- `app/sf/print/ticket/[id]/page.tsx`, `app/sf/print/guest/[id]/page.tsx`,
  `app/sf/print/tickets/page.tsx` — pass `clubs={ticketClubs(content.clubs)}`.
- `app/globals.css` — ticket block: matched school names, tagline, club strip,
  website, contacts, 22 mm QR; footer rules removed.
- `scripts/student-ticket-smoke.tsx`, `scripts/sf-panel-smoke.tsx` — assertions
  updated for the new layout, plus club-logo resolution checks.

## Verification

- `npx tsc --noEmit` clean.
- `npm run smoke` green.
- `npx next build` clean.
- Headless Chromium render of the real markup and stylesheets: no overflow or
  clipped text in English, Bangla, bilingual or guest sheets; 4-up page prints
  as one A4 page.
