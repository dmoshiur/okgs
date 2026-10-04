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
  const radius = Number(theme.radius) || 12;
  const surface = theme.surface || (dark ? "#0b1f16" : "#ffffff");
  const ink = theme.ink || (dark ? "#e8f5ec" : "#111111");
  const accent = theme.accent || "#008744";
  const accent2 = theme.accent_2 || "#36f293";
  const away = dark ? "#ffffff" : "#000000";
  const deepBase = dark ? "#02150b" : "#00230f";

  // Soft tints used for cards, chips and hairlines.
  const line = dark ? `color-mix(in srgb, ${ink} 16%, ${surface})` : `color-mix(in srgb, ${ink} 12%, #ffffff)`;
  const muted = `color-mix(in srgb, ${ink} 62%, ${surface})`;
  const softAccent = `color-mix(in srgb, ${accent2} 12%, ${surface})`;
  const softLine = `color-mix(in srgb, ${accent2} 34%, ${surface})`;
  const softText = `color-mix(in srgb, ${accent} 72%, ${away})`;
  const altSurface = dark ? `color-mix(in srgb, ${ink} 8%, ${surface})` : "#f0f4f2";

  // The stylesheet reads semantic tokens (brand / mint / surface …), so a theme
  // switch repaints every section — public site, club pages and console alike.
  return `:root {
  --brand: ${accent};
  --brand-mid: ${accent};
  --brand-hover: color-mix(in srgb, ${accent} 82%, ${away});
  --brand-deep: color-mix(in srgb, ${accent} 22%, ${deepBase});
  --brand-dark: color-mix(in srgb, ${accent} 30%, ${deepBase});
  --brand-ink: color-mix(in srgb, ${accent} 38%, ${deepBase});
  --mint: ${accent2};
  --mint-hover: color-mix(in srgb, ${accent2} 84%, ${away});
  --mint-soft: ${softAccent};
  --mint-soft-2: ${softAccent};
  --mint-line: ${softLine};
  --mint-text: ${softText};
  --surface: ${surface};
  --surface-alt: ${altSurface};
  --surface-alt-2: ${dark ? `color-mix(in srgb, ${ink} 5%, ${surface})` : "#f5f7fa"};
  --ink: ${ink};
  --ink-2: ${ink};
  --body: ${muted};
  --muted: ${muted};
  --line: ${line};
  --line-2: ${line};
  --r: ${radius}px;
  --r-lg: ${radius + 4}px;
  --r-xl: ${radius + 8}px;
  --r-2xl: ${radius + 10}px;
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
  --green-950: ${`color-mix(in srgb, ${accent} 22%, ${deepBase})`};
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
  --gold-500: ${accent};
  --gold-600: color-mix(in srgb, ${accent} 82%, ${away});
  --gold-100: ${softAccent};
  --serif: ${pair.heading};
  --sans: ${pair.body};
  --mono: ${pair.body};
}
body[data-theme-mode="dark"] { color-scheme: dark; }
${theme.custom_css || ""}`;
}
