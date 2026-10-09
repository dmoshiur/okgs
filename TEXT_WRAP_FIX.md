# Fix: Prevent mid-word text wrapping in table cells and status badges

## Root cause
CSS rule `overflow-wrap: anywhere` on `.sf-table td` / `.data-table td` was allowing
the browser to break *any* string — including words like "Morning" or "UNPAID" —
mid-character ("Mornin g", "UNPAI D") whenever a table column became narrower
than the word. The horizontal-scroll wrapper was already in place, but the
`anywhere` rule forced the text to break instead of letting the table scroll.

Status badges (`.sf-badge`, `.sf-pay`) had `padding: 3px 10px` and no
`flex-shrink: 0`, so flex/table shrinkage was compressing the pill and causing
the label to wrap to two lines.

---

## 1. Global fix: `white-space: nowrap` on every `<td>` by default

Apply the following CSS so all table cells render on a single line. The
table already sits inside a horizontally-scrollable wrapper (`.sf-table-wrap` /
`.table-scroll` / `.table-scroll { overflow-x: auto }`), so on narrow screens
the table scrolls horizontally instead of squeezing labels into two lines.

```css
/* --- Science-fair staff console tables --- */
.sf-console .sf-table,
.sf-console .data-table {
  width: 100%;
  min-width: 620px;        /* guarantees columns never collapse below content */
  border-collapse: collapse;
}

/* All cells: single-line, never break mid-word */
.sf-console .sf-table th,
.sf-console .sf-table td,
.sf-console .data-table th,
.sf-console .data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--sf-line-2);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;         /* ← prevents "UNPAID" → "UNPAI D" */
  overflow-wrap: normal;       /* ← overrides the old `anywhere` rule */
  word-break: keep-all;        /* ← never split inside a Latin word */
}

/* Header labels were already nowrap — kept for clarity */
.sf-console .sf-table th,
.sf-console .data-table th {
  background: var(--sf-card-2);
  color: var(--sf-muted);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
  white-space: nowrap;
}

/* Opt-in for cells that intentionally hold two-line prose (e.g. Name + "Father: …") */
.sf-console .sf-table td.sf-wrap-cell,
.sf-console .data-table td.sf-wrap-cell {
  white-space: normal;
  overflow-wrap: break-word;   /* break-word, not anywhere — whole words only */
  word-break: normal;
  vertical-align: top;
}

/* --- Generic admin .data-table (ContentListTable, user manager, etc.) --- */
.data-table td {
  padding: 14px 12px;
  border-bottom: 1px solid var(--line-2);
  vertical-align: middle;
  white-space: nowrap;
  overflow-wrap: normal;
  word-break: keep-all;
}
.data-table td.data-wrap {
  white-space: normal;
  overflow-wrap: break-word;
  word-break: normal;
  vertical-align: top;
}
.table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
}
```

---

## 2. Status badge / pill fix — proper width and centering

Badges must never shrink or wrap. Use `inline-flex` + `white-space: nowrap` +
`flex-shrink: 0` + `min-width: fit-content`, plus generous horizontal padding
so the pill has room to breathe and the text stays centered.

```css
/* Status badge (Entered / Active / Revoked / count chips) */
.sf-console .sf-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;                   /* never shrink inside a flex/table cell */
  padding: 4px 12px;                /* 12px horizontal — enough for "UNPAID" */
  min-width: fit-content;           /* pill sized to content, not squeezed */
  width: max-content;
  border-radius: var(--r-pill, 999px);
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: .02em;
  white-space: nowrap;              /* single line, no matter what */
  text-align: center;
  color: var(--sf-body);
  background: var(--sf-card-2);
  border: 1px solid var(--sf-line);
}

/* Payment toggle button-pill (PAID / UNPAID) */
.sf-console .sf-pay {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 5px 14px;
  min-width: fit-content;
  width: max-content;
  border-radius: var(--r-pill, 999px);
  border: 1px solid var(--sf-line);
  background: var(--sf-card-2);
  color: var(--sf-body);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  text-align: center;
  cursor: pointer;
}
.sf-console .sf-pay.is-paid   { color: var(--sf-good);  background: var(--sf-good-bg);  border-color: var(--sf-good-line); }
.sf-console .sf-pay.is-unpaid { color: var(--sf-bad);   background: var(--sf-bad-bg);   border-color: var(--sf-bad-line); }
```

### Tailwind CSS equivalent (if you prefer utility classes on the element):

```jsx
// Status badge
<span className="inline-flex items-center justify-center flex-shrink-0
                 px-3 py-1 min-w-fit w-max rounded-full
                 text-xs font-semibold leading-none whitespace-nowrap text-center
                 bg-emerald-50 text-emerald-700 border border-emerald-200">
  Paid
</span>

// Payment button
<button className="inline-flex items-center justify-center flex-shrink-0
                   px-3.5 py-1.5 min-w-fit w-max rounded-full
                   text-xs font-semibold leading-none whitespace-nowrap text-center
                   bg-red-50 text-red-700 border border-red-200">
  UNPAID
</button>
```

The critical Tailwind utilities for the fix are:
- `whitespace-nowrap`  — prevents line breaks inside the text
- `flex-shrink-0`      — prevents the pill from being squeezed by its flex/table parent
- `min-w-fit` / `w-max` / `px-3` — guarantees the pill is wide enough for the label
- `inline-flex items-center justify-center` — keeps the label vertically and horizontally centered
- `leading-none` — removes extra line-height that can make a single-line pill look like two

---

## 3. Table column structure snippet (React + Tailwind)

A clean, reusable table that never wraps short labels, scrolls horizontally
on small screens, and only wraps the Name column (which intentionally has a
sub-line like "Father: …"):

```jsx
<div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
  <table className="w-full min-w-[620px] border-collapse text-sm">
    <thead>
      <tr className="bg-slate-50">
        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Roll</th>
        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">ID</th>
        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Name</th>
        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Shift</th>
        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Payment</th>
        <th className="whitespace-nowrap px-3 py-2"></th>
      </tr>
    </thead>
    <tbody>
      {rows.map((s) => (
        <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
          <td className="whitespace-nowrap px-3 py-2.5 align-middle">{s.roll}</td>
          <td className="whitespace-nowrap px-3 py-2.5 align-middle font-mono text-xs">{s.code}</td>

          {/* Name column is the only one allowed to wrap (shows "Father: …" sub-line) */}
          <td className="px-3 py-2.5 align-top break-words">
            <strong className="block text-slate-900">{s.name}</strong>
            {s.father && (
              <small className="block text-xs text-slate-500">Father: {s.father}</small>
            )}
          </td>

          <td className="whitespace-nowrap px-3 py-2.5 align-middle">{s.shift /* "Morning" stays on one line */}</td>

          <td className="whitespace-nowrap px-3 py-2.5 align-middle">
            <button
              className={`inline-flex flex-shrink-0 items-center justify-center
                          px-3 py-1 min-w-fit w-max rounded-full
                          text-xs font-semibold leading-none whitespace-nowrap text-center
                          border ${s.paid
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"}`}>
              {s.paid ? "PAID" : "UNPAID"}
            </button>
          </td>

          <td className="whitespace-nowrap px-3 py-2.5 align-middle">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap">
              Print
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### Key points

| Concern | Utility / Rule | Why it matters |
|---|---|---|
| Short labels never split | `whitespace-nowrap` on every `<td>` (and on `<th>`) | Stops "Morning" → "Mornin g" and "UNPAID" → "UNPAI D" |
| Horizontal scroll on small screens | wrapper with `overflow-x-auto`, table with `min-w-[620px]` | Table scrolls instead of squishing columns |
| Pills don't shrink | `flex-shrink-0` on the badge/button | Prevents the pill from compressing the label into two lines |
| Pills size to content | `min-w-fit w-max px-3 py-1 leading-none` | Guarantees "UNPAID" fits centered on one line |
| Name column only wraps where intended | Add `break-words` (no `whitespace-nowrap`) only on the name `<td>` | Every other column stays single-line; multi-line prose still works |
| Word breaks at word boundaries, not mid-character | `overflow-wrap: break-word` (not `anywhere`) + `word-break: normal` | If long text must wrap, it breaks at spaces/hyphens, never inside "Morning" |
