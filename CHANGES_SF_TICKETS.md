# OKGS Science Fair — ticket redesign, bulk A4 printing, photo management and panel speed

Round 3 of the `/sf` work. Three requirements: **(1)** a ticket that is one
language end-to-end, redesigned, printable four-to-an-A4-page for paid students
only; **(2)** student photos managed from a spreadsheet and from an edit screen,
through Cloudinary; **(3)** a console that does not stall when you move between
menus, open a modal or scroll the roster.

Verification in this environment: `npx tsc --noEmit` clean, `npx next build`
clean, `npm run smoke` green — it now also runs
`scripts/student-ticket-smoke.tsx` (6 grouped checks, including the same
paid-only / paging / photo-batch rules re-checked **against a live libSQL
database**, not just against source text). Every new route was also exercised
over HTTP with a signed-in SuperAdmin session against the real database: login →
roster API → bulk-print API → rendered A4 sheet → photo CSV import (dry run and
apply) → student PATCH → re-check of the paid count.

---

## 1 · Ticket: one language, redesigned, four per A4 page

### 1.1 Language uniformity

The old sheet mixed languages — English field labels over Bangla names, an
English footer under a Bangla heading. Every word a ticket can print now lives
in **one dictionary**: `lib/ticket-locale.ts`.

```ts
ticketText("en" | "bn" | "both")   // labels, headings, badges, footer notes
ticketNumber(value, lang)          // 5 → "5" or "৫"
ticketDate(iso, lang, "long")      // 9 October 2026 → ৯ অক্টোবর ২০২৬
ticketValue(text, lang)            // names untouched, their digits converted
```

* `en` — every label, badge and footer note in English, Latin digits.
* `bn` — every label, badge and footer note in Bangla, **Bangla digits too**
  (roll, ID, copy numbers, dates). `toBanglaDigits()` was added to
  `lib/digits.ts` as the mirror of the existing `toLatinDigits()`.
* `both` — Bangla first with the English wording under it **on every field**, so
  a bilingual sheet is uniform rather than half-translated.

The mode travels in the URL (`?lang=bn`), never in browser storage — the panel's
standing rule. `TicketSheet.tsx` and `TicketCard.tsx` contain **no string
literals at all**; the smoke test asserts that (`!BANGLA.test(source)`) and
renders all three modes to prove an English sheet has zero Bangla codepoints and
a Bangla sheet has zero English labels left over.

Toggle: the ticket toolbar (`TicketToolbar`, `BulkTicketToolbar`) and both print
modals offer `English · বাংলা · বাংলা + English`.

### 1.2 Redesign (landscape A4, `/sf/print/ticket/:id`)

`components/sf/print/TicketSheet.tsx` + the ticket block of `app/globals.css`:

* head — crest/logo in a bordered tile, school name, event title as an
  uppercase kicker, and a pill carrying *kind* + *copy label* + *copy i of n*;
* body — **photo on the left in a true 3:4 frame** (`aspect-ratio: 3 / 4`,
  `object-fit: cover`, `object-position: center`, rounded, ringed, shadowed —
  never squashed, never top-cropped), then name + a ruled detail grid
  (ID · Roll · Class · Section · Shift · Group), then the signed QR;
* the family/guardian block from copy 2 onward is unchanged in behaviour;
* foot — validity, issue date, printed by, signature note.

Photo delivery is a Cloudinary transform, not the original upload:
`f_auto,q_auto,w_600,h_800,c_fill` for the landscape sheet, `w_300,h_400` for a
compact card, `w_160` for a table row.

**Print contract change worth knowing about:** the old `@media print` block
forced `color: #000 !important; background: #fff !important` on every descendant
of the ticket, so the school's ticket printed as a flat monochrome photocopy.
That rule existed to stop a dark colour scheme producing white-on-white text. It
is replaced by pinning the ticket's own tokens at print time
(`--t-ink/--t-accent/--t-gold/--t-paper` + `print-color-adjust: exact`), which
fixes the original bug at the root and lets the navy header, gold rule and green
PAID badge reach the paper.

### 1.3 Bulk printing — exactly 4 tickets per A4 page

* **Admin button:** `Students` panel → **Print bulk tickets** → a modal showing
  the scope, how many students are PAID, how many are excluded, how many A4
  sheets that is, the tickets-per-run (20/40/100), the starting run and the
  language. It opens `/sf/print/tickets?…`.
* **Route:** `app/sf/print/tickets/page.tsx` → `components/sf/print/TicketCard.tsx`
  (compact card) + `components/sf/print/BulkTicketToolbar.tsx`.
* **Stylesheet:** `components/sf/print/ticket-bulk.css` — one file for the whole
  surface, imported by the route:

  ```css
  @page ticket-compact { size: A4 portrait; margin: 0; }
  .ticket-bulk-page {
    page: ticket-compact;               /* named page: order-independent */
    width: 210mm; height: 297mm; padding: 7mm; box-sizing: border-box;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows:    repeat(2, minmax(0, 1fr));
    gap: 3mm;
    break-after: page; page-break-after: always;   /* after every 4 tickets */
  }
  .ticket-bulk-page:last-child { break-after: auto; page-break-after: auto; }
  @media print { .no-print, .ticket-bulk-toolbar, .app-top, .app-tabs,
    .sf-bottom-nav, .sf-more-root, .sf-desktop-sidebar, .sidebar, nav,
    body > header, body > footer { display: none !important; } }
  ```

  Geometry is in millimetres, so the screen preview *is* the print layout:
  210 × 297 mm page, 7 mm safe padding (printer dead edge), 3 mm gutter, each
  ticket 96.5 × 138 mm, photo 25 × 33.33 mm (the same 3:4).
* **PAID only, enforced in SQL.** `paidStudentsForPrint()` calls
  `studentFilterSql({ …filter, payment: "PAID" })`; `printableStudentCounts()`
  reports the excluded count for the modal and the toolbar warning. There is no
  client-side toggle that can put an unpaid student on paper. Verified live:
  marking one student UNPAID dropped the bulk count from 5 to 4 immediately.
* **Runs vs sheets.** A *run* is one press of Print (`size` tickets); a *sheet*
  is one A4 page (4 tickets). The API returns both (`runs`, `run`,
  `sheets_in_run`, `sheets_total`) and the toolbar labels them separately —
  printing 5 paid students with `size=20` is 1 run of 2 A4 sheets.
* A short last page keeps its 2 × 2 grid with `ticket-bulk-slot-empty`
  placeholders, so the tickets never reflow to three-across.
* One signed QR per student, generated on the server (`qrDataUrl`, 260 px,
  concurrency capped at 8) — the paper always carries the QR the backend issued.
* Each job writes one `ticket_prints` row per student (`recordTicketPrints`,
  `db.batch` in chunks of 200) plus an `activity` entry, so "who printed Class 8
  and when" is answerable from the audit log.
* `POST /api/staff/students/bulk-print` refuses a scope with no paid student
  (422, with the unpaid count in the message).

---

## 2 · Student photos: spreadsheet bulk mapping + per-student editing

### 2.1 Spreadsheet → roster (`student_id`/`roll` + `photo_url`)

* **Parser (pure, testable):** `lib/photo-import.ts`
  * columns: `ID / STUDENT ID / SCHOOL ID / আইডি …`, `ROLL / রোল …`,
    `PHOTO / PHOTO URL / ছবি …` — the header row is *found* in the first ten
    rows, not assumed;
  * `student_id` is the preferred key, `roll` is accepted for sheets that only
    carry the register number; Bangla digits in a roll are normalised;
  * a row is usable when it has a key and an absolute http(s) URL; the first
    usable row for a key wins and a later one is reported as a duplicate;
  * every unusable row is reported with its row number (missing URL, bad URL,
    no key, duplicate) and non-Cloudinary hosts are counted, not rejected.
* **Writer (batch):** `updateStudentPhotos(entries, { dryRun })` in
  `lib/student-db.ts` — resolves all students in two indexed lookups, skips rows
  whose URL is already correct, commits in `db.batch` chunks of 100, and returns
  `{ matched, updated, unchanged, missing[] }`. Unknown keys are reported, never
  guessed.
* **Controller:** `POST /api/staff/students/photos` (multipart `.csv/.tsv/.txt/.xlsx`,
  `dry_run=1` to validate without writing, 10 MB cap, activity logged).
* **UI:** `components/sf/console/PhotoImportPanel.tsx` — file picker, template
  CSV download, **Check without saving** (dry run) and **Save photo links**, with
  a result panel listing matched/unchanged/unmatched rows and the row-level
  errors.

### 2.2 Per-student editing

* `components/sf/console/StudentEditModal.tsx` — name, ID, roll, class, section,
  shift, group, branch, father/mother, contacts, tags, **payment status**, and
  the photo. Picking a file previews it instantly from an object URL, uploads
  straight from the browser to Cloudinary (signed by `/api/media/sign`, so no
  secret and no image bytes pass through the API), shows real progress, and the
  delivery URL can also be pasted by hand.
* `PATCH /api/staff/students/:id` — saves only the fields sent, rejects an empty
  name, a non-http(s) photo link (422) and an ID that belongs to another student
  (409, naming the other student), and writes the payments row for the active
  fair when `payment_status` is included. `GET` on the same route returns one
  student for the modal.

---

## 3 · Panel speed

| Symptom | Fix |
| --- | --- |
| Every menu change re-fetched with `cache: "no-store"` and showed an empty table | `useApi` in `components/sf/console/ui.tsx` is now a small SWR-style cache: a module-level `Map` (never `localStorage`), 30 s stale window, in-flight dedupe, stale-while-revalidate. `invalidateApi()` / `seedApiCache()` are exported for mutations. A revalidation keeps the old rows on screen; only a *new* query clears the table, so a filter change can never show another class's data. |
| One request per keystroke in the search box | `useDebouncedValue(filters.q, 250)` — the query changes on a pause in typing. |
| The whole roster (up to 5,000 rows) was sent and painted at once | Server-side pagination: `GET /api/staff/students?page=&page_size=` (default 50, max 200) with `LIMIT/OFFSET`; `countStudents()` for the denominator and `studentStatusCounts()` for the header figures — both aggregated in SQL over the *whole* filter, so paging cannot change the totals. The table appends pages with an `IntersectionObserver` sentinel (480 px early). |
| Roll filtering happened in JavaScript after the rows arrived | `rollClause()` pushes it into SQL (`CAST(roll AS INTEGER) IN (…)` for numeric rolls, exact text otherwise), so page size no longer changes who is in the class. |
| Every panel shipped in one bundle | `components/sf/FairConsole.tsx` loads all fourteen sections with `next/dynamic(..., { ssr: false })` behind a shared skeleton. Verified in the build output: the students panel (with bulk print and the photo importer) is its own chunk. |
| Navigation waited on the router | the console tab strip uses `<Link prefetch>`; the mobile bottom bar deliberately keeps the default hover/viewport prefetch to save mobile data. |
| Roster photos pulled the original uploads | `components/sf/StudentPhoto.tsx` — `optimizedImage(url, { width, height, fit: "cover" })` (`f_auto,q_auto,w_160,h_213,c_fill` for a row), `loading="lazy"`, `decoding="async"`, initials fallback for a missing or dead URL. |
| Missing indexes | `lib/student-schema.ts` adds `students(roll)`, `students(class_name, section)`, `payments(student_id)`, `payments(fair_slug, status, student_id)`, `guests(fair_slug, status, related_student_id)`, `scan_logs(subject_type, subject_id, fair_slug, result, entry_time)`, `ticket_prints(fair_slug, student_id)`. They are created at boot by the existing `ensurePortal()` bootstrap — no manual migration. |

---

## Files

**New:** `lib/ticket-locale.ts`, `lib/photo-import.ts`,
`components/sf/print/TicketCard.tsx`, `components/sf/print/BulkTicketToolbar.tsx`,
`components/sf/print/ticket-bulk.css`, `components/sf/StudentPhoto.tsx`,
`components/sf/console/StudentEditModal.tsx`,
`components/sf/console/PhotoImportPanel.tsx`, `app/sf/print/tickets/page.tsx`,
`app/api/staff/students/bulk-print/route.ts`,
`app/api/staff/students/photos/route.ts`,
`app/api/staff/students/[id]/route.ts`, `scripts/student-ticket-smoke.tsx`.

**Changed:** `components/sf/print/TicketSheet.tsx`,
`components/sf/print/TicketToolbar.tsx`, `app/sf/print/ticket/[id]/page.tsx`,
`app/sf/print/guest/[id]/page.tsx`, `app/api/staff/students/route.ts`,
`app/api/staff/students/[id]/print/route.ts`,
`components/sf/console/StudentsPanel.tsx`, `components/sf/console/ui.tsx`,
`components/sf/FairConsole.tsx`, `lib/student-db.ts`, `lib/student-schema.ts`,
`lib/digits.ts`, `app/globals.css`, `package.json`.

## Routes

| Route | Purpose |
| --- | --- |
| `/sf/print/ticket/:id?lang=en\|bn\|both&copies=1..3` | one landscape A4 ticket, 1–3 copies |
| `/sf/print/guest/:id?lang=…` | outside guest pass |
| `/sf/print/tickets?fair=&class=&section=&shift=&rolls=&lang=&size=&page=` | bulk A4 portrait sheet, 4 tickets per page, PAID only |
| `POST /api/staff/students/bulk-print` | resolve scope → count paid/unpaid → log the job → return the sheet URL |
| `POST /api/staff/students/photos` | spreadsheet → photo URLs (multipart, `dry_run=1` to preview) |
| `GET/PATCH /api/staff/students/:id` | read / save one student (fields, photo, payment status) |
| `GET /api/staff/students?page=&page_size=` | paginated roster + SQL-aggregated totals |
