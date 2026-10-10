# OKGS GENESIS 2026 — ticket redesign, guest registration & class budgets

Three connected changes to the Science Fair module: a fully redesigned A6
print ticket, camera-first guest registration with entry/lunch fees, and
class-wise fair budget accounting on the dashboard. Everything is live-data —
no mock rows anywhere.

---

## 1. Ticket redesign — A6 portrait (105 × 148 mm)

The whole ticket moved to one component, `components/sf/print/TicketSheet.tsx`,
used by the single-student page, the bulk page and the guest page. The old
A4-landscape `TicketCard.tsx` (and its CSS) is deleted.

### Layout

```
┌───────────────────────────────────────────────────┐
│ [school logo]  Omar Kindergarten School   [Scholars logo]
│                Scholars Residential School               │  header band
│                OKGS GENESIS 2026                │  large + bold, above photos
│  [father photo]   [STUDENT photo — large]   [mother photo]
│   father name                                mother name │  three-photo row
│              Abdullah Al Mamun                 │  full name
│  Student ID 2026-0101   Roll 5   Class 8  Section A ...  │  details grid
│  ┌────┐                                              │
│  │ QR │                          [Fair President      │
│  └────┘                           signature image]    │  QR left / signature right
│ Valid until 31 December 2026        Issued 8 Oct 2026 │
└───────────────────────────────────────────────────┘
```

- **Header:** school logo (left), fixed institution name **Omar Kindergarten
  School** with the sub-header **Scholars Residential School** directly below,
  and the Scholars logo on the right
  (`https://i.postimg.cc/J7f1pBcs/SCHOLARS-Logo-(English).png`). The printed
  name is pinned in `lib/ticket-brand.ts` — site-name settings only feed
  toolbars, never the paper.
- **Fair name:** rendered large and bold (e.g. **OKGS GENESIS 2026**),
  directly above the student photo.
- **Photos:** father (small, named) · student (large, centred) · mother
  (small, named). The student's full name sits below the row. Parent photos
  come from the new `students.father_photo_url` / `mother_photo_url` columns;
  missing photos degrade to soft initials placeholders.
- **Details:** students show **Student ID (no thousands separators)**, Roll,
  Class, Section, Shift and Group. Guests show a bold **GUEST ENTRY** tag plus
  Guest ID, tagged-student reference, contact info and status.
- **Bottom:** the signed QR moved to the bottom-left with **no caption**; the
  Fair President's signature image sits bottom-right with a signature rule and
  "Fair President" caption.
- **Footer:** **Valid until 31 December 2026** (fixed — never the fair's end
  date) and **Issued <date>**.
- **Removed from the paper:** the "STUDENT ENTRY TICKET" badge, "Student
  copy"/"Parent copy"/"Copy N of 1" marks (and the copy-label hints in the
  screen toolbar), "QR signed with HMAC-SHA256", and "Printed by …". The QR is
  still genuinely signed (prefix `s:`/`g:` tokens in `lib/ticket-code.ts`) —
  only the text was removed.

### Print contract

- One ticket prints as **one true A6 portrait sheet** (105 × 148 mm):
  `@page { size: A6 portrait; margin: 0 }` plus pinned `width/height` on
  `.ticket-sheet`. The sheet fills the page with no clipping or overflow.
- The **bulk page** lays out **four unmodified A6 sheets per A4 portrait page**
  (2×2 grid, 105 × 148 mm slots, 3 mm gaps, `page-break-after: always` after
  every 4). The grid wraps the exact same `TicketSheet` component and its CSS
  only adds placement — the ticket template itself is untouched.
- `app/globals.css` carries the ticket block (`.ticket-*`),
  `components/sf/print/ticket-bulk.css` carries only the A4 grid placement,
  and the single-sheet `@page` rule is pinned at the end of `globals.css` so
  nothing can override it. Toolbars and app chrome are `no-print`.
- Auto-print waits for fonts + images (8 s fallback); QR images block printing
  by loading at `width=260`.

### Locales

All copy flows through `ticketText(lang)` in `lib/ticket-locale.ts`
(en / bn / both); numbers are rendered in Bengali digits on বাংলা tickets.
Branding constants (logos, signature URL, fixed school name, sub-header,
valid-until date) live in `lib/ticket-brand.ts`.

**Files:** `components/sf/print/TicketSheet.tsx` (new single component;
`TicketCard.tsx` deleted), `components/sf/print/ticket-bulk.css` (new),
`components/sf/print/TicketToolbar.tsx`, `lib/ticket-brand.ts` (new),
`lib/ticket-locale.ts`, `app/globals.css`, `app/sf/print/ticket/[id]/page.tsx`,
`app/sf/print/tickets/page.tsx`, `app/sf/print/guest/[id]/page.tsx`,
`components/print/AutoPrint.tsx` (unchanged), `lib/ticket-code.ts` (unchanged).

---

## 2. Guest registration — camera, fees, import/export

### Camera capture

`/sf/students` → **Register outside guest** opens a modal with a live
webcam capture component (`components/sf/console/CameraCapture.tsx`):

- `getUserMedia` (facingMode `user`) with a mirrored live preview, shutter
  button, one-tap retake, and a graceful fallback to a file picker when no
  camera is available.
- Captured photos upload **immediately to Cloudinary** (signed or preset
  upload via the existing `cloudinaryClient` helpers, folder `okgs/guests`)
  and the returned secure URL is saved as the guest's photo.
- The modal tags the guest to a student via the existing student picker.

### Fees (server-side, single source of truth)

`lib/guest-fees.ts`:

- **Mandatory entry fee: BDT 50** — every registered guest.
- **Optional lunch box: BDT 150** — checkbox in the modal.
- Total = 50 or 200, always recomputed on the API
  (`app/api/staff/guests/route.ts` POST); the client can never override the
  amounts. New guests start `fee_status = PAID`.
- `PATCH /api/staff/guests/[id]` flips `status` (active/revoked) and
  `fee_status` (PAID/UNPAID) with audit fields. Revoking a guest also zeroes
  their fee contribution to the accounting.

### Guest data model & UI

- `guests` gained `photo_url`, `entry_fee`, `has_lunch`, `lunch_fee`,
  `total_fee`, `fee_status` columns (migration in `lib/student-schema.ts` +
  `lib/portal-db.ts`).
- The Students tab's guest table shows photo, name, contact, tagged student,
  fee total and fee status, with Mark paid/Mark due actions, and a
  **Print ticket** action that opens the redesigned guest ticket
  (`/sf/print/guest/[id]`).
- **Export guest list (CSV)** (`app/api/staff/guests/export/route.ts`) writes
  a BOM-prefixed CSV with Guest ID, name, relation, contact, tagged student,
  student ID/class/section, **photo URL**, entry fee, lunch box, lunch fee,
  total fee, fee status, status and registration time.

### Excel import/export with family photos

Bulk operations now carry photo URLs for **student, father, mother and guest**:

- **Roster import** (`lib/student-columns.ts`): the student sheet carries 17
  columns including `Father Photo` and `Mother Photo` (validated
  `https?://` URLs), stored on `students.father_photo_url` /
  `mother_photo_url`. The Excel export includes the same columns.
- **Photo mapping sheet** (`lib/photo-import.ts`): alongside `student_id`/
  `roll` + `photo_url`, the sheet now accepts optional `Father Photo` /
  `Mother Photo` columns (English/Bangla header aliases, `_` and space
  variants), synced in the same pass; a 5-column CSV template is downloadable
  from `/sf/import`.
- `updateStudentPhotos` (in `lib/student-db.ts`) merges any of the three
  URLs provided — blank cells never erase existing photos. The dry-run /
  mismatch reporting covers all three columns.
- Bulk ticket printing reads the family photo URLs, so imported rosters print
  the full three-photo row.

**Files:** `components/sf/console/CameraCapture.tsx` (new),
`components/sf/console/StudentsPanel.tsx` (guest modal + table + export),
`lib/guest-fees.ts` (new), `app/api/staff/guests/route.ts`,
`app/api/staff/guests/[id]/route.ts`, `app/api/staff/guests/export/route.ts`
(new), `lib/student-schema.ts`, `lib/portal-db.ts`, `lib/student-db.ts`,
`lib/student-columns.ts`, `lib/photo-import.ts`,
`app/api/staff/students/import/route.ts`,
`components/sf/console/PhotoImportPanel.tsx`.

---

## 3. Class-wise budget & accounting

- **Budget target per class:** SuperAdmin sets a fair budget target in the
  Classes tab (`components/sf/console/PeoplePanels.tsx` — per-class edit and
  the New-class form). Stored in `classes.budget_amount` (migration; no new
  table, no backfill — existing classes get 0).
- **Auto accounting** (`lib/fair-budget.ts`, fed into `/api/staff/stats`):
  - **Student collections** — per class: fee amount, budget target, students,
    paid count, collected (fee × paid) and remaining vs budget.
  - **Guest entry fees** — BDT 50 × active paid guests.
  - **Guest lunch boxes** — BDT 150 × guests who took lunch.
  - **Totals** — collected vs target budget across all classes + guest money;
    remaining budget. Revoked guests are excluded from fee totals.
- **Dashboard:** the `/sf` console shows a new accent metric
  **Fair collections** (collected vs target) and a full-width
  **Class-wise budget & collections** panel with a progress bar, the class-wise
  table (with budget/collected/remaining columns) and chips for guest entry
  fees and lunch boxes. The Classes tab badge shows collected vs budget.
  All figures are computed live from the database on every render.

**Files:** `lib/fair-budget.ts` (new), `app/api/staff/stats/route.ts`,
`app/api/staff/classes/route.ts`, `components/sf/FairConsole.tsx`,
`components/sf/console/PeoplePanels.tsx`, `lib/student-db.ts`,
`lib/student-schema.ts`, `lib/portal-db.ts`.

---

## Verification

- `npm run typecheck` — clean.
- `npm run build` — production build succeeds; all print routes compile.
- `npm run smoke` — the full suite passes, including the rewritten
  `scripts/student-ticket-smoke.tsx` (6 checks: language uniformity and pinned
  "31 December 2026"; the redesigned A6 sheet incl. dual logos, fair title,
  three-photo row, QR-left + signature-right and the absence of every removed
  badge; the 4-up A4 grid + PAID-only printing; family photo import against a
  live DB incl. dry-run safety; performance contracts; and live-database checks
  for guest fees, class budgets and `fairBudgetSummary` totals) and the
  updated `scripts/sf-panel-smoke.tsx`.
- `npm run test:portal` — passes.
- Manual end-to-end against the dev server: logged in as SuperAdmin, imported
  a student with parent photos, rendered the single/bulk/guest print pages
  (200, correct markup), registered guests with lunch via the API (50+150=200
  computed server-side), exported the guest CSV, created a class with a
  BDT 5000 budget, and confirmed `/api/staff/stats` returns exact figures
  (student fees + guest entry + lunch boxes vs target).

**Files:** `scripts/student-ticket-smoke.tsx`, `scripts/sf-panel-smoke.tsx`,
`scripts/portal-regression-smoke.ts`.
