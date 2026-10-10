/** School-day boundaries, shared by the server and scanner UI. Bangladesh has no DST. */
export const SCHOOL_TIME_ZONE = "Asia/Dhaka";
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const schoolDateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: SCHOOL_TIME_ZONE, day: "numeric", month: "short", year: "numeric" });
const schoolTimeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: SCHOOL_TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export function schoolDayKey(date = new Date()) {
  return new Date(date.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

export function dhakaDayStartIso(date = new Date()) {
  return new Date(`${schoolDayKey(date)}T00:00:00+06:00`).toISOString();
}

export function nextSchoolDayIso(date = new Date()) {
  return new Date(new Date(dhakaDayStartIso(date)).getTime() + DAY_MS).toISOString();
}

export function formatSchoolDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return schoolDateFormat.format(date);
}

export function formatSchoolTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return schoolTimeFormat.format(date);
}

export function formatSchoolDateTime(value: string) {
  return value ? `${formatSchoolDate(value)} · ${formatSchoolTime(value)}` : "—";
}
