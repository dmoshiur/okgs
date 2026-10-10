/** Helpers shared by the bulk-print API and its server-rendered print route. */

/** Keep request/job payloads bounded while comfortably supporting 500+ students. */
export const MAX_STUDENT_SELECTION = 10_000;

/**
 * Largest selection the bulk print view will render as one A4 stream.
 *
 * Every ticket costs a signed QR (≈6 kB of inline SVG) plus a 95 × 137 mm page
 * box, so 2,000 tickets already means ~40 MB of streamed HTML and a printer spool
 * of 500 A4 sheets. Rendering more than this in one request is what turned a big
 * job into a server timeout/OOM instead of paper, so both the print API and the
 * print route stop *before* fetching and answer with an actionable message
 * ("narrow the scope / print class by class") rather than a 500 page.
 */
export const MAX_BULK_PRINT_TICKETS = 2_000;

/**
 * Accepts arrays, comma/whitespace-separated IDs, and JSON arrays. Student
 * identifiers may be either roster row IDs or school-facing student codes;
 * `studentFilterSql` resolves either form against the database.
 */
export function normalizeStudentIdentifiers(...values: unknown[]): string[] {
  const identifiers = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value !== "string") return;
    const text = value.trim();
    if (!text) return;
    if (text.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (Array.isArray(parsed)) {
          visit(parsed);
          return;
        }
      } catch {
        // Treat malformed JSON as an ordinary delimiter-separated value.
      }
    }
    for (const identifier of text.split(/[\s,;]+/)) {
      const normalized = identifier.trim();
      if (normalized && normalized.length <= 128) identifiers.add(normalized);
    }
  };

  for (const value of values) visit(value);
  return Array.from(identifiers);
}

/** Reads aliases accepted by print URLs (including repeated `id` parameters). */
export function studentIdentifiersFromSearchParams(params: Pick<URLSearchParams, "has" | "getAll">) {
  const keys = ["student_ids", "student_id", "selected_student_ids", "ids", "id"] as const;
  const provided = keys.some((key) => params.has(key));
  const values = keys.flatMap((key) => params.getAll(key));
  return { provided, ids: normalizeStudentIdentifiers(...values) };
}
