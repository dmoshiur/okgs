/**
 * Client-safe rules for the notices feed: which category an item belongs to,
 * whether it is urgent, and the stable key used for read tracking.
 *
 * Pure functions only (no database or mailer imports), so the student dashboard,
 * the fair console and the API all classify an item the same way.
 */

export type AnnouncementCategory = "science_fair" | "notice" | "update";

export const announcementCategories: AnnouncementCategory[] = ["science_fair", "notice", "update"];

/** `notice:<id>`, `news:<id>` … — one key per item, per kind. */
export function announcementKey(kind: string, id: string) {
  return `${kind}:${id}`;
}

/**
 * Notices keep the office's type ("জরুরি" is urgent). News and updates are
 * grouped by their department/kind: the science-fair ones form their own
 * category. Fair tickers that are plain announcements count as notices.
 */
export function announcementCategory(kind: string, row: Record<string, unknown>): { category: AnnouncementCategory; urgent: boolean; label: string } {
  const text = (value: unknown) => String(value ?? "").trim();
  if (kind === "notice") {
    const label = text(row.type) || "সাধারণ";
    return { category: "notice", urgent: label === "জরুরি", label };
  }
  if (kind === "news") {
    const label = text(row.category) || "ক্যাম্পাস";
    return { category: label === "বিজ্ঞান মেলা" ? "science_fair" : "update", urgent: false, label };
  }
  if (kind === "update") {
    const label = text(row.kind) || "কার্যক্রম";
    return { category: label === "বিজ্ঞান" ? "science_fair" : "update", urgent: false, label };
  }
  // ticker — the fair's running messages
  const tickerKind = text(row.kind).toLowerCase() || "notice";
  const urgent = tickerKind === "urgent";
  if (tickerKind === "notice" || urgent) return { category: "notice", urgent, label: tickerKind };
  return { category: text(row.fair_slug) ? "science_fair" : "update", urgent: false, label: tickerKind };
}
