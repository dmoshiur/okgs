/**
 * Row layout of the school's roster export. `header` is what row 2 must say;
 * `aliases` are accepted too, because the same report is exported from three
 * different office programs and one of them renames a column now and then.
 */
export interface StudentColumn {
  key:
    | "serial_no"
    | "student_code"
    | "roll"
    | "photo_url"
    | "name"
    | "branch"
    | "shift"
    | "class_name"
    | "section"
    | "student_group"
    | "sms_contact"
    | "father_contact"
    | "father_name"
    | "mother_name"
    | "tags";
  header: string;
  aliases: string[];
  /** Numbers are converted from Bangla digits and stripped of separators. */
  numeric?: boolean;
  /** Phone numbers keep a leading zero that Excel happily ate. */
  phone?: boolean;
  required?: boolean;
}

export const studentColumns: StudentColumn[] = [
  { key: "serial_no", header: "SL", aliases: ["SL NO", "SL.", "SERIAL", "ক্রমিক"], numeric: true },
  { key: "student_code", header: "ID", aliases: ["SCHOOL ID", "STUDENT ID", "স্কুল ID"], required: true },
  { key: "roll", header: "Roll", aliases: ["ROLL NO", "ROLL NO.", "রোল"], numeric: true },
  { key: "photo_url", header: "Photo", aliases: ["PHOTO URL", "PICTURE"] },
  { key: "name", header: "Name", aliases: ["STUDENT NAME", "NAME OF STUDENT", "নাম"], required: true },
  { key: "branch", header: "Branch", aliases: ["STREAM"] },
  { key: "shift", header: "Shift", aliases: ["MORNING/EVENING"] },
  { key: "class_name", header: "Class", aliases: ["CLASS NAME", "GRADE", "শ্রেণি"] },
  { key: "section", header: "Section", aliases: ["SEC", "শাখা"] },
  { key: "student_group", header: "Group", aliases: ["GROUP NAME"] },
  { key: "sms_contact", header: "SMS Contact", aliases: ["SMS MOBILE", "MOBILE", "ফোন"], phone: true },
  { key: "father_contact", header: "Father Contact", aliases: ["GUARDIAN MOBILE", "FATHER MOBILE", "অভিভাবকের ফোন"], phone: true },
  { key: "father_name", header: "Father Name", aliases: ["FATHER'S NAME", "GUARDIAN NAME", "পিতার নাম"] },
  { key: "mother_name", header: "Mother Name", aliases: ["MOTHER'S NAME", "মাতার নাম"] },
  { key: "tags", header: "Tags", aliases: ["TAG", "REMARKS", "NOTES"] },
];

/** `ID` → canonical label used in messages. */
export const studentColumnHeaders = studentColumns.map((column) => column.header);

/** Normaliser used for header comparison: upper-case, single spaces, no punctuation. */
export function headerKey(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .replace(/[.:]/g, "");
}
