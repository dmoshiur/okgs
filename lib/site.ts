/**
 * Site-level helpers: setting lookup/writes, the science-fair mode switch and
 * the theme (template CSS) engine.
 */
import { db, listRows, updateRow } from "@/lib/db";
import type { Fair, PublicContent, SiteSetting, SiteTheme } from "@/lib/types";

export function findSetting(settings: SiteSetting[], key: string) {
  return settings.find((setting) => setting.key === key) ?? null;
}

export function readSetting(settings: SiteSetting[], key: string, fallback = "") {
  const value = findSetting(settings, key)?.value;
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

export function readFlag(settings: SiteSetting[], key: string, fallback = false) {
  const raw = findSetting(settings, key)?.value;
  if (raw === undefined || raw === null || raw === "") return fallback;
  return !["0", "false", "off", "no", "না"].includes(String(raw).toLowerCase());
}

/** Writes (or creates) a settings row by key. */
export async function setSetting(key: string, value: string, meta: { label?: string; field_kind?: string; description?: string } = {}) {
  const rows = (await listRows("settings")) as unknown as SiteSetting[];
  const existing = rows.find((row) => row.key === key);
  if (existing) {
    await updateRow("settings", existing.id, { value });
    return existing.id;
  }
  const { insertRow } = await import("@/lib/db");
  const created = await insertRow("settings", {
    key,
    label: meta.label ?? key,
    field_kind: meta.field_kind ?? "text",
    value,
    description: meta.description ?? "",
    image_url: "",
  });
  return String((created as { id?: string }).id ?? "");
}

/* ------------------------------- fair mode ------------------------------- */

export interface FairMode {
  mode: "school" | "fair";
  slug: string;
  enabled: boolean;
}

export function fairMode(settings: SiteSetting[]): FairMode {
  const mode = readSetting(settings, "fair_mode", "school").toLowerCase() === "fair" ? "fair" : "school";
  return { mode, slug: readSetting(settings, "fair_mode_slug", ""), enabled: mode === "fair" };
}

export function activeFair(content: PublicContent, slug?: string): Fair | null {
  const fairs = [...(content.fairs ?? [])].filter((fair) => fair.is_active !== false);
  if (!fairs.length) return null;
  if (slug) {
    const match = fairs.find((fair) => fair.slug === slug);
    if (match) return match;
  }
  const configured = fairMode(content.settings).slug;
  const byConfig = configured ? fairs.find((fair) => fair.slug === configured) : undefined;
  const featured = fairs.find((fair) => fair.is_featured);
  return byConfig ?? featured ?? fairs[0];
}

/** Child rows that point at a fair by slug. */
export const fairChildResources = ["fair_categories", "fair_schedule", "fair_collections"] as const;

/**
 * Keeps the site's “which fair is live” switch pointing at a renamed fair.
 *
 * `/fair` and the homepage resolve the active fair through the `fair_mode_slug`
 * setting. Renaming a fair's slug without moving that setting silently sends
 * `/fair` to a different fair (or to the homepage), so the two stay in lockstep.
 */
export async function syncFairModeSlug(from: string, to: string) {
  if (!from || !to || from === to) return;
  const rows = (await listRows("settings")) as unknown as SiteSetting[];
  const existing = rows.find((row) => row.key === "fair_mode_slug");
  if (!existing) return;
  if (String(existing.value ?? "").trim() !== from) return;
  await updateRow("settings", existing.id, { value: to });
}

/**
 * Re-points every fair-scoped row when a fair slug is renamed, so categories,
 * the programme and the project archive keep belonging to the same fair.
 */
export async function renameFairSlug(from: string, to: string) {
  if (!from || from === to) return;
  await Promise.all(
    fairChildResources.map((resource) =>
      db.execute({ sql: `UPDATE "${resource}" SET "fair_slug" = ? WHERE "fair_slug" = ?`, args: [to, from] }),
    ),
  );
  await syncFairModeSlug(from, to);
}

/**
 * Moves a club's saved micro-site override onto its new slug.
 *
 * Club-site edits live in the `settings` table under `club_site:<slug>`. Without
 * this a renamed club would silently lose every edit its club admin ever made
 * and fall back to the checked-in `club.json` defaults.
 */
export async function renameClubSiteOverride(from: string, to: string) {
  if (!from || from === to) return;
  const rows = (await listRows("settings")) as unknown as SiteSetting[];
  const existing = rows.find((row) => row.key === `club_site:${from}`);
  if (!existing) return;
  await updateRow("settings", existing.id, {
    key: `club_site:${to}`,
    label: `${to} ক্লাব সাইট`,
  });
}

/** Everything the public fair page needs, sliced by fair slug. */
export function fairContent(content: PublicContent, fair: Fair) {
  const belongs = (row: { fair_slug: string }) => !row.fair_slug || row.fair_slug === fair.slug;
  return {
    fair,
    categories: (content.fair_categories ?? []).filter(belongs),
    schedule: [...(content.fair_schedule ?? []).filter(belongs)].sort((a, b) =>
      String(a.starts_at || a.sort_order).localeCompare(String(b.starts_at || b.sort_order)),
    ),
    collections: [...(content.fair_collections ?? []).filter(belongs)].sort(
      (a, b) => a.sort_order - b.sort_order || Number(b.is_featured) - Number(a.is_featured),
    ),
  };
}

/* -------------------------------- themes -------------------------------- */

export function activeTheme(content: PublicContent): SiteTheme | null {
  const themes = (content.themes ?? []).filter((theme) => theme.is_active !== false);
  if (!themes.length) return null;
  return themes.find((theme) => theme.is_default) ?? null;
}

/**
 * Theme font pairs resolve through the next/font CSS variables set in app/layout.tsx
 * (var(--font-*, "Fallback Name")). If a font isn't self-hosted, the raw family name
 * still works for pairs that ship their own remote `import` (e.g. Baloo Da 2).
 */
const fontPairs: Record<string, { heading: string; body: string; import?: string }> = {
  "poppins-inter": {
    heading: 'var(--font-poppins, "Poppins"), var(--font-hind-siliguri, "Hind Siliguri"), system-ui, sans-serif',
    body: 'var(--font-inter, "Inter"), var(--font-hind-siliguri, "Hind Siliguri"), system-ui, sans-serif',
  },
  "hind-noto": {
    heading: 'var(--font-noto-serif-bengali, "Noto Serif Bengali"), var(--font-hind-siliguri, "Hind Siliguri"), serif',
    body: 'var(--font-hind-siliguri, "Hind Siliguri"), system-ui, sans-serif',
  },
  hind: {
    heading: 'var(--font-hind-siliguri, "Hind Siliguri"), system-ui, sans-serif',
    body: 'var(--font-hind-siliguri, "Hind Siliguri"), system-ui, sans-serif',
  },
  noto: {
    heading: 'var(--font-noto-serif-bengali, "Noto Serif Bengali"), serif',
    body: 'var(--font-noto-serif-bengali, "Noto Serif Bengali"), serif',
  },
  baloo: {
    heading: '"Baloo Da 2", var(--font-hind-siliguri, "Hind Siliguri"), cursive',
    body: 'var(--font-hind-siliguri, "Hind Siliguri"), system-ui, sans-serif',
    import: "https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@500;600;700&display=swap",
  },
};

/**
 * Turns a theme row into the CSS the whole site is painted with.
 *
 * The variables land on :root and the theme's own `custom_css` is appended, so an
 * admin can either pick a preset or paste a template of their own.
 */
export function themeCss(theme: SiteTheme | null) {
  if (!theme) return "";
  const pair = fontPairs[theme.font_pair] ?? fontPairs["poppins-inter"] ?? fontPairs["hind-noto"];
  const dark = theme.mode === "dark";
  const radius = Number(theme.radius) || 12;
  const surface = theme.surface || (dark ? "#0a1120" : "#ffffff");
  const ink = theme.ink || (dark ? "#f8fafc" : "#0f172a");
  const accent = theme.accent || "#0f1e36";
  const accent2 = theme.accent_2 || "#f59e0b";
  const away = dark ? "#ffffff" : "#000000";
  const deepBase = dark ? "#050b14" : "#0a1120";

  // Soft tints used for cards, chips and hairlines.
  const line = dark ? `color-mix(in srgb, ${ink} 16%, ${surface})` : `color-mix(in srgb, ${ink} 12%, #ffffff)`;
  const muted = `color-mix(in srgb, ${ink} 62%, ${surface})`;
  const softAccent = `color-mix(in srgb, ${accent2} 14%, ${surface})`;
  const softLine = `color-mix(in srgb, ${accent2} 36%, ${surface})`;
  const softText = dark ? `color-mix(in srgb, ${accent2} 90%, #ffffff)` : `color-mix(in srgb, ${accent2} 80%, #000000)`;
  const altSurface = dark ? `color-mix(in srgb, ${ink} 8%, ${surface})` : "#f8fafc";

  // The stylesheet reads semantic tokens (brand / mint / surface …), so a theme
  // switch repaints every section — public site, club pages and console alike.
  // An @import (when the pair needs one) must come first in the generated sheet.
  return `${pair.import ? `@import url("${pair.import}");\n` : ""}:root {
  --brand: ${accent};
  --brand-mid: color-mix(in srgb, ${accent} 80%, #1e3566);
  --brand-hover: color-mix(in srgb, ${accent} 82%, ${away});
  --brand-deep: color-mix(in srgb, ${accent} 40%, ${deepBase});
  --brand-dark: color-mix(in srgb, ${accent} 60%, ${deepBase});
  --brand-ink: color-mix(in srgb, ${accent} 50%, #1e3566);
  --mint: ${accent2};
  --mint-hover: color-mix(in srgb, ${accent2} 84%, ${away});
  --mint-soft: ${softAccent};
  --mint-soft-2: ${softAccent};
  --mint-line: ${softLine};
  --mint-text: ${softText};
  --surface: ${surface};
  --surface-alt: ${altSurface};
  --surface-alt-2: ${dark ? `color-mix(in srgb, ${ink} 5%, ${surface})` : "#f1f5f9"};
  --ink: ${ink};
  --ink-2: ${ink};
  --body: ${muted};
  --muted: ${muted};
  --line: ${line};
  --line-2: ${line};
  --r: ${radius}px;
  --r-lg: ${radius + 4}px;
  --r-xl: ${radius + 8}px;
  --r-2xl: ${radius + 12}px;
  --okgs-accent: ${accent};
  --okgs-accent-2: ${accent2};
  --okgs-surface: ${surface};
  --okgs-surface-2: ${altSurface};
  --okgs-ink: ${ink};
  --okgs-muted: ${muted};
  --okgs-line: ${line};
  --okgs-radius: ${radius}px;
  --okgs-heading: ${pair.heading};
  --okgs-body: ${pair.body};
  --okgs-mode: ${theme.mode};
  --green-950: ${`color-mix(in srgb, ${accent} 35%, ${deepBase})`};
  --green-900: ${accent};
  --green-800: ${accent};
  --green-700: color-mix(in srgb, ${accent} 88%, ${away});
  --green-50: ${softAccent};
  --green-100: ${softLine};
  --ink-deep: ${ink};
  --ink-soft: ${muted};
  --paper: ${surface};
  --paper-alt: ${altSurface};
  --gold: ${accent2};
  --gold-soft: ${softLine};
  --gold-500: ${accent2};
  --gold-600: color-mix(in srgb, ${accent2} 82%, ${away});
  --gold-100: ${softAccent};
  --serif: ${pair.heading};
  --sans: ${pair.body};
  --mono: ${pair.body};
}
body[data-theme-mode="dark"] { color-scheme: dark; }
${theme.custom_css || ""}`;
}
