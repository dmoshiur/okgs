const bnNumber = new Intl.NumberFormat("bn-BD");

/** 12 → ১২ */
export function bn(value: number | string) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? bnNumber.format(numeric) : String(value ?? "");
}

/** 3 → ০৩ (for the two-digit indices used throughout the design) */
export function bnIndex(value: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric < 10 ? `০${bn(numeric)}` : bn(numeric);
}

const longDate = new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "short", year: "numeric" });
const monthDay = new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "short" });
const yearOnly = new Intl.DateTimeFormat("bn-BD", { year: "numeric" });

function safeDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: unknown, style: "long" | "short" = "long") {
  const date = safeDate(value);
  if (!date) return "";
  return (style === "long" ? longDate : shortDate).format(date);
}

export function formatMonthDay(value: unknown) {
  const date = safeDate(value);
  return date ? monthDay.format(date) : "";
}

const monthLong = new Intl.DateTimeFormat("bn-BD", { month: "long", timeZone: "UTC" });

/** Accepts either a plain year (2009) or a full date string. */
export function yearLabel(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text === "0000") return "";
  if (/^\d{4}$/.test(text)) return bn(Number(text));
  const date = safeDate(text.slice(0, 10));
  return date ? yearOnly.format(date) : text;
}

export function formatYear(value: unknown) {
  const date = safeDate(value);
  return date ? yearOnly.format(date) : String(value ?? "");
}

/** “১৮” — day number for the calendar block. */
export function formatDayNumber(value: unknown) {
  const date = safeDate(String(value ?? "").slice(0, 10));
  return date ? bn(date.getUTCDate()) : "";
}

export function formatMonthName(value: unknown, style: "long" | "short" = "short") {
  const date = safeDate(String(value ?? "").slice(0, 10));
  if (!date) return "";
  return new Intl.DateTimeFormat("bn-BD", {
    month: style === "long" ? "long" : "short",
    timeZone: "UTC",
  }).format(date);
}

export function isoDate(value: Date = new Date()) {
  return value.toISOString().slice(0, 10);
}

/** Day difference from today — drives “আজ” / “আগামীকাল” labels. */
export function daysUntil(dateString: unknown) {
  const target = safeDate(`${String(dateString ?? "").slice(0, 10)}T00:00:00Z`);
  if (!target) return Number.NaN;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function relativeDay(dateString: unknown) {
  const diff = daysUntil(dateString);
  if (!Number.isFinite(diff)) return "";
  if (diff === 0) return "আজ";
  if (diff === 1) return "আগামীকাল";
  if (diff === -1) return "গতকাল";
  if (diff > 1 && diff <= 14) return `${bn(diff)} দিন পরে`;
  if (diff < -1 && diff >= -14) return `${bn(Math.abs(diff))} দিন আগে`;
  return "";
}

export function isUpcoming(dateString: unknown) {
  const value = String(dateString ?? "").slice(0, 10);
  return Boolean(value) && value >= isoDate();
}

/* ---------------------------------------------------------------------------
   English (admin) variants.
   The public site stays Bangla — these are used by the English admin studio, so
   the same component tree can format numbers and dates for either audience.
   --------------------------------------------------------------------------- */

const enNumber = new Intl.NumberFormat("en-GB");
const enLongDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });
const enShortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const enDateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const enTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

/** 12 → "12" (Latin digits, thousands separated). */
export function en(value: number | string) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? enNumber.format(numeric) : String(value ?? "");
}

export function formatDateEn(value: unknown, style: "long" | "short" = "long") {
  const date = safeDate(value);
  if (!date) return "";
  return (style === "long" ? enLongDate : enShortDate).format(date);
}

export function formatDateTimeEn(value: unknown) {
  const date = safeDate(value);
  return date ? enDateTime.format(date) : "";
}

/** `14:07` — the gate audit log shows date and time in their own columns. */
export function formatTimeEn(value: unknown) {
  const date = safeDate(value);
  return date ? enTime.format(date) : "";
}

/** `8 Oct 2026` without the clock — used where a date column stands alone. */
export function formatClockDayEn(value: unknown) {
  const date = safeDate(value);
  return date ? enShortDate.format(date) : "";
}

/** "3 items" / "1 item" — avoids the “1 items” tell in English tables. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${en(count)} ${count === 1 ? singular : pluralForm}`;
}

export function initialsOf(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "●";
  const words = text.split(/\s+/);
  return words.length > 1 ? `${words[0][0]}${words[1][0]}` : text.slice(0, 1);
}
