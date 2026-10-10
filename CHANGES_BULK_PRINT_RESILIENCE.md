# Bulk ticket printing: no more 500 on `/sf/print/tickets?job=…`

Reported symptom: opening the bulk print link the panel hands out
(`/sf/print/tickets?job=<uuid>`) ended in a server error / `Error: 95868090`
(a Next.js error *digest*, i.e. an unhandled server-side exception) instead of
paper — usually on a large selection, sometimes on an old print link.

Three things were wrong at once. All three are fixed, and each is now covered by
`scripts/student-ticket-smoke.tsx` (section **3b**), which runs against a live
libSQL database.

---

## 1 · The job snapshot could not be read safely

**Before.** `getTicketPrintJob()` was a `SELECT *` that returned `TicketPrintJob | null`
and the print route dereferenced it directly:

* any storage fault (Turso unreachable, table not yet created, a malformed
  `expires_at`) **threw out of the page component** — that is the 500;
* the snapshot was parsed with `JSON.parse(String(row.student_ids_json ?? "[]"))`
  and `Array.isArray(ids) ? … : []`, so a row written by an older release either
  produced `[]` **silently** — a blank print page with a cheerful "only PAID
  students are printed" note — or threw;
* expiry was a SQL string comparison (`expires_at > ?`), so a blank timestamp and
  an expired job were the same indistinguishable "no row";
* `createTicketPrintJob()` called `new Set(input.student_ids)`, which throws
  `TypeError: … is not iterable` when a caller ever passes `null`/`undefined`;
* nothing in the route was wrapped, so the browser got a stack-trace page and the
  log got one line with no job id.

**After.** `lib/student-db.ts` now separates *fetching* from *judging*:

```ts
openTicketPrintJob(id) → { state: "ready" | "missing" | "expired" | "unreadable" | "oversize" | "storage",
                           job, ids, detail }        // never throws, never returns null
getTicketPrintJob(id)  → job | null                   // the old accessor, kept for callers
```

* `ensurePortal()` runs inside the read, so a first-request table is created rather
  than raised as `SQLITE_ERROR: no such table`.
* The statement names its columns (no `SELECT *` across a schema that grows).
* Timestamps are judged in JS: blank or unparsable ⇒ `expired` (fails closed, never
  a `Date` exception) — and it is *reported as expired*, not as "nothing to print".
* The snapshot is parsed through `ticketJobIds()`: strings only, trimmed, blank and
  over-length values dropped, de-duplicated, and more identifiers than a selection
  may hold ⇒ `oversize` (refused) rather than a partial, silently-short print.
* `null`/`undefined` ID arrays are an empty selection everywhere they can arrive —
  `createTicketPrintJob`, `recordTicketPrints`.
* `getTicketPrintJob` keeps its contract: expired/unknown/unreadable ⇒ `null`, so
  no caller can ever fall back to the whole roster.

`ids` is exposed on the result so the route never dereferences a nullable `job`.

## 2 · Bulk query and memory

**Identifier resolution was O(selection × roster).** A selected ID or school code was
resolved with three *correlated* subqueries, one per identifier, and the case-folded
alias branch (`upper(student_code)` + `HAVING`, no index) re-scanned the entire
roster for every one of them. Measured on this repository's own database, for a
10,000-ID selection over a 3,200-row roster:

| one PAID-count query | before | after |
| --- | --- | --- |
| 10,000 selected identifiers, 3,200 students | **7,476 ms** | **33 ms** |
| 10,000 identifiers, 600 students | 2,289 ms | 20 ms |
| 4,000 identifiers (a real class + padding) | 908 ms | 9 ms |

The print route ran that query **twice** (counts, then rows), so a single large job
cost 15 s+ of SQL on its own and scaled with the roster on top — that is the
timeout/OOM crash. The clause is now set-based: one `json_each(?)` parameter (still
one bounded parameter, as the smoke test requires) joined against the roster, with
the case-folded alias table grouped **once**:

```sql
s.id IN (
  SELECT COALESCE(by_id.id, by_code.id, by_alias.id)
  FROM json_each(?) AS selected
  LEFT JOIN students by_id   ON by_id.id = CAST(selected.value AS TEXT)
  LEFT JOIN students by_code ON by_code.student_code = CAST(selected.value AS TEXT)
  LEFT JOIN (SELECT upper(student_code) AS code, MIN(id) AS id
             FROM students GROUP BY upper(student_code) HAVING COUNT(*) = 1) by_alias
         ON by_alias.code = upper(CAST(selected.value AS TEXT))
  WHERE COALESCE(by_id.id, by_code.id, by_alias.id) IS NOT NULL
)
```

Precedence and the fail-closed rules are unchanged and still asserted: a selected
database ID never widens to another student's matching school code, an ambiguous
case-folded alias matches nobody, an explicitly empty selection matches nobody, and
10,000 requested identifiers (9,480 of them unknown) still resolve to exactly the
real students.

**The PAID rows now arrive in chunks.** `paidStudentsForPrint(filter, { chunkSize, maxRows })`
walks the selection in pages of 400 (`PRINT_FETCH_CHUNK_SIZE`) instead of stepping one
unbounded result set, and `paidStudentSelectionOverflows(filter, maxRows)` answers
"is this scope printable at all?" with a bounded `LIMIT n+1` count. The complete
selection is still returned in the SQL print order — the smoke test compares a
520-row job fetched in pages of seven against the same job fetched whole, row for row.

**A print run is bounded, and says so before it starts.** `MAX_BULK_PRINT_TICKETS = 2_000`
(500 A4 pages ≈ 4 s and ~40 MB of streamed HTML in production — measured below) lives in
`lib/student-selection.ts` next to `MAX_STUDENT_SELECTION`. The POST endpoint refuses to
*create* an oversized job; the print route refuses to *render* one (so a job saved by an
older release, or a URL that asks for the whole roster, is refused on the count — before a
single row or QR code is built) and tells the operator to print class by class.

Production measurements on this repository (`next start`, same database):

| job | before | after |
| --- | --- | --- |
| 600 tickets | 16.1 s / 12.9 MB (dev) — 2.0 s / 11.8 MB (prod) | 2.0 s / 11.8 MB, 150 A4 sheets |
| 1,900 tickets (just under the ceiling) | would render ~37 MB in 5.8 s, no cap | 5.8 s / 37.4 MB, 475 sheets, server RSS flat at 74 MB (streamed) |
| 2,600 tickets | attempted render → timeout/OOM risk, 500 | **57 ms**, "This print run is too large for one sheet set" |
| expired / damaged / empty / unknown job | blank page or 500 | **21–35 ms**, exact sentence + reference code |

## 3 · Fallbacks a printer can act on

* `app/sf/print/tickets/page.tsx` is now a controller: the auth redirects happen
  first (outside any `try`, so Next's `NEXT_REDIRECT` is never swallowed), then one
  guarded `loadPrintView()` does *all* database work, then the render is a pure
  function of its result — `BulkTicketSheets` for paper, `TicketPrintNotice` for a
  refusal.
* Every refusal carries a stable reference (`PRINT_JOB_EXPIRED`,
  `PRINT_JOB_UNREADABLE`, `PRINT_JOB_EMPTY`, `PRINT_JOB_OVERSIZE`,
  `PRINT_STORE_UNAVAILABLE`, `PRINT_SELECTION_TOO_WIDE`, `PRINT_NO_PAID_STUDENTS`,
  `PRINT_ROLL_EXPRESSION_INVALID`, `PRINT_RENDER_FAILED`) shown on screen and
  written to the server log under one tag with the job id:

  ```
  [sf/print/tickets] refused · job=ee6834c2-… · PRINT_SELECTION_TOO_WIDE
  [ticket-print-job] snapshot is not readable JSON · job=11111111-… · Unexpected token 'o', …
  ```

  so the report "Error: 95868090" resolves to one line instead of a stack.
* Unexpected faults are caught and reported the same way, never re-thrown to the
  browser, and internal error text is never printed at the operator (the notice
  shows the reference, not `error.message`).
* `app/sf/print/tickets/error.tsx` is a route error boundary: anything that throws
  outside the guarded load (a render fault, a bad import, a database that dies
  mid-stream) now shows the same notice with the Next.js `digest`, a **Try again**
  button and **Back to students** — instead of the framework error page.
* The notice reuses the toolbar's own shell and is marked `no-print`, so it can
  never reach the paper; it lives in the print stylesheet
  (`components/sf/print/ticket-bulk.css`).
* `POST /api/staff/students/bulk-print` wraps the whole preparation in one
  `try/catch` (`students.bulk-print` in the log) and answers JSON — `staff()`'s 401
  and the existing 4xx validation messages are unchanged. The print-audit write and
  the activity log are now non-fatal: they are logged and reported (`recorded: 0`)
  instead of aborting a job whose tickets are already prepared. The response also
  returns `job`, so the panel can quote it.

---

## Files

| File | Change |
| --- | --- |
| `lib/student-db.ts` | set-based identifier resolution; chunked PAID fetch + `paidStudentSelectionOverflows`; `openTicketPrintJob` state machine; hardened `createTicketPrintJob` / `recordTicketPrints` |
| `lib/student-selection.ts` | `MAX_BULK_PRINT_TICKETS` next to `MAX_STUDENT_SELECTION` |
| `app/sf/print/tickets/page.tsx` | guarded controller, refusal states, chunked QR concurrency constant |
| `app/sf/print/tickets/error.tsx` | new route error boundary (digest + retry) |
| `components/sf/print/TicketPrintNotice.tsx` | new screen-only notice for an unprintable job |
| `components/sf/print/ticket-bulk.css` | notice styles, screen-only |
| `app/api/staff/students/bulk-print/route.ts` | single `try/catch`, oversized-scope refusal, non-fatal audit writes, `job` in the response |
| `scripts/student-ticket-smoke.tsx` | section 3b: 30+ new assertions, including live-DB checks for every job state and chunk/order equivalence |
| `README.md` | the print-run ceiling and the failure/notice behaviour |

## Verification

```
npx tsc --noEmit      clean
npx next build        clean (both routes still ƒ dynamic)
npm run smoke         all green (7 suites, 6 ticket groups incl. the new 3b)
npm run test:portal   green
npm run test:student  green
npm run test:canteen  green
npm run test:mailer   green
```

Exercised over HTTP with a signed-in SuperAdmin against a real database, in dev and
in production mode: 12-ID job → POST → `/sf/print/tickets?job=…&lang=bn` (3 sheets,
4 tickets per page, Bangla sheet); 600-ID job; 1,900-ID job; 2,600-ID job (refused);
corrupt snapshot; empty snapshot; expired job; unknown job; missing `job`; direct
`?ids=`, `?student_ids=[]`, `?rolls=1-3&class_name=…`, `?rolls=9-2`; POST with `[]`,
`null`, malformed JSON, unknown IDs, no scope, nested/garbage ID arrays — every one
of them answers with a sentence, and none of them with a 500.
