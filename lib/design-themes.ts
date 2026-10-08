export type VisualMode = "academic" | "science-fair";

/**
 * The chosen visual mode is remembered in a cookie, never in localStorage —
 * `app/layout.tsx` reads it while rendering so the first paint is already correct.
 */
export const VISUAL_MODE_COOKIE = "okgs-visual-mode";
/** @deprecated kept as an alias for older imports; the value is a cookie name. */
export const VISUAL_MODE_STORAGE_KEY = VISUAL_MODE_COOKIE;

export const visualThemes: Record<VisualMode, {
  label: string;
  description: string;
  tokens: Record<string, string>;
}> = {
  academic: {
    label: "একাডেমিক মোড",
    description: "উষ্ণ, সংযত একাডেমিক নকশা",
    tokens: {
      "--page-bg": "#FAF8F3", "--surface": "#FFFFFF", "--surface-alt": "#F5F1E8", "--surface-alt-2": "#F9F7F2",
      "--ink": "#111827", "--ink-2": "#202938", "--body": "#5F6368", "--muted": "#70757b",
      "--line": "#E6E0D5", "--line-2": "#eee9e0", "--brand": "#2563EB", "--brand-hover": "#1D4ED8",
      "--brand-mid": "#2563EB", "--brand-deep": "#172554", "--brand-dark": "#1e3a8a", "--brand-ink": "#1d4ed8",
      "--mint": "#F59E0B", "--mint-hover": "#D97706", "--mint-soft": "#fff7e6", "--mint-soft-2": "#fbf7ed",
      "--mint-text": "#85530a", "--mint-line": "#eadbb9", "--accent-ink": "#85530a",
      "--fair-blue": "#2563EB", "--fair-cyan": "#06B6D4", "--fair-green": "#16A34A", "--fair-emerald": "#059669",
      "--fair-amber": "#F59E0B", "--fair-orange": "#F97316", "--fair-pink": "#EC4899", "--fair-purple": "#8B5CF6", "--fair-red": "#EF4444",
      "--gradient-primary": "linear-gradient(135deg, #2563EB, #4F46E5)",
      "--gradient-secondary": "linear-gradient(135deg, #06B6D4, #8B5CF6)",
      "--shadow-xs": "0 1px 3px rgba(42, 36, 24, .045)", "--shadow-sm": "0 3px 10px rgba(42, 36, 24, .055)",
      "--shadow-md": "0 8px 24px rgba(42, 36, 24, .075)", "--shadow-lg": "0 16px 34px rgba(42, 36, 24, .12)",
      "--shadow-card": "0 22px 52px rgba(42, 36, 24, .14)",
    },
  },
  "science-fair": {
    label: "বিজ্ঞান মেলা মোড",
    description: "রঙিন বিজ্ঞান ও প্রযুক্তি উৎসবের নকশা",
    tokens: {
      "--page-bg": "#FAF8F3", "--surface": "#FFFFFF", "--surface-alt": "#F3F5FB", "--surface-alt-2": "#F7F7FC",
      "--ink": "#15152B", "--ink-2": "#292943", "--body": "#5F6172", "--muted": "#73758a",
      "--line": "#e3e5ef", "--line-2": "#ececf4", "--brand": "#4F46E5", "--brand-hover": "#4338CA",
      "--brand-mid": "#4F46E5", "--brand-deep": "#22205a", "--brand-dark": "#3730A3", "--brand-ink": "#4338CA",
      "--mint": "#06B6D4", "--mint-hover": "#0891B2", "--mint-soft": "#e8faff", "--mint-soft-2": "#f0fbff",
      "--mint-text": "#087b92", "--mint-line": "#b9eaf3", "--accent-ink": "#4F46E5",
      "--fair-blue": "#2563EB", "--fair-cyan": "#06B6D4", "--fair-green": "#16A34A", "--fair-emerald": "#059669",
      "--fair-amber": "#F59E0B", "--fair-orange": "#F97316", "--fair-pink": "#EC4899", "--fair-purple": "#8B5CF6", "--fair-red": "#EF4444",
      "--gradient-primary": "linear-gradient(135deg, #2563EB, #4F46E5, #8B5CF6)",
      "--gradient-secondary": "linear-gradient(135deg, #06B6D4, #8B5CF6, #EC4899)",
      "--shadow-xs": "0 1px 3px rgba(37, 39, 88, .05)", "--shadow-sm": "0 4px 12px rgba(37, 39, 88, .075)",
      "--shadow-md": "0 9px 26px rgba(37, 39, 88, .11)", "--shadow-lg": "0 18px 38px rgba(37, 39, 88, .15)",
      "--shadow-card": "0 24px 56px rgba(37, 39, 88, .17)",
    },
  },
};
