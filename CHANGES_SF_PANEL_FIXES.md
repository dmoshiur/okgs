# OKGS Science Fair panel — UI/CSS, language, scanner, payment, ticket and DB fixes

Round 2 of the `/sf` work. This document supersedes the CSS section of
`CHANGES_SF_IMPLEMENTATION.md` (that `!important` mobile patch is gone — see
§1) and records what each numbered requirement now does, and where.

Verification in this environment: `npx tsc --noEmit` clean, `npx next build`
clean, `npm run smoke` green (it now includes `scripts/sf-panel-smoke.tsx`,
8 grouped checks covering all eight requirements), and every `/sf` route
exercised over HTTP with a signed-in staff session against the real SQLite
database. No browser was available, so the visual layer is verified by the
rendered markup plus the CSS contract the smoke test asserts.

---

## 1 · Global bottom navigation

* `app/layout.tsx` mounts `<BottomNav />` **once, in the root layout** — after the
  providers, before `</body>`. It is therefore present on `/sf`, `/sf/students`,
*all* `/sf/<section>` screens, `/sf/scan` and every print surface.
* `components/sf/BottomNav.tsx` decides for itself where it renders, via
  `isSfPanelPath(pathname)` in `components/sf/sections.ts`. It deliberately
  *stays off* `/sf/login`, `/sf/forgot-password`, `/sf/reset-password` and
  `/sf/print/**` (a nav on a printed ticket is a bug, not a feature).
* CSS contract (`app/globals.css`, SF layer):

  ```css
  @media (max-width: 767px) {
    .sf-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999; }
    body:has(.sf-bottom-nav) { padding-bottom: 70px; }
    .sf-console .app-body, .sf-console .sf-main { padding-bottom: calc(var(--sf-nav-space, 70px) + 8px); }
  }
  ```

  `--sf-nav-h: 70px` and `--sf-nav-space: calc(70px + env(safe-area-inset-bottom))`
  are declared on `.sf-console, .sf-bottom-nav, .sf-more-root, .ticket-print-root`.
  The `body:` rule has to spell 70px out because `body` sits outside that scope.
* The scanner reserves the space too (`.sf-scan-page` uses `.sf-main`), so the
  bar never covers the camera preview or the **Admit** button.
* `@media print` hides `.sf-bottom-nav`, `.sf-more-root`, `.app-top` and
  `.sf-page-actions`, and zeroes the reserved padding.
* Active state comes from the URL only. There is no saved nav state anywhere.

## 2 · “More” drawer

`<BottomNav/>` renders five slots — `Dashboard · Students · Scan · Funds · More`.
**More** opens a full-screen sheet (`.sf-more-root` at `z-index: 10000`,
`role="dialog" aria-modal="true"`) containing a 2-column grid of cards:

Due collection · Expenses · Memos · Collections · Gate passes · Ticker · Roster
import · Accounts · Class management · Reports · Settings — plus **Content
Studio** (→ `/admin`) and **Sign out**.

Each card: icon tile, English title, one-line English hint, `:hover`,
`:focus-visible`, `:active` (scale) and `.is-active` (accent ring) states, and
`aria-current="page"`. ESC, the backdrop, the close button and any navigation all
dismiss it; body scroll is locked while it is open. The item list is
`sfMoreSections` in `components/sf/sections.ts` — the single registry the desktop
tab strip, the drawer and the route matcher all read from, so a new section can
never appear in one place only.

## 3 · English-only panel, contrast, overlap, overflow

* **Every panel string is English.** `components/sf/sections.ts` (labels/hints),
  `Scanner.tsx`, `StudentsPanel.tsx`, `ReportsPanel.tsx`, `gate-status.ts`
  (`Success / Duplicate / Expired / Invalid`), `lib/api.ts` (all API messages the
  panel prints in red notices).
* `app/api/portal/login` and `loginWithPassword` now answer **both** languages
  (`error` in Bangla for the public portal, `errorEn` for the staff doors) plus a
  stable `code`. `components/portal/LoginForm.tsx` carries a `copy` table per
  language and `/sf/login` passes `lang="en"`. `/sf/forgot-password` and
  `/sf/reset-password` prefer the `*En` fields their API already returned.
* `app/layout.tsx` renders `lang="en"` for `/admin` and `/sf` (the public site
  stays `bn`).
* **Contrast.** The panel used to read the public site's theme variables, which an
  admin can repaint; a dark template left white cards with near-white text. The SF
  layer now declares its own token set for light *and* dark and re-paints the
  borrowed vocabulary (`--surface/--ink/--body/--muted/--line/--brand/--mint/
  --shadow-*`) so `.panel`, `.metric`, `.v2-btn`, `.badge-soft`, `.app-top` are all
  coherent inside `.sf-console` without touching the public theme. The old
  `.metric-accent { background: linear-var(--navy-gradient) }` — an invalid value
  that produced a white card with white text — is now
  `background-color: var(--brand-deep)` + a real gradient, with forced white text.
* **Overflow/overlap.** `.sf-console { overflow-x: clip }`, `min-width: 0` on every
  grid child and `max-width: 100%` on panels; tables scroll inside
  `.sf-table-wrap` instead of widening the page; `.sf-list-row` re-declares
  `minmax(0,1fr) auto` on mobile so a badge cannot collide with the label;
  buttons use `flex-wrap` rows (`.sf-actions`, `.sf-bulk-actions`,
  `.sf-scan-buttons`) so nothing is cut off; `overflow-wrap: anywhere` on long
  IDs, notes and names.
* The legacy `@media (max-width: 768px) { .app-shell.v2 { … !important } }` block
  from the previous round is deleted — it fought the theme layer and produced the
  very clipping it tried to fix.

## 4 · Exact `.xlsx` parser

`lib/student-columns.ts` is the contract; `app/api/staff/students/import/route.ts`
implements it.

* `STUDENT_COLUMNS` (used by the schema and the importer) is exactly
  `SL, ID, Roll, Photo, Name, Branch, Shift, Class, Section, Group, SMS Contact,
  Father Contact, Father Name, Mother Name, Tags`, row 1 being the report title
  and data starting under the header.
* The header row is **located**, not assumed: the first ten rows are scanned for a
  line where at least three cells match a known header, so a deleted title row or
  an extra spacer cannot break the import. Matching is case/space/punctuation
  insensitive, and each column also accepts its aliases (`ROLL NO`, `SCHOOL ID`,
  `মাতার নাম`, …). The sheet actually holding the headers is picked when the
  workbook has more than one.
* **Bangla is preserved**: cells arrive as UTF-8 shared strings and are written
  back untouched — no transliteration, no stripping. Only fields we *calculate*
  with are normalised: `toLatinDigits` (`lib/digits.ts`) turns `৮` into `8`, and a
  phone stored as a number regains its leading zero (`1712345678` →
  `01712345678`).
* Rows are upserted by `student_code` in one `db.batch` per 100 rows, tagged with
  an `import_batch`, then `logActivity` records the file name and the counts. The
  response reports `total / inserted / updated / skipped / errors[] / header_row`,
  and the panel prints per-row errors (`Row 6: ID is empty.`,
  `Row 7: Duplicate ID 2026-0101 in this file — the first occurrence was kept.`).

Verified against a hand-built workbook (title row, Bengali names, Bengali-digit
rolls, a numeric phone, a blank row, an ID-less row, a duplicate ID):
`{ ok: true, total: 3, inserted: 3, skipped: 2 }` with the two row-level errors,
and a re-GET of the roster showed `আব্দুল্লাহ আল মামুন` byte-for-byte with
`roll: "5"` normalised from `৫`.

## 5 · Class-wise fee collection

* Filters: **Class · Section · Shift · Payment · Roll numbers · Search** — all
  server-side (`/api/staff/students`), with `limit` 5000 and no client-side
  slicing.
* `1, 2, 5, 8-12` → `lib/roll-range.ts` expands to `1,2,5,8,9,10,11,12`;
  separators may be commas, semicolons or spaces; rolls compare by value (`01`
  matches `1`); Bengali digits typed into the box work; inverted ranges
  (`4-2`) and junk tokens are refused with a message, and a 1000-roll cap stops a
  typo from locking the whole fair.
* **“Mark All Class as Paid” is a real `role="switch"` toggle.** While it is on,
  the roll box is disabled, the buttons change to
  `Mark 12 student(s) PAID` / `Mark class UNPAID`, and the confirm line names the
  exact scope (`Class 8 · section A · Day shift`). It resets itself after the
  write so it cannot fire twice by accident.
* `POST /api/staff/students/payments` takes `student_ids[]` *or*
  `scope {class_name, section, shift, rolls, all_in_class}`; it 422s if a class is
  missing or neither rolls nor `all_in_class` is given, 404s when nothing matched,
  and returns the affected rolls and students so the row badges update from the
  server, not from optimistic UI.
* Per-student status stays a one-click button in the row (`PAID ⇄ UNPAID`,
  “Saving…” while it writes).
* Everything lands in the `payments` table (`fair_slug, student_id, status,
  paid_at, updated_by, updated_by_name`) — confirmed by reading the SQLite file
  directly after the API calls.
* `components/sf/console/ReportsPanel.tsx` lists every class with a coverage bar
  and an **Collect fees** link that opens `/sf/students?class=…&section=…&shift=…`;
  `StudentsPanel` seeds its filters from those URL params. The URL is the state.

## 6 · Tickets: full-screen landscape A4, QR, family block, per-row print

* `components/sf/print/TicketSheet.tsx` is a `297 / 210` landscape sheet:
  school crest + name + fair, `STUDENT ENTRY TICKET`, copy label, photo (or
  initials), ID/roll/class/section/shift/group, fee pill, admission pill, the QR
  and the signed ticket code, and a footer with validity, issue date, printer and
  `QR signed with HMAC-SHA256 · tamper-evident`.
* **Copy 1** = student copy. From **copy 2** the family block prints: father's
  name, mother's name and *every* approved external guardian (`Mama (maternal
  uncle)`, `Chacha`, `Fufa`, `Khala`, `Phupu`, `Guardian`, `Other guest`) with
  contact numbers — plus two blank fill-in lines when fewer than two are on file,
  so a walk-in relative can be written and countersigned at the gate.
* `app/sf/print/ticket/[id]/page.tsx` is server-rendered (`force-dynamic`), staff
  guarded, and builds the QR from `makeTicketToken` — the paper and the database
  always agree because the same function signs both sides.
* `components/sf/print/TicketToolbar.tsx`: **full-screen** toggle
  (`requestFullscreen`), copy count 1/2/3, “open print dialog on/off”, and the
  print button; on a portrait phone it shows *Turn the phone sideways*. All of it
  is `no-print`.
* Print CSS: `@page { size: A4 landscape; margin: 0 }` plus a named
  `ticket-landscape` page, `break-after: page` per sheet, fixed `297mm × 210mm`
  while printing, `print-color-adjust: exact` so the gold border and pills are not
  dropped, and the app chrome hidden.
* **Every student row has its own “Print Ticket” button** →
  `PrintTicketModal` (copies, which guardian's pass accompanies it, father/mother/
  fee summary) → `POST /api/staff/students/:id/print` logs the print in
  `ticket_prints` and returns the URL to open. That is the no-smartphone path:
  the office prints, the gate scans.
* Verified: `copies=3` rendered 3 sheets, `ticket_prints` gained a row with
  `copies: 3, printed_by_name: "Super Admin"`, and the guardians block appeared.

## 7 · Guests and the gate log

* `GuestModal` in `components/sf/console/StudentsPanel.tsx` = Guest Name,
  Relation (seven relations), Contact, Host Student (searchable by name/ID/roll in
  the current list) → `POST /api/staff/guests`. Contact is validated, the host
  must exist, and the relation is canonicalised on the way in (`Mama`, `mama` and
  `Mama (maternal uncle)` all store the same label) so the ticket, the CSV and the
  API cannot disagree. Revoking and restoring is one button per guest row, and the
  guest's own landscape pass prints from the same table.
* `lib/entry-scan.ts` `processEntry()` is the single gate path for camera QR,
  pasted token and manual ID. Order: signature → fair → expiry → holder
  (student or guest) → revoked → previous admission. Every branch writes exactly
  one `scan_logs` row with `scanned_at` (full ISO timestamp), `entry_time`,
  `result` (`success / duplicate / expired / invalid`), `method` (`qr / manual`),
  the subject (type, id, name, code), the operator and an English note.
* `components/sf/Scanner.tsx` shows a large colour-coded status card
  (`aria-live="assertive"`), the admitted person, the entry time and the scan time,
  a five-chip summary (`admitted / success / duplicate / expired / invalid`) and
  the audit table with **separate Date and Time columns**, a “Today only” filter
  and Refresh. The camera loop reads frames with `jsQR`, de-duplicates the same
  code for 4s, and stops its tracks on unmount or route change; start/stop also
  lives in the header so the bar can never cover it.
* End-to-end in this session: manual ID → `success`; same ID again → `duplicate`
  (“Already admitted at …”); unknown ID → `invalid`; a signed guest token →
  `success`, rescan → `duplicate`, then after revoking → `invalid` (“This guest
  pass has been revoked”); an expired token → `expired`; a tampered token →
  `invalid` (“Not an OKGS ticket”). `/api/staff/entry/logs` returned the matching
  summary and rows.

## 8 · Database only

* No `localStorage`, `sessionStorage` or `indexedDB` **call** survives anywhere in
  `app/`, `components/` or `lib/` (only the words inside comments that explain the
  ban). The colour-scheme and visual-mode bootstrap script that used to read
  `localStorage` before hydration is replaced by cookie reads in the root layout:
  `VISUAL_MODE_COOKIE` / `COLOR_SCHEME_COOKIE` (`lib/design-themes.ts`) rendered
  into `data-color-scheme` / `data-visual-mode`, hydrated by cookie-backed
  providers. The fair preference is an httpOnly cookie too (`lib/sf-preference.ts`),
  written by `POST /api/staff/fair-preference` and followed by `router.refresh()`.
* Nothing renders a placeholder roster: the console reads
  `/api/staff/stats`, `/api/staff/students`, `/api/staff/guests`,
  `/api/staff/entry/logs`, and `lib/sf-console.ts` resolves the fair from the
  database (preference → `fairMode()` → `activeFair()`). Empty DB ⇒ empty panel,
  with an explicit English empty state pointing at the import.
* `lib/maintenance.ts` now exempts the `/sf` segment (exact-segment matching, so
  `/sf-x` is not exempt): a locked site must never stop the gate scanner mid-fair.
  `/sf` is still behind its own staff session.

---

## Files touched

| Area | Files |
| --- | --- |
| Nav + drawer | `app/layout.tsx`, `components/sf/BottomNav.tsx`, `components/sf/sections.ts`, `app/globals.css` |
| Console shell | `components/sf/FairConsole.tsx`, `components/sf/gate-status.ts`, `components/sf/console/ui.tsx`, `components/sf/console/ReportsPanel.tsx`, `components/sf/console/SettingsPanel.tsx`, `components/portal/PortalAnnouncements.tsx` |
| Scanner | `components/sf/Scanner.tsx`, `lib/entry-scan.ts`, `app/api/staff/entry/*` |
| Roster + payments | `lib/student-columns.ts` (new), `lib/digits.ts` (new), `lib/roll-range.ts`, `lib/student-db.ts`, `app/api/staff/students/**` |
| Tickets | `components/sf/print/TicketSheet.tsx`, `components/sf/print/TicketToolbar.tsx` (new), `app/sf/print/ticket/[id]/page.tsx`, `app/sf/print/guest/[id]/page.tsx`, `app/api/staff/students/[id]/print/route.ts` |
| Language | `lib/api.ts`, `lib/format.ts`, `lib/portal-auth.ts`, `app/api/portal/login/route.ts`, `components/portal/LoginForm.tsx`, `/sf/login|forgot-password|reset-password` |
| Persistence | `lib/design-themes.ts`, `components/public/{ThemeModeProvider,VisualModeProvider}.tsx`, `lib/sf-preference.ts`, `app/api/staff/fair-preference/route.ts`, `lib/maintenance.ts` |
| Regression | `scripts/sf-panel-smoke.tsx` (new, wired into `npm run smoke`) |

## Deliberately left alone

* The public Bengali site and the student portal (`/me`) keep their Bangla copy;
  only the staff doors (`/sf`, `/admin`) are English.
* Money stays `৳` in the panel, and the school's official name stays Bangla where
  it is stored that way — those are data, not chrome.
* Theme and club descriptions appear in Bangla because that is what the `themes`
  and `clubs` rows in the database hold.
