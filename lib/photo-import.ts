/**
 * Photo-mapping sheet — the parser behind the bulk photo upload.
 *
 * The office exports a two-or-three column sheet from the photo studio:
 *
 *     student_id , roll , photo_url
 *     2026-0101  , 5    , https://res.cloudinary.com/okgs/image/upload/v1/okgs/students/101.jpg
 *
 * `student_id` (the school ID) is the preferred key; `roll` is accepted for
 * sheets that only carry the class register number. The URL is expected to be a
 * Cloudinary delivery link, but any absolute http(s) URL is stored — schools that
 * host photos elsewhere should not be blocked, they are simply counted so the
 * result screen can say how many rows are not on Cloudinary.
 *
 * This module is pure: no database, no network. The route parses with it, then
 * hands the entries to `updateStudentPhotos`.
 */
import { parseDelimited } from "@/lib/csv";
import { headerKey } from "@/lib/student-columns";
import { toLatinDigits } from "@/lib/digits";

export type PhotoMatchKey = "code" | "roll";

export interface PhotoEntry {
  /** School ID or roll, normalised (upper-case ID, Latin digits for the roll). */
  key: string;
  match: PhotoMatchKey;
  photo_url: string;
  /** Optional parent photo URLs synced in the same pass. */
  father_photo_url?: string;
  mother_photo_url?: string;
  /** Row number as the office sees it in Excel (1-based). */
  row: number;
}

export interface PhotoRowError {
  row: number;
  message: string;
}

export interface PhotoImportParse {
  entries: PhotoEntry[];
  errors: PhotoRowError[];
  /** Data rows seen, including the ones that were skipped. */
  total: number;
  /** 1-based row the headers were found on. */
  headerRow: number;
  /** How many accepted URLs are not Cloudinary delivery links. */
  nonCloudinary: number;
  /** Header text found for each column, so the result screen can show the mapping. */
  columns: { code: string; roll: string; photo: string };
}

/** Accepted header spellings, in every language the office uses. */
export const photoImportColumns = {
  code: ["ID", "STUDENT ID", "STUDENT_ID", "SCHOOL ID", "STUDENT CODE", "ADMISSION NO", "আইডি", "স্কুল আইডি"],
  roll: ["ROLL", "ROLL NO", "ROLL NO.", "ROLL NUMBER", "রোল", "রোল নম্বর"],
  photo: ["PHOTO", "PHOTO URL", "PHOTO_URL", "PICTURE", "IMAGE", "IMAGE URL", "CLOUDINARY URL", "LINK", "ছবি", "ছবির লিংক"],
  /** Optional parent columns — synced in the same pass when present. */
  fatherPhoto: ["FATHER PHOTO", "FATHER PHOTO URL", "FATHER_PHOTO_URL", "FATHER PICTURE", "FATHER IMAGE", "পিতার ছবি"],
  motherPhoto: ["MOTHER PHOTO", "MOTHER PHOTO URL", "MOTHER_PHOTO_URL", "MOTHER PICTURE", "MOTHER IMAGE", "মাতার ছবি"],
} as const;

const EMPTY_RESULT: PhotoImportParse = {
  entries: [],
  errors: [],
  total: 0,
  headerRow: 0,
  nonCloudinary: 0,
  columns: { code: "", roll: "", photo: "" },
};

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  return text === "null" || text === "undefined" ? "" : text;
}

/** Absolute http(s) URL with no stray spaces — what the database will store. */
export function isPhotoUrl(value: unknown) {
  const url = String(value ?? "").trim();
  return /^https?:\/\/[^\s"'<>]+$/i.test(url);
}

/** True for `res.cloudinary.com` delivery links (auto-format resizing applies). */
export function isCloudinaryPhoto(value: unknown) {
  return /^https?:\/\/res\.cloudinary\.com\//i.test(String(value ?? "").trim());
}

/** Finds the header row and the column positions, searching the first ten rows. */
function locatePhotoHeader(rows: unknown[][]) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex += 1) {
    const labels = (rows[rowIndex] ?? []).map((cell) => headerKey(cellText(cell)));
    if (!labels.length) continue;
    const positions = new Map<string, number>();
    labels.forEach((label, position) => {
      if (!label || positions.has(label)) return;
      positions.set(label, position);
    });
    const find = (candidates: readonly string[]) => {
      for (const candidate of candidates) {
        const position = positions.get(headerKey(candidate));
        if (position !== undefined) return { position, label: candidate };
      }
      return null;
    };
    const code = find(photoImportColumns.code);
    const roll = find(photoImportColumns.roll);
    const photo = find(photoImportColumns.photo);
    const fatherPhoto = find(photoImportColumns.fatherPhoto);
    const motherPhoto = find(photoImportColumns.motherPhoto);
    // A photo column plus one key column is the minimum usable sheet.
    if (photo && (code || roll)) {
      return {
        rowIndex,
        code: code?.position,
        roll: roll?.position,
        photo: photo.position,
        fatherPhoto: fatherPhoto?.position,
        motherPhoto: motherPhoto?.position,
        columns: { code: code?.label ?? "", roll: roll?.label ?? "", photo: photo.label },
      };
    }
  }
  return null;
}

/** Parses an already-split sheet (rows of cells) — .xlsx or a CSV parser's output. */
export function parsePhotoSheet(rows: unknown[][]): PhotoImportParse {
  const header = locatePhotoHeader(rows);
  if (!header) {
    return {
      ...EMPTY_RESULT,
      errors: [
        {
          row: 1,
          message: `No header row found. Row 1 must hold: ${[...photoImportColumns.code.slice(0, 1), ...photoImportColumns.roll.slice(0, 1), ...photoImportColumns.photo.slice(0, 1)].join(", ")}.`,
        },
      ],
    };
  }

  const entries: PhotoEntry[] = [];
  const errors: PhotoRowError[] = [];
  const seen = new Set<string>();
  let total = 0;
  let nonCloudinary = 0;

  for (let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const at = (position?: number) => (position === undefined ? "" : cellText(row[position]));
    const code = toLatinDigits(at(header.code)).trim();
    const roll = toLatinDigits(at(header.roll)).trim();
    const photo = at(header.photo);
    const fatherPhoto = at(header.fatherPhoto);
    const motherPhoto = at(header.motherPhoto);
    if (!code && !roll && !photo && !fatherPhoto && !motherPhoto) continue;

    total += 1;
    const excelRow = rowIndex + 1;
    const key = code ? code.toUpperCase() : roll;
    const match: PhotoMatchKey = code ? "code" : "roll";

    if (!key) {
      errors.push({ row: excelRow, message: "No student ID or roll on this row." });
      continue;
    }
    if (!photo) {
      errors.push({ row: excelRow, message: `${key} has no photo URL.` });
      continue;
    }
    if (!isPhotoUrl(photo)) {
      errors.push({ row: excelRow, message: `${key}: "${photo.slice(0, 60)}" is not a valid http(s) URL.` });
      continue;
    }
    const dedupeKey = `${match}:${key}`;
    if (seen.has(dedupeKey)) {
      errors.push({ row: excelRow, message: `${key} appears more than once — the first row was kept.` });
      continue;
    }
    seen.add(dedupeKey);
    if (!isCloudinaryPhoto(photo)) nonCloudinary += 1;
    // Parent photos are optional columns; invalid cells are dropped, not fatal.
    const entry: PhotoEntry = { key, match, photo_url: photo, row: excelRow };
    if (isPhotoUrl(fatherPhoto)) entry.father_photo_url = fatherPhoto;
    if (isPhotoUrl(motherPhoto)) entry.mother_photo_url = motherPhoto;
    entries.push(entry);
  }

  return { entries, errors, total, headerRow: header.rowIndex + 1, nonCloudinary, columns: header.columns };
}

/** Parses CSV/TSV text (delimiter auto-detected). */
export function parsePhotoCsv(text: string): PhotoImportParse {
  const { rows } = parseDelimited(text);
  return parsePhotoSheet(rows);
}

/** The sheet the office should fill in — served as a download from the panel. */
export function photoTemplateCsv(sample?: { student_id: string; roll: string; photo_url: string; father_photo_url?: string; mother_photo_url?: string }[]) {
  const rows = sample ?? [
    {
      student_id: "2026-0101",
      roll: "1",
      photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/students/2026-0101.jpg",
      father_photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/fathers/2026-0101.jpg",
      mother_photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/mothers/2026-0101.jpg",
    },
    { student_id: "2026-0102", roll: "2", photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/students/2026-0102.jpg" },
  ];
  return [
    "student_id,roll,photo_url,father_photo_url,mother_photo_url",
    ...rows.map((row) =>
      [row.student_id, row.roll, row.photo_url, row.father_photo_url ?? "", row.mother_photo_url ?? ""]
        .map((value) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value))
        .join(","),
    ),
  ].join("\n");
}
