/**
 * Site settings — the dynamic half of the site's identity.
 *
 * Everything the SuperAdmin edits on /admin/settings is stored as a `settings`
 * row (key → value) in the primary database, so the public pages pick the change
 * up on the next render without a deploy. The public site reads these keys
 * through `settingValue(content.settings, key)` in lib/club-data.ts and
 * `readSetting(...)` in lib/site.ts.
 */
import type { SiteSetting } from "@/lib/types";
import { readFlag, readSetting, setSetting } from "@/lib/site";
import { listRows } from "@/lib/db";

export const MAINTENANCE_KEY = "maintenance_mode";
export const MAINTENANCE_MESSAGE_KEY = "maintenance_message";
export const MAINTENANCE_UPDATED_KEY = "maintenance_updated_at";

export interface SiteSettingField {
  key: string;
  label: string;
  kind: "text" | "textarea" | "image" | "url" | "tel" | "email";
  help: string;
  placeholder?: string;
  /** Long values (addresses, notes) get a full-width row in the form. */
  full?: boolean;
  group: "identity" | "contact" | "branding";
}

/**
 * The canonical, editable site identity. Adding a row here puts a field on the
 * Site Settings page — the value itself lives in the database.
 */
export const siteSettingFields: SiteSettingField[] = [
  { key: "site_name", label: "Site Name", kind: "text", group: "identity", placeholder: "ওমর কিন্ডারগার্টেন স্কুল", help: "Shown in the header, footer, mail and the JSON-LD organisation card." },
  { key: "site_title", label: "Browser Title", kind: "text", group: "identity", placeholder: "ওমর কিন্ডারগার্টেন স্কুল | কালাই, জয়পুরহাট", help: "The default <title> of the public pages. Page-level titles append “| site name” automatically." },
  { key: "short_name", label: "Short Name", kind: "text", group: "identity", placeholder: "ওকেজিএস", help: "Compact badge in the footer. Headers and mobile navigation use the full Site Name." },
  { key: "tagline", label: "Tagline", kind: "text", group: "identity", placeholder: "কালাই, জয়পুরহাট", help: "One-line description used as the meta description fallback." },
  { key: "address", label: "Address", kind: "text", group: "contact", placeholder: "কালাই সদর, জয়পুরহাট", help: "Shown in the footer, the contact block and the organisation schema." },
  { key: "phone", label: "Primary Phone", kind: "tel", group: "contact", placeholder: "01711857205", help: "Main switchboard number on the topline and footer." },
  { key: "phone_secondary", label: "Secondary Phone", kind: "tel", group: "contact", placeholder: "05725-56351-52", help: "Optional second office number." },
  { key: "admission_phone", label: "Admission Phone", kind: "tel", group: "contact", placeholder: "01329625700", help: "Shown next to the admission information." },
  { key: "email", label: "Public Email", kind: "email", group: "contact", placeholder: "okgs2003@gmail.com", help: "Contact address on the footer and the fair passes." },
  { key: "office_hours", label: "Office Hours", kind: "text", group: "contact", placeholder: "রবি – বৃহস্পতি, সকাল ৮টা – দুপুর ২টা", full: true, help: "Displayed beside the address in the footer." },
  { key: "facebook_url", label: "Facebook URL", kind: "url", group: "contact", placeholder: "https://facebook.com/okgs", help: "Leave empty to hide the Facebook link." },
  { key: "youtube_url", label: "YouTube URL", kind: "url", group: "contact", placeholder: "https://youtube.com/@okgs", help: "Leave empty to hide the YouTube link." },
  { key: "logo_url", label: "Logo", kind: "image", group: "branding", help: "Header, footer, fair pages and every QR pass. A square PNG or SVG reads best." },
  { key: "favicon_url", label: "Favicon", kind: "image", group: "branding", help: "Browser-tab icon. A 64×64 PNG or an SVG works best; if empty the bundled icon is used." },
];

export interface SiteIdentity {
  siteName: string;
  siteTitle: string;
  shortName: string;
  tagline: string;
  address: string;
  phone: string;
  phoneSecondary: string;
  admissionPhone: string;
  email: string;
  officeHours: string;
  facebook: string;
  youtube: string;
  logo: string;
  favicon: string;
}

const fallbacks: SiteIdentity = {
  siteName: "ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি",
  siteTitle: "ওমর কিন্ডারগার্টেন স্কুল | কালাই, জয়পুরহাট",
  shortName: "ওকেজিএস",
  tagline: "কালাই, জয়পুরহাট",
  address: "কালাই সদর, জয়পুরহাট",
  phone: "01711857205",
  phoneSecondary: "05725-56351-52",
  admissionPhone: "01329625700",
  email: "okgs2003@gmail.com",
  officeHours: "রবি – বৃহস্পতি, সকাল ৮টা – দুপুর ২টা",
  facebook: "",
  youtube: "",
  logo: "",
  favicon: "",
};

/** Reads the identity block out of an already-loaded settings list. */
export function siteIdentity(settings: SiteSetting[]): SiteIdentity {
  return {
    siteName: readSetting(settings, "site_name", fallbacks.siteName),
    siteTitle: readSetting(settings, "site_title", readSetting(settings, "site_name", fallbacks.siteTitle)),
    shortName: readSetting(settings, "short_name", fallbacks.shortName),
    tagline: readSetting(settings, "tagline", fallbacks.tagline),
    address: readSetting(settings, "address", fallbacks.address),
    phone: readSetting(settings, "phone", fallbacks.phone),
    phoneSecondary: readSetting(settings, "phone_secondary", fallbacks.phoneSecondary),
    admissionPhone: readSetting(settings, "admission_phone", fallbacks.admissionPhone),
    email: readSetting(settings, "email", fallbacks.email),
    officeHours: readSetting(settings, "office_hours", fallbacks.officeHours),
    facebook: readSetting(settings, "facebook_url", fallbacks.facebook),
    youtube: readSetting(settings, "youtube_url", fallbacks.youtube),
    logo: readSetting(settings, "logo_url", fallbacks.logo),
    favicon: readSetting(settings, "favicon_url", fallbacks.favicon),
  };
}

/** The raw key → value map the settings form edits. */
export function siteSettingValues(settings: SiteSetting[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of siteSettingFields) values[field.key] = readSetting(settings, field.key, "");
  return values;
}

export async function loadSiteSettings() {
  const rows = (await listRows("settings")) as unknown as SiteSetting[];
  return { rows, values: siteSettingValues(rows), identity: siteIdentity(rows) };
}

/**
 * Writes the identity block. Unknown keys are ignored, empty values still create
 * the row so a cleared field really clears the site.
 */
export async function saveSiteIdentity(values: Record<string, unknown>) {
  const written: string[] = [];
  for (const field of siteSettingFields) {
    if (!(field.key in values)) continue;
    const value = String(values[field.key] ?? "").trim();
    await setSetting(field.key, value, {
      label: field.label,
      field_kind: field.kind === "image" ? "image" : field.kind === "textarea" ? "textarea" : field.kind === "url" ? "url" : "text",
      description: field.help,
    });
    written.push(field.key);
  }
  return written;
}

/* --------------------------- emergency shutdown --------------------------- */

export interface MaintenanceState {
  enabled: boolean;
  message: string;
  /** ISO timestamp of the last toggle — shown on the switch. */
  updatedAt: string;
  /** How many seconds a cached flag may be stale (used by the middleware). */
  ttlSeconds: number;
}

export const DEFAULT_MAINTENANCE_MESSAGE =
  "সাইটটি এখন রক্ষণাবেক্ষণের কাজ চলছে। কিছুক্ষণ পর আবার চেষ্টা করুন।";

export function maintenanceState(settings: SiteSetting[]): MaintenanceState {
  return {
    enabled: readFlag(settings, MAINTENANCE_KEY, false),
    message: readSetting(settings, MAINTENANCE_MESSAGE_KEY, ""),
    updatedAt: readSetting(settings, MAINTENANCE_UPDATED_KEY, ""),
    ttlSeconds: 5,
  };
}

export async function setMaintenanceMode(enabled: boolean, message?: string, actor = "system") {
  await setSetting(MAINTENANCE_KEY, enabled ? "1" : "0", {
    label: "Maintenance Mode",
    field_kind: "text",
    description: "SuperAdmin only. When on, every public page shows the maintenance notice.",
  });
  if (message !== undefined) {
    await setSetting(MAINTENANCE_MESSAGE_KEY, message, {
      label: "Maintenance Message",
      field_kind: "textarea",
      description: "Custom note shown on the maintenance page (empty uses the default).",
    });
  }
  await setSetting(MAINTENANCE_UPDATED_KEY, new Date().toISOString(), {
    label: "Maintenance Updated At",
    field_kind: "text",
    description: `Last toggled by ${actor}.`,
  });
  const { invalidateMaintenanceCache } = await import("@/lib/maintenance");
  invalidateMaintenanceCache();
}
