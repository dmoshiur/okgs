import readXlsxFile from "read-excel-file/node";
import { fail, ok, staff, str } from "@/lib/api";
import { logActivity } from "@/lib/portal-db";
import { updateStudentPhotos } from "@/lib/student-db";
import { parsePhotoCsv, parsePhotoSheet } from "@/lib/photo-import";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = /\.(csv|tsv|txt|xlsx)$/i;

/**
 * POST /api/staff/students/photos — multipart/form-data
 *
 *   file       .csv / .tsv / .txt / .xlsx holding `student_id | roll | photo_url`
 *   dry_run    "1" to validate and count without writing anything
 *
 * The batch is parsed by `lib/photo-import.ts` (pure) and written by
 * `updateStudentPhotos`, which resolves every student in two indexed lookups and
 * commits the URLs in `db.batch` chunks — one round-trip per hundred rows rather
 * than one per student.
 *
 * Response: `{ file, total, matched, updated, unchanged, missing, errors, non_cloudinary, dry_run }`
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Choose a .csv or .xlsx file with the photo links.", 422);
  if (!ACCEPTED.test(file.name)) return fail("Only .csv, .tsv, .txt or .xlsx files are accepted.", 422);
  if (file.size > MAX_BYTES) return fail("The file is larger than 10 MB.", 413);

  const dryRun = ["1", "true", "yes"].includes(str(form?.get("dry_run")).toLowerCase());
  const buffer = Buffer.from(await file.arrayBuffer());
  const isSheet = /\.xlsx$/i.test(file.name);

  let parsed;
  try {
    if (isSheet) {
      const sheets = await readXlsxFile(buffer);
      const list = Array.isArray(sheets) ? sheets : [sheets];
      const rows = (list.find((sheet) => Array.isArray(sheet) && sheet.length) ?? []) as unknown[][];
      parsed = parsePhotoSheet(rows);
    } else {
      // Spreadsheets saved as CSV arrive as UTF-8 with a possible BOM; the
      // delimiter is detected (comma, tab, semicolon or pipe).
      parsed = parsePhotoCsv(buffer.toString("utf8"));
    }
  } catch {
    return fail("This file could not be read. Save it as .csv or .xlsx and try again.", 422);
  }

  if (!parsed.entries.length) {
    return fail(
      parsed.errors.length
        ? `No usable rows. ${parsed.errors[0].message}`
        : "The sheet has no rows below the header.",
      422,
    );
  }

  const result = await updateStudentPhotos(parsed.entries, { dryRun });

  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: dryRun ? "students.photos.preview" : "students.photos.import",
    entity: "students",
    entity_id: file.name,
    detail: `${parsed.entries.length} row(s) read · ${result.updated} photo(s) ${dryRun ? "would change" : "updated"} · ${result.missing.length} unmatched`,
  });

  return ok({
    file: file.name,
    total: parsed.total,
    read: parsed.entries.length,
    matched: result.matched,
    updated: result.updated,
    unchanged: result.unchanged,
    missing: result.missing,
    errors: parsed.errors.slice(0, 50),
    error_count: parsed.errors.length,
    non_cloudinary: parsed.nonCloudinary,
    header_row: parsed.headerRow,
    columns: parsed.columns,
    dry_run: dryRun,
  });
}
