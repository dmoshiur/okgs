/** Shared helpers for safe, accessible club brand colors. */

export function normalizeHexColor(value: unknown, fallback = "#2563eb") {
  const color = String(value ?? "").trim();
  if (/^#[\da-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(color)) {
    return `#${color.slice(1).split("").map((channel) => channel + channel).join("").toLowerCase()}`;
  }
  return fallback;
}

export function readableTextColor(background: unknown) {
  const hex = normalizeHexColor(background).slice(1);
  const channels = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  const darkContrast = (luminance + 0.05) / (0.016 + 0.05);
  const lightContrast = 1.05 / (luminance + 0.05);
  return darkContrast >= lightContrast ? "#142033" : "#ffffff";
}

/**
 * Uses a small canvas to find a logo's most prominent saturated color. It works
 * with a local File/Blob (used during upload) and public image URLs with CORS.
 * Transparent, near-white, near-black and low-saturation pixels are ignored so
 * paper backgrounds and dark outlines do not become the club's accent color.
 */
export async function extractDominantLogoColor(source: string | Blob): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const isBlob = typeof source !== "string";
  const objectUrl = isBlob ? URL.createObjectURL(source) : "";
  const src = isBlob ? objectUrl : source.trim();
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
    const size = 40;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, size, size);

    const pixels = context.getImageData(0, 0, size, size).data;
    const buckets = new Map<string, { count: number; score: number; red: number; green: number; blue: number }>();

    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3] / 255;
      if (alpha < 0.55) continue;

      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const max = Math.max(red, green, blue) / 255;
      const min = Math.min(red, green, blue) / 255;
      const saturation = max === 0 ? 0 : (max - min) / max;
      const lightness = (max + min) / 2;
      if (saturation < 0.2 || lightness < 0.13 || lightness > 0.9) continue;

      const key = `${red >> 4}:${green >> 4}:${blue >> 4}`;
      const bucket = buckets.get(key) ?? { count: 0, score: 0, red: 0, green: 0, blue: 0 };
      bucket.count += 1;
      // Give vivid colors a slight preference without letting tiny details win.
      bucket.score += alpha * (0.7 + saturation * 0.55);
      bucket.red += red;
      bucket.green += green;
      bucket.blue += blue;
      buckets.set(key, bucket);
    }

    const dominant = [...buckets.values()].sort((a, b) => b.score - a.score)[0];
    if (!dominant) return null;

    const channels = [dominant.red, dominant.green, dominant.blue].map((channel) =>
      Math.round(channel / dominant.count).toString(16).padStart(2, "0"),
    );
    return `#${channels.join("")}`;
  } catch {
    // Canvas can be blocked by a third-party image's CORS policy; admins can
    // still choose a color manually in that case.
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
