export type CsvUserField =
  | "name"
  | "name_en"
  | "student_id"
  | "class_level"
  | "section"
  | "roll"
  | "email"
  | "phone"
  | "role"
  | "designation"
  | "session_year"
  | "blood_group"
  | "address"
  | "guardian_name"
  | "guardian_phone";

const aliases: Record<string, CsvUserField> = {
  name: "name", full_name: "name", student_name: "name", learner_name: "name", "নাম": "name", শিক্ষার্থীর_নাম: "name",
  name_en: "name_en", english_name: "name_en", "ইংরেজি_নাম": "name_en",
  student_id: "student_id", studentid: "student_id", id: "student_id", student_no: "student_id", admission_no: "student_id", id_number: "student_id", roll_no: "student_id", "আইডি": "student_id", আইডি_নম্বর: "student_id", শিক্ষার্থী_আইডি: "student_id",
  class: "class_level", class_level: "class_level", grade: "class_level", class_name: "class_level", "শ্রেণি": "class_level", শ্রেণী: "class_level",
  section: "section", section_name: "section", "শাখা": "section", বিভাগ: "section",
  roll: "roll", roll_number: "roll", "রোল": "roll", রোল_নম্বর: "roll",
  email: "email", email_address: "email", e_mail: "email", "ইমেইল": "email", ইমেল: "email",
  phone: "phone", mobile: "phone", mobile_number: "phone", telephone: "phone", "মোবাইল": "phone", ফোন: "phone",
  role: "role", user_role: "role", account_role: "role", "ভূমিকা": "role", "রোল_ধরন": "role",
  designation: "designation", position: "designation", title: "designation", পদবি: "designation",
  session: "session_year", session_year: "session_year", year: "session_year", "শিক্ষাবর্ষ": "session_year",
  blood_group: "blood_group", blood: "blood_group", "রক্তের_গ্রুপ": "blood_group",
  address: "address", ঠিকানা: "address",
  guardian: "guardian_name", guardian_name: "guardian_name", parent: "guardian_name", parent_name: "guardian_name", অভিভাবক: "guardian_name", অভিভাবকের_নাম: "guardian_name",
  guardian_phone: "guardian_phone", parent_phone: "guardian_phone", guardian_mobile: "guardian_phone", "অভিভাবকের_মোবাইল": "guardian_phone",
};

export function normalizeCsvHeader(value: string) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s./\\-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]/gu, "");
}

export function mapCsvHeader(value: string): CsvUserField | "" {
  return aliases[normalizeCsvHeader(value)] ?? "";
}

function delimiterScore(text: string, delimiter: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 8);
  if (!lines.length) return 0;
  const counts = lines.map((line) => {
    let quoted = false;
    let count = 0;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && quoted) { i += 1; continue; }
      if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) count += 1;
    }
    return count;
  });
  const positive = counts.filter((count) => count > 0);
  if (!positive.length) return 0;
  const average = positive.reduce((sum, count) => sum + count, 0) / positive.length;
  const consistency = positive.length / counts.length;
  return average * consistency;
}

export function detectDelimiter(text: string) {
  const candidates = [",", "\t", ";", "|"];
  return candidates.map((delimiter) => ({ delimiter, score: delimiterScore(text, delimiter) }))
    .sort((a, b) => b.score - a.score)[0]?.delimiter ?? ",";
}

/** RFC-4180-style parser: quoted separators, escaped quotes and embedded newlines. */
export function parseDelimited(text: string, chosenDelimiter?: string) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  const delimiter = chosenDelimiter || detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return { rows, delimiter };
}

export function inferCsvHeader(rows: string[][]) {
  const first = rows[0] ?? [];
  return first.reduce((count, value) => count + (mapCsvHeader(value) ? 1 : 0), 0) > 0;
}
