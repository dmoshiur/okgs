/**
 * Shared helpers for safe, accessible club brand colors.
 *
 * The maths (ramps, contrast, tuning) lives in `lib/club-palette.ts` so the
 * server and the browser agree on one definition of "this club's colours".
 * This file is the browser half: reading pixels out of an uploaded logo.
 */

import { buildClubPalette, normalizeHexColor, readableTextColor, swatchesFromRgba } from "@/lib/club-palette";

export { normalizeHexColor, readableTextColor, buildClubPalette };

export interface LogoPalette {
  /** Most prominent logo colour, tuned for UI use. */
  accent: string;
  /** A hue-distant partner for gradients, or the previous secondary. */
  accent2: string;
  /** Everything the logo contributed, most prominent first. */
  swatches: string[];
}

/**
 * Draws the logo into a small canvas and reads its palette.
 *
 * Works with a local File/Blob (used during upload) and with public image URLs
 * that allow CORS. Transparent, near-white, near-black and low-saturation
 * pixels are ignored, so paper backgrounds and dark outlines never become the
 * club's accent color.
 */
async function readLogoPixels(source: string | Blob, edge = 48): Promise<Uint8ClampedArray | null> {
  if (typeof window === "undefined") return null;

  const isBlob = typeof source !== "string";
  const objectUrl = isBlob ? URL.createObjectURL(source) : "";
  const src = isBlob ? objectUrl : String(source).trim();
  if (!src) return null;

  try {
    const image = new Image();
    if (!isBlob) image.crossOrigin = "anonymous";
    image.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("logo image could not be loaded"));
      image.src = src;
    });

    const canvas = document.createElement("canvas");
    canvas.width = edge;
    canvas.height = edge;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    // Downscale with smoothing so thin emblem strokes survive the 48×48 sample
    // instead of being dropped whole.
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, edge, edge);
    return context.getImageData(0, 0, edge, edge).data;
  } catch {
    // Canvas can be blocked by a third-party image's CORS policy; admins can
    // still pick colors manually, and the server sampler covers public pages.
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/** Full palette from a logo: primary, secondary and every colour found. */
export async function extractLogoPalette(
  source: string | Blob,
  previous: { accent?: unknown; accent2?: unknown } = {},
): Promise<LogoPalette | null> {
  const pixels = await readLogoPixels(source);
  if (!pixels) return null;
  const swatches = swatchesFromRgba(pixels, { max: 6 }).map((swatch) => swatch.hex);
  if (!swatches.length) return null;
  const palette = buildClubPalette({
    accent: previous.accent ?? swatches[0],
    accent2: previous.accent2,
    swatches,
  });
  return { accent: palette.accent, accent2: palette.accent2, swatches };
}

/**
 * Kept for back-compat: the single most prominent saturated colour of a logo.
 */
export async function extractDominantLogoColor(source: string | Blob): Promise<string | null> {
  const palette = await extractLogoPalette(source);
  return palette?.accent ?? null;
}
