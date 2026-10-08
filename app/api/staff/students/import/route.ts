import readXlsxFile from "read-excel-file/node";
import { fail, ok, staff } from "@/lib/api";
import { logActivity } from "@/lib/portal-db";
import { STUDENT_COLUMNS, upsertStudents, type StudentImportRecord } from "@/lib/student-db";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

/** Cell → trimmed text. Numeric cells are turned into whole numbers without a trailing ".0". */
function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/\s+/g, " ").trim();
}

/** Phone numbers stored as numbers lose their leading zero (1712345678 → 01712345678). */
function phoneText(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const digits = String(Math.trunc(value));
    return digits.length === 10 && digits.startsWith("1") ? `0${digits}` : digits;
  }
  return cellText(value);
}

/**
 * POST /api/staff/students/import — multipart/form-data with an .xlsx file.
 *
 * Layout: row 1 is a title, row 2 holds the exact column headers
 *   SL, ID, Roll, Photo, Name, Branch, Shift, Class, Section, Group,
 *   SMS Contact, Father Contact, Father Name, Mother Name, Tags
 * and data starts on row 3. The file is parsed as UTF-8 XML inside the
 * workbook, so Bangla names are kept exactly as typed.
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Choose an .xlsx file to import.", 422);
  if (!/\.xlsx$/i.test(file.name)) return fail("Only .xlsx (Excel 2007+) files are accepted. Save your file as .xlsx and try again.", 422);
  if (file.size > MAX_BYTES) return fail("The file is larger than 10 MB.", 413);

  let rows: unknown[][];
  try {
    const sheets = await readXlsxFile(Buffer.from(await file.arrayBuffer()));
    rows = (sheets[0]?.data ?? []) as unknown[][];
  } catch {
    return fail("This Excel file could not be read. Make sure it is a valid .xlsx workbook.", 422);
  }

  if (rows.length < 2) return fail("The sheet needs a title on row 1 and the column headers on row 2.", 422);

  const headers = (rows[1] ?? []).map((cell) => cellText(cell));
  const index = new Map<string, number>();
  headers.forEach((header, position) => {
    if (header && !index.has(header)) index.set(header, position);
  });
  const missing = STUDENT_COLUMNS.filter((column) => !index.has(column));
  if (missing.length) {
    return fail(`Missing column header(s) on row 2: ${missing.join(", ")}. Headers must match exactly.`, 422);
  }

  const batch = `import-${Date.now()}`;
  const records: StudentImportRecord[] = [];
  const errors: { row: number; message: string }[] = [];
  const seen = new Set<string>();

  for (let rowIndex = 2; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const cell = (column: (typeof STUDENT_COLUMNS)[number]) => row[index.get(column) ?? -1];
    const values = STUDENT_COLUMNS.map((column) => cellText(cell(column)));
    if (values.every((value) => !value)) continue;

    const excelRow = rowIndex + 1;
    const code = cellText(cell("ID"));
    const name = cellText(cell("Name"));
    if (!code) {
      errors.push({ row: excelRow, message: "ID is empty." });
      continue;
    }
    if (!name) {
      errors.push({ row: excelRow, message: `ID ${code} has no name.` });
      continue;
    }
    if (seen.has(code)) {
      errors.push({ row: excelRow, message: `Duplicate ID ${code} in this file — the first occurrence was kept.` });
      continue;
    }
    seen.add(code);

    const photo = cellText(cell("Photo"));
    records.push({
      serial_no: Number.parseInt(cellText(cell("SL")), 10) || 0,
      student_code: code,
      roll: cellText(cell("Roll")),
      photo_url: /^https?:\/\//i.test(photo) ? photo : "",
      name,
      branch: cellText(cell("Branch")),
      shift: cellText(cell("Shift")),
      class_name: cellText(cell("Class")),
      section: cellText(cell("Section")),
      student_group: cellText(cell("Group")),
      sms_contact: phoneText(cell("SMS Contact")),
      father_contact: phoneText(cell("Father Contact")),
      father_name: cellText(cell("Father Name")),
      mother_name: cellText(cell("Mother Name")),
      tags: cellText(cell("Tags")),
    });
  }

  if (!records.length) {
    return fail(errors.length ? `No importable rows. ${errors[0].message}` : "The sheet has no student rows below the header.", 422);
  }

  const { inserted, updated } = await upsertStudents(records, batch);

  await logActivity({
    actor_id: session.user.id,
    actor_name: session.user.name,
    actor_role: session.role,
    action: "students.import",
    entity: "students",
    entity_id: batch,
    detail: `${file.name}: ${inserted} new, ${updated} updated, ${errors.length} skipped`,
  });

  return ok({
    file: file.name,
    total: records.length,
    inserted,
    updated,
    skipped: errors.length,
    errors: errors.slice(0, 50),
  });
}
