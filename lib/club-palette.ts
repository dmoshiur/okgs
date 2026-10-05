/**
 * Logo-derived brand palettes for the club micro-sites.
 *
 * Pure colour maths — no DOM, no Node APIs — so one implementation powers the
 * server-rendered club site, the club admin preview, and the canvas sampling
 * that runs in the browser the moment a logo is dropped on the uploader.
 *
 * The thinking: a club logo already carries the club's identity, so instead of
 * asking an admin to guess a "nice blue", we read the logo's own vivid colours,
 * tune them into a UI-safe ramp (never muddy, never unreadable) and publish the
 * whole set as CSS custom properties. `app/globals.css` paints the micro-site
 * with those properties, so a logo upload re-skins the site end to end —
 * hero, sub-nav, cards, timeline, tables, footer.
 */

/* ------------------------------------------------------------------ basics -- */

const HEX6 = /^#[\da-f]{6}$/i;
const HEX3 = /^#[\da-f]{3}$/i;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Accepts `#abc`, `#aabbcc`, or a bare hex, and always returns lowercase `#aabbcc`. */
export function normalizeHexColor(value: unknown, fallback = "#2563eb") {
  const color = String(value ?? "").trim();
  if (HEX6.test(color)) return color.toLowerCase();
  if (HEX3.test(color)) {
    return `#${color
      .slice(1)
      .split("")
      .map((channel) => channel + channel)
      .join("")
      .toLowerCase()}`;
  }
  if (/^[\da-f]{6}$/i.test(color)) return `#${color.toLowerCase()}`;
  return fallback;
}

export type Rgb = [number, number, number];

export function hexToRgb(hex: unknown): Rgb {
  const value = normalizeHexColor(hex).slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

export function rgbToHex(red: number, green: number, blue: number) {
  const channel = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

export interface Hsl {
  /** 0–360 */
  h: number;
  /** 0–1 */
  s: number;
  /** 0–1 */
  l: number;
}

export function rgbToHsl(red: number, green: number, blue: number): Hsl {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) return { h: 0, s: 0, l: lightness };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  return { h: (hue * 60 + 360) % 360, s: clamp(saturation, 0, 1), l: clamp(lightness, 0, 1) };
}

export function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 1);
  const l = clamp(lightness, 0, 1);
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const sector = h / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const [r1, g1, b1] =
    sector < 1
      ? [chroma, second, 0]
      : sector < 2
        ? [second, chroma, 0]
        : sector < 3
          ? [0, chroma, second]
          : sector < 4
            ? [0, second, chroma]
            : sector < 5
              ? [second, 0, chroma]
              : [chroma, 0, second];
  const match = l - chroma / 2;
  return [Math.round((r1 + match) * 255), Math.round((g1 + match) * 255), Math.round((b1 + match) * 255)];
}

export function hexToHsl(hex: unknown): Hsl {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

export function hslToHex(hue: number, saturation: number, lightness: number) {
  const [r, g, b] = hslToRgb(hue, saturation, lightness);
  return rgbToHex(r, g, b);
}

/** Perceptual-ish sRGB mix. `amount` 0 keeps `from`, 1 lands on `to`. */
export function mixHex(from: unknown, to: unknown, amount: number) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const t = clamp(amount, 0, 1);
  return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

export function withAlpha(hex: unknown, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

export function relativeLuminance(hex: unknown) {
  const channels = hexToRgb(hex).map((channel) => channel / 255);
  const linear = channels.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(a: unknown, b: unknown) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Black or white — whichever passes WCAG better on the given background. */
export function readableTextColor(background: unknown) {
  const luminance = relativeLuminance(background);
  const darkContrast = (luminance + 0.05) / 0.066;
  const lightContrast = 1.05 / (luminance + 0.05);
  return darkContrast >= lightContrast ? "#142033" : "#ffffff";
}

export function hueDistance(a: number, b: number) {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/* ------------------------------------------------------- pixel → swatches -- */

export interface Swatch extends Hsl {
  hex: string;
  /** How much of the image this colour claims, weighted for vividness. */
  score: number;
  share: number;
}

export interface QuantizeOptions {
  /** Largest number of swatches to return. */
  max?: number;
  /** Reject anything less saturated than this (0–1). */
  minSaturation?: number;
  /** Ignore near-white and near-black pixels (paper, outlines, drop shadows). */
  minLightness?: number;
  maxLightness?: number;
  /** Smallest hue gap, in degrees, between two returned swatches. */
  minHueGap?: number;
}

/**
 * Turns a RGBA byte buffer into a handful of representative brand colours.
 *
 * Pixels are bucketed by hue/lightness rather than averaged, because a logo is
 * usually 3–4 flat colours and an average of those is mud. Alpha-transparent
 * pixels, paper whites, ink blacks and greys are dropped so a white background
 * never becomes the club's accent.
 */
export function swatchesFromRgba(pixels: Uint8Array | Uint8ClampedArray, options: QuantizeOptions = {}): Swatch[] {
  const {
    max = 6,
    minSaturation = 0.16,
    minLightness = 0.12,
    maxLightness = 0.94,
    minHueGap = 18,
  } = options;

  interface Bucket {
    count: number;
    score: number;
    red: number;
    green: number;
    blue: number;
  }
  const buckets = new Map<string, Bucket>();
  let considered = 0;

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    if (alpha < 0.5) continue;
    considered += 1;

    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const { h, s, l } = rgbToHsl(red, green, blue);
    if (s < minSaturation || l < minLightness || l > maxLightness) continue;

    const key = `${Math.floor(h / 12)}:${l < 0.34 ? 0 : l < 0.68 ? 1 : 2}:${s < 0.45 ? 0 : 1}`;
    const bucket = buckets.get(key) ?? { count: 0, score: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    // Coverage matters (a speck should not win) but vividness matters more,
    // and mid-lightness colours read best as a UI accent.
    bucket.score += alpha * (0.55 + s * 0.85) * (1 - Math.abs(l - 0.48) * 0.75);
    buckets.set(key, bucket);
  }

  if (!buckets.size || !considered) return [];

  const ranked = [...buckets.entries()]
    .map(([, bucket]) => {
      const red = bucket.red / bucket.count;
      const green = bucket.green / bucket.count;
      const blue = bucket.blue / bucket.count;
      const { h, s, l } = rgbToHsl(red, green, blue);
      return {
        hex: rgbToHex(red, green, blue),
        h,
        s,
        l,
        score: bucket.count ** 0.72 * bucket.score,
        share: bucket.count / considered,
      } satisfies Swatch;
    })
    .sort((a, b) => b.score - a.score);

  const picked: Swatch[] = [];
  for (const swatch of ranked) {
    if (picked.length >= max) break;
    const clash = picked.some((other) => hueDistance(other.h, swatch.h) < minHueGap && Math.abs(other.l - swatch.l) < 0.22);
    if (clash) continue;
    picked.push(swatch);
  }
  // A one-colour logo still deserves a two-stop gradient: fall back to the
  // neighbouring shades of the same hue rather than an unrelated colour.
  if (picked.length === 1) {
    const [only] = picked;
    picked.push({ ...only, hex: hslToHex(only.h + 26, clamp(only.s * 0.9, 0.3, 1), clamp(only.l + 0.2, 0.4, 0.78)), score: only.score * 0.4, share: only.share });
  }
  return picked;
}

/* ----------------------------------------------------------------- palette -- */

export type PaletteSource = "logo" | "studio" | "default";

export interface ClubPaletteInput {
  /** Admin/preset primary colour. */
  accent?: unknown;
  /** Admin/preset secondary colour. */
  accent2?: unknown;
  /** Colours sampled from the club logo, most prominent first. */
  swatches?: readonly (string | Swatch)[] | null;
}

export interface ClubPalette {
  accent: string;
  accent2: string;
  /** Lighter twin, used on dark surfaces. */
  accentBright: string;
  accent2Bright: string;
  /** Text colour that stays readable on top of `accent`. */
  onAccent: string;
  onAccentBright: string;
  deep: string;
  ramp: Record<string, string>;
  source: PaletteSource;
  /** Every colour the logo contributed, for the admin preview and debugging. */
  swatches: string[];
  /** CSS custom properties for the club-site root element. */
  vars: Record<string, string>;
}

/**
 * A raw logo pixel is rarely a good UI accent: logos ship dark navy and pale
 * pastel. Nudge toward a saturation/lightness window where buttons, chips and
 * 3px rails still look deliberate on both paper and ink surfaces.
 */
export function tuneForUi(hex: unknown) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, clamp(s, 0.4, 0.86), clamp(l, 0.36, 0.56));
}

const RAMP: Array<[string, number, number]> = [
  ["50", 0.965, 0.55],
  ["100", 0.92, 0.6],
  ["200", 0.84, 0.68],
  ["300", 0.73, 0.74],
  ["400", 0.61, 0.78],
  ["500", 0.5, 0.82],
  ["600", 0.42, 0.8],
  ["700", 0.33, 0.74],
  ["800", 0.24, 0.66],
  ["900", 0.15, 0.58],
];

function toSwatch(value: string | Swatch): Swatch | null {
  if (typeof value === "string") {
    const hex = normalizeHexColor(value, "");
    if (!hex) return null;
    const { h, s, l } = hexToHsl(hex);
    return { hex, h, s, l, score: 1, share: 0 };
  }
  return value;
}

/** Builds the full brand system from a logo sample, falling back to the stored accents. */
export function buildClubPalette(input: ClubPaletteInput = {}): ClubPalette {
  const fallbackAccent = normalizeHexColor(input.accent, "#2563eb");
  const fallbackAccent2 = normalizeHexColor(input.accent2, "");
  const samples = (input.swatches ?? []).map(toSwatch).filter(Boolean) as Swatch[];

  let source: PaletteSource = fallbackAccent2 ? "studio" : "default";
  let primary = fallbackAccent;
  let secondary = fallbackAccent2;

  if (samples.length) {
    source = "logo";
    primary = samples[0].hex;
    // The best gradient partner is a colour that is clearly a *different* hue,
    // or — failing that — the admin's own secondary.
    const primaryHue = hexToHsl(primary).h;
    const partner = samples
      .slice(1)
      .map((swatch) => ({ swatch, gap: hueDistance(swatch.h, primaryHue) }))
      .filter((row) => row.gap >= 30)
      .sort((a, b) => b.gap * b.swatch.score - a.gap * a.swatch.score)[0];
    secondary = partner?.swatch.hex || fallbackAccent2;
  }

  primary = tuneForUi(primary);
  const primaryHsl = hexToHsl(primary);

  // Logos often ship one colour only. A near-complement gives the gradient
  // depth without inventing a palette the club does not own.
  if (!secondary || hueDistance(hexToHsl(secondary).h, primaryHsl.h) < 24) {
    secondary = hslToHex(primaryHsl.h + (primaryHsl.s > 0.62 ? 168 : 190), clamp(primaryHsl.s * 0.82, 0.42, 0.78), clamp(primaryHsl.l + 0.06, 0.42, 0.6));
  } else {
    secondary = tuneForUi(secondary);
  }

  const deep = hslToHex(primaryHsl.h, clamp(primaryHsl.s * 0.92, 0.34, 0.72), 0.11);
  const ramp: Record<string, string> = {};
  for (const [step, lightness, saturation] of RAMP) {
    ramp[step] = hslToHex(primaryHsl.h, clamp(primaryHsl.s * saturation, 0.18, 0.95), lightness);
  }

  const accentBright = mixHex(primary, "#ffffff", 0.2);
  const accent2Bright = mixHex(secondary, "#ffffff", 0.16);
  const [ar, ag, ab] = hexToRgb(primary);
  const [br, bg, bb] = hexToRgb(secondary);
  const [dr, dg, db] = hexToRgb(deep);

  // Names ending in `-base`/`-bright` are published raw; `--club-accent`,
  // `--club-accent-2`, `--club-accent-ink` and the rgb triplets are *mapped*
  // in globals.css so the same tokens resolve to the brighter pair on a dark
  // surface. Declaring them in a stylesheet (instead of inline here) is what
  // lets the color-scheme override win — an inline `--club-accent` could never
  // be re-pointed by `html[data-color-scheme="dark"]`.
  const vars: Record<string, string> = {
    "--club-accent-base": primary,
    "--club-accent-2-base": secondary,
    "--club-accent-bright": accentBright,
    "--club-accent-2-bright": accent2Bright,
    "--club-accent-rgb-base": `${ar}, ${ag}, ${ab}`,
    "--club-accent-2-rgb-base": `${br}, ${bg}, ${bb}`,
    "--club-accent-rgb-bright": hexToRgb(accentBright).join(", "),
    "--club-accent-2-rgb-bright": hexToRgb(accent2Bright).join(", "),
    "--club-brand-deep-rgb": `${dr}, ${dg}, ${db}`,
    "--club-accent-ink-light": readableTextColor(primary),
    "--club-accent-ink-bright": readableTextColor(accentBright),
    // Derived tokens the micro-site rules consume. Written against
    // var(--club-accent) rather than a literal hex so they follow the mapping.
    "--club-accent-text": "color-mix(in srgb, var(--club-accent) 56%, var(--ink))",
    "--club-accent-2-text": "color-mix(in srgb, var(--club-accent-2) 56%, var(--ink))",
    "--club-accent-wash": "color-mix(in srgb, var(--club-accent) 12%, var(--surface))",
    "--club-accent-wash-2": "color-mix(in srgb, var(--club-accent-2) 12%, var(--surface))",
    "--club-accent-line": "color-mix(in srgb, var(--club-accent) 26%, var(--line))",
    "--club-accent-line-2": "color-mix(in srgb, var(--club-accent-2) 26%, var(--line))",
    "--club-brand-deep": deep,
    ...Object.fromEntries(Object.entries(ramp).map(([step, hex]) => [`--club-brand-${step}`, hex])),
    "--club-grad-rail": "linear-gradient(90deg, var(--club-accent), var(--club-accent-2))",
    "--club-grad-btn": "linear-gradient(135deg, var(--club-accent), color-mix(in srgb, var(--club-accent) 42%, var(--club-accent-2)))",
    "--club-grad-chip": "linear-gradient(135deg, rgba(var(--club-accent-rgb), .16), rgba(var(--club-accent-2-rgb), .15))",
    "--club-grad-ring": "conic-gradient(from 140deg, var(--club-accent), var(--club-accent-2), rgba(var(--club-brand-deep-rgb), .9), var(--club-accent))",
    "--club-grad-hero":
      "linear-gradient(135deg, color-mix(in srgb, var(--club-accent) 13%, var(--surface)) 0%, color-mix(in srgb, var(--club-accent) 4%, var(--surface)) 44%, color-mix(in srgb, var(--club-accent-2) 15%, var(--surface)) 100%))",
    "--club-grad-sheen":
      "linear-gradient(165deg, rgba(var(--club-accent-rgb), .07), rgba(var(--club-accent-rgb), 0) 46%, rgba(var(--club-accent-2-rgb), .09))",
    "--club-grad-foot":
      "linear-gradient(120deg, color-mix(in srgb, var(--club-accent) 9%, var(--surface)) 0%, var(--surface) 46%, color-mix(in srgb, var(--club-accent-2) 11%, var(--surface)) 100%))",
    "--club-mesh":
      "radial-gradient(62% 100% at 92% -12%, rgba(var(--club-accent-2-rgb), .3), transparent 62%), radial-gradient(68% 110% at 2% 108%, rgba(var(--club-accent-rgb), .24), transparent 60%)",
    "--club-glow": "0 26px 52px -28px rgba(var(--club-accent-rgb), .55)",
    "--club-glow-soft": "0 14px 30px -20px rgba(var(--club-accent-rgb), .5)",
    "--club-ring": "0 0 0 1px rgba(var(--club-accent-rgb), .22), 0 10px 30px -14px rgba(var(--club-accent-rgb), .34)",
    "--club-hero-scrim":
      "linear-gradient(180deg, rgba(var(--club-brand-deep-rgb), .74) 0%, rgba(var(--club-brand-deep-rgb), .58) 46%, rgba(var(--club-accent-rgb), .46) 100%)",
  };

  return {
    accent: primary,
    accent2: secondary,
    accentBright,
    accent2Bright,
    onAccent: readableTextColor(primary),
    onAccentBright: readableTextColor(accentBright),
    deep,
    ramp,
    source,
    swatches: samples.map((swatch) => swatch.hex),
    vars,
  };
}
