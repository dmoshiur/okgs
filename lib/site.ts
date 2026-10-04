/**
 * Site-level helpers: setting lookup/writes, the science-fair mode switch and
 * the theme (template CSS) engine.
 */
import { listRows, updateRow } from "@/lib/db";
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

const fontPairs: Record<string, { heading: string; body: string; import?: string }> = {
  "hind-noto": {
    heading: '"Noto Serif Bengali", "Hind Siliguri", serif',
    body: '"Hind Siliguri", system-ui, sans-serif',
  },
  hind: { heading: '"Hind Siliguri", system-ui, sans-serif', body: '"Hind Siliguri", system-ui, sans-serif' },
  noto: { heading: '"Noto Serif Bengali", serif', body: '"Noto Serif Bengali", serif' },
  baloo: {
    heading: '"Baloo Da 2", "Hind Siliguri", cursive',
    body: '"Hind Siliguri", system-ui, sans-serif',
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
  const pair = fontPairs[theme.font_pair] ?? fontPairs["hind-noto"];
  const dark = theme.mode === "dark";
  const radius = Number(theme.radius) || 18;
  const surface = theme.surface || (dark ? "#0b1020" : "#ffffff");
  const ink = theme.ink || (dark ? "#e2e8ff" : "#0f172a");
  const accent = theme.accent || "#7c3aed";
  const accent2 = theme.accent_2 || "#06b6d4";

  // A soft tint of the accent for surfaces — mix with white (light) or the surface (dark).
  const tint = dark ? `color-mix(in srgb, ${accent} 18%, ${surface})` : `color-mix(in srgb, ${accent} 10%, #ffffff)`;
  const line = dark ? `color-mix(in srgb, ${ink} 16%, ${surface})` : `color-mix(in srgb, ${ink} 12%, #ffffff)`;
  const muted = dark ? `color-mix(in srgb, ${ink} 62%, ${surface})` : `color-mix(in srgb, ${ink} 62%, #ffffff)`;

  // The legacy design reads --green-*/--gold/--paper/--ink, so aliasing them here
  // means a theme switch instantly repaints every existing section too.
  return `:root {
  --okgs-accent: ${accent};
  --okgs-accent-2: ${accent2};
  --okgs-surface: ${surface};
  --okgs-surface-2: ${tint};
  --okgs-ink: ${ink};
  --okgs-muted: ${muted};
  --okgs-line: ${line};
  --okgs-radius: ${radius}px;
  --okgs-heading: ${pair.heading};
  --okgs-body: ${pair.body};
  --okgs-mode: ${theme.mode};
}
body[data-theme-mode="dark"] { color-scheme: dark; }
  --green-950: color-mix(in srgb, ${accent} 78%, ${dark ? "#000000" : "#0b1f16"});
  --green-900: ${accent};
  --green-800: ${accent};
  --green-700: color-mix(in srgb, ${accent} 88%, ${dark ? "#ffffff" : "#000000"});
  --green-50: ${tint};
  --ink-deep: ${ink};
  --ink: ${ink};
  --ink-soft: ${muted};
  --muted: ${muted};
  --paper: ${surface};
  --paper-alt: ${tint};
  --line: ${line};
  --gold: ${accent2};
  --gold-500: ${accent2};
  --gold-600: color-mix(in srgb, ${accent2} 82%, #000000);
  --gold-100: color-mix(in srgb, ${accent2} 16%, ${surface});
  --gold-soft: color-mix(in srgb, ${accent2} 30%, ${surface});
  --serif: ${pair.heading};
  --sans: ${pair.body};
  --mono: ${pair.body};
}
${theme.custom_css || ""}`;
}
