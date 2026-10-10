import readXlsxFile from "read-excel-file/node";
import { fail, ok, staff } from "@/lib/api";
import { logActivity } from "@/lib/portal-db";
import { upsertStudents, type StudentImportRecord } from "@/lib/student-db";
import { headerKey, studentColumns } from "@/lib/student-columns";
import { toLatinDigits } from "@/lib/digits";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Cell → trimmed text.
 *
 * `read-excel-file` hands back the sheet's shared strings already decoded as
 * UTF-8, so Bangla names reach this function intact and are written back
 * untouched — nothing here transliterates, strips or re-encodes a name.
 */
function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).replace(/\s+/g, " ").trim();
  return text === "null" || text === "undefined" ? "" : text;
}

/** Numeric/phone fields additionally switch Bengali digits to ASCII. */
function cellNumber(value: unknown) {
  return toLatinDigits(cellText(value));
}

/** Phone numbers stored as numbers lose their leading zero (1712345678 → 01712345678). */
function phoneText(value: unknown) {
  const digits = cellNumber(value).replace(/[^\d+]/g, "");
  if (/^1\d{9}$/.test(digits)) return `0${digits}`;
  return digits || cellNumber(value);
}

/**
 * POST /api/staff/students/import — multipart/form-data with an .xlsx file.
 *
 * Layout: row 1 is a title, row 2 holds the exact column headers
 *   SL, ID, Roll, Photo, Name, Branch, Shift, Class, Section, Group,
 *   SMS Contact, Father Contact, Father Name, Mother Name,
 *   Father Photo, Mother Photo, Tags
 * and data starts on row 3. The file is parsed as UTF-8 XML inside the
 * workbook, so Bangla names are kept exactly as typed. The photo columns
 * carry image URLs (Cloudinary links) for the student, father and mother, so
 * a roster sync brings every picture the printed ticket needs.
 */
/**
 * The school's export is fixed: row 1 is the report title, row 2 the column
 * headers named above, data from row 3.
 * A sheet whose header row has slipped (someone deleted the title, or Excel put
 * the headers in row 1) is still read — we search the first ten rows for the
 * header line instead of trusting a position.
 */
function locateHeader(rows: unknown[][]) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex += 1) {
    const labels = (rows[rowIndex] ?? []).map((cell) => headerKey(cellText(cell)));
    if (!labels.length) continue;
    const hits = labels.filter((label) => studentColumns.some((column) => headerKey(column.header) === label)).length;
    if (hits >= 3) {
      const index = new Map<string, number>();
      labels.forEach((label, position) => {
        if (!label || index.has(label)) return;
        index.set(label, position);
      });
      return { rowIndex, index };
    }
  }
  return null;
}

/** Column position for a definition: exact header first, then its aliases. */
function columnIndex(index: Map<string, number>, column: (typeof studentColumns)[number]) {
  const direct = index.get(headerKey(column.header));
  if (direct !== undefined) return direct;
  for (const alias of column.aliases) {
    const found = index.get(headerKey(alias));
    if (found !== undefined) return found;
  }
  return undefined;
}

export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Choose an .xlsx file to import.", 422);
  if (!/\.xlsx$/i.test(file.name)) return fail("Only .xlsx (Excel 2007+) files are accepted. Save your file as .xlsx and try again.", 422);
  if (file.size > MAX_BYTES) return fail("The file is larger than 10 MB.", 413);

  let rows: unknown[][] = [];
  try {
    const sheets = await readXlsxFile(Buffer.from(await file.arrayBuffer()));
    const list = Array.isArray(sheets) ? sheets : [sheets];
    // Pick the sheet that actually holds the headers — the office keeps a
    // "Sheet1" plus a print-out copy, and the wrong one is often first.
    for (const sheet of list) {
      const data = (Array.isArray(sheet) ? sheet : sheet?.data) as unknown[][] | undefined;
      if (!data?.length) continue;
      rows = data;
      if (locateHeader(data)) break;
    }
  } catch {
    return fail("This Excel file could not be read. Make sure it is a valid .xlsx workbook.", 422);
  }

  if (rows.length < 2) return fail("The sheet needs a title on row 1 and the column headers on row 2.", 422);
  const header = locateHeader(rows);
  if (!header) {
    return fail(
      `Row 2 must hold the column headers: ${studentColumns.map((column) => column.header).join(", ")}.`,
      422,
    );
  }
  const missing = studentColumns.filter((column) => column.required && columnIndex(header.index, column) === undefined);
  if (missing.length) {
    return fail(`Missing column header(s): ${missing.map((column) => column.header).join(", ")}. Fix row 2 and re-upload.`, 422);
  }

  const batch = `import-${Date.now()}`;
  const records: StudentImportRecord[] = [];
  const errors: { row: number; message: string }[] = [];
  const seen = new Set<string>();
  const positions = new Map(studentColumns.map((column) => [column.key, columnIndex(header.index, column)]));
  const at = (row: unknown[], key: (typeof studentColumns)[number]["key"]) => {
    const position = positions.get(key);
    return position === undefined ? "" : row[position];
  };

  for (let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const text = (key: (typeof studentColumns)[number]["key"]) => cellText(at(row, key));
    if (studentColumns.every((column) => !text(column.key))) continue;

    const excelRow = rowIndex + 1;
    const code = cellNumber(at(row, "student_code"));
    const name = text("name");
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

    const photo = text("photo_url");
    const fatherPhoto = text("father_photo_url");
    const motherPhoto = text("mother_photo_url");
    records.push({
      serial_no: Number.parseInt(cellNumber(at(row, "serial_no")), 10) || 0,
      student_code: code,
      roll: toLatinDigits(text("roll")).replace(/[^\w/-]/g, ""),
      photo_url: /^https?:\/\//i.test(photo) ? photo : "",
      name,
      branch: text("branch"),
      shift: text("shift"),
      class_name: text("class_name"),
      section: text("section"),
      student_group: text("student_group"),
      sms_contact: phoneText(at(row, "sms_contact")),
      father_contact: phoneText(at(row, "father_contact")),
      father_name: text("father_name"),
      mother_name: text("mother_name"),
      father_photo_url: /^https?:\/\//i.test(fatherPhoto) ? fatherPhoto : "",
      mother_photo_url: /^https?:\/\//i.test(motherPhoto) ? motherPhoto : "",
      tags: text("tags"),
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
    /** Row 2 in the school template; reported so an odd sheet is obvious at a glance. */
    header_row: header.rowIndex + 1,
  });
}
