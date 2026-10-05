/**
 * Server-side logo colour sampling for club micro-sites.
 *
 * The admin panel samples the logo in a canvas at upload time and stores the
 * result, but that only covers *new* uploads and browsers that allow it. This
 * module does the same job on the server for every logo URL, so a club that
 * uploaded its logo years ago still gets a palette without anyone touching the
 * studio again.
 *
 * Decoding is intentionally narrow: PNG (deflate + unfilter, via `node:zlib`)
 * and SVG (fill/stop colours pulled out of the markup). Cloudinary can hand us
 * PNG for anything it stores, so JPEG/WebP/AVIF logos are re-requested as PNG
 * rather than pulling a decoder dependency into the app. Everything is wrapped
 * in try/catch with a short timeout — a slow or blocked image must never delay
 * a public page, the caller just falls back to the stored accent.
 */

import { inflateSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isCloudinaryUrl } from "@/lib/cloudinary";
import { normalizeHexColor, swatchesFromRgba } from "@/lib/club-palette";

/** \x89 P N G \r \n \x1a \n — the order is fixed by the spec, and it bit me once. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_BYTES = 8 * 1024 * 1024;
const SAMPLE_EDGE = 72;
const TTL_MS = 12 * 60 * 60 * 1000;
const EMPTY_TTL_MS = 5 * 60 * 1000;
/** Total wall-clock budget for one logo, so a dead host cannot stall a page. */
const FETCH_BUDGET_MS = 2600;
const CACHE_LIMIT = 240;

interface CacheEntry {
  at: number;
  value: string[];
  /** Empty results expire fast — a flaky host should not be remembered forever. */
  ttl: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __okgsLogoSwatchCache: Map<string, CacheEntry> | undefined;
}

function cache() {
  if (!globalThis.__okgsLogoSwatchCache) globalThis.__okgsLogoSwatchCache = new Map<string, CacheEntry>();
  return globalThis.__okgsLogoSwatchCache;
}

function remember(url: string, value: string[]) {
  const store = cache();
  if (store.size >= CACHE_LIMIT) {
    const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) store.delete(oldest[0]);
  }
  store.set(url, { at: Date.now(), value, ttl: value.length ? TTL_MS : EMPTY_TTL_MS });
  return value;
}

/**
 * Dominant colours of a club logo, most prominent first.
 * Returns `[]` for missing, external-but-undecodable, or failing images.
 */
export async function logoSwatches(value: unknown, options: { max?: number; signal?: AbortSignal } = {}): Promise<string[]> {
  const url = String(value ?? "").trim();
  if (!/^(https?:)?\/\//i.test(url) && !url.startsWith("/")) return [];
  const max = options.max ?? 6;
  const key = `${url}::${max}`;

  const hit = cache().get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;

  try {
    const pixels = await readLogoPixels(url, options.signal, Date.now() + FETCH_BUDGET_MS);
    if (!pixels) return remember(key, []);
    const swatches = swatchesFromRgba(pixels, { max });
    return remember(
      key,
      swatches.map((swatch) => swatch.hex),
    );
  } catch {
    // Negative-cache too: a broken image link should not be retried on every hit.
    return remember(key, []);
  }
}

/* -------------------------------------------------------------- fetching --- */

async function readLogoPixels(url: string, signal: AbortSignal | undefined, deadline: number): Promise<Uint8Array | null> {
  // Same-origin assets shipped in /public never need a network round trip.
  if (url.startsWith("/")) {
    const file = path.join(process.cwd(), "public", decodeURIComponent(url.split("?")[0].split("#")[0]));
    if (!file.startsWith(path.join(process.cwd(), "public"))) return null;
    try {
      const buffer = await readFile(file);
      const text = buffer.subarray(0, 400).toString("utf8");
      if (looksLikeSvg(text)) return swatchBuffer(svgColors(buffer.toString("utf8")));
      if (isPng(buffer)) return decodePng(buffer);
    } catch {
      return null;
    }
    return null;
  }

  const absolute = /^https:/i.test(url) ? url : url.replace(/^\/\//, "https://");
  for (const candidate of candidatesFor(absolute)) {
    const remaining = deadline - Date.now();
    if (remaining <= 120) break;
    const timeout = AbortSignal.timeout(Math.max(300, Math.min(2000, remaining)));
    try {
      const response = await fetch(candidate, {
        redirect: "follow",
        cache: "default",
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: { accept: "image/png, image/svg+xml, image/*" },
      });
      if (!response.ok) continue;
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_BYTES) continue;
      const buffer = new Uint8Array(await response.arrayBuffer());
      if (!buffer.byteLength || buffer.byteLength > MAX_BYTES) continue;

      const head = Buffer.from(buffer.subarray(0, 400)).toString("utf8");
      if (isPng(buffer)) return decodePng(Buffer.from(buffer));
      if (looksLikeSvg(head)) return swatchBuffer(svgColors(Buffer.from(buffer).toString("utf8")));
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** Cloudinary can deliver PNG for any image it stores — that keeps decoding cheap. */
function candidatesFor(url: string) {
  const list: string[] = [];
  if (isCloudinaryUrl(url)) {
    if (/\.(jpe?g|webp|avif|gif)$/i.test(url)) list.push(url.replace(/\.(jpe?g|webp|avif|gif)(?=$|[?#])/i, ".png"));
    if (!/\/upload\/[^?#]*\bf_/.test(url) && url.includes("/upload/")) list.push(url.replace("/upload/", "/upload/f_png/"));
  }
  list.push(url);
  return [...new Set(list)];
}

function isPng(buffer: Uint8Array) {
  return PNG_SIGNATURE.every((byte, index) => buffer[index] === byte);
}

function looksLikeSvg(head: string) {
  const text = head.replace(/^\uFEFF/, "").trimStart();
  return text.startsWith("<svg") || (text.startsWith("<?xml") && text.includes("<svg"));
}

/* --------------------------------------------------------------- decoding --- */

/**
 * Minimal PNG reader: greyscale/RGB/palette, 1–16 bit, non-interlaced only.
 * Output is a sampled RGBA grid (max ~72×72) — enough to read a logo's colours.
 */
function decodePng(buffer: Buffer): Uint8Array | null {
  if (buffer.length < 8) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  let interlace = 0;
  let palette: Buffer | null = null;
  let transparency: Buffer | null = null;
  const idat: Buffer[] = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    if (length < 0 || start + length > buffer.length) break;
    const data = buffer.subarray(start, start + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") {
      palette = Buffer.from(data);
    } else if (type === "tRNS") {
      transparency = Buffer.from(data);
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset = start + length + 4;
  }

  if (!width || !height || width * height > 40_000_000) return null;
  if (interlace !== 0) return null;
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  if (colorType !== 3 && ![8, 16].includes(bitDepth)) return null;
  if (colorType === 3 && ![1, 2, 4, 8].includes(bitDepth)) return null;
  if (colorType === 3 && (!palette || palette.length < 3)) return null;

  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }

  const bitsPerPixel = channels * bitDepth;
  const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
  const bytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const stride = rowBytes + 1;
  if (raw.length < stride * height) return null;

  const lines = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * stride];
    const row = lines.subarray(y * rowBytes, (y + 1) * rowBytes);
    raw.copy(row, 0, y * stride + 1, y * stride + 1 + rowBytes);
    const prev = y > 0 ? lines.subarray((y - 1) * rowBytes, y * rowBytes) : null;
    unfilter(filter, row, prev, bytesPerPixel);
  }

  const stepX = Math.max(1, Math.ceil(width / SAMPLE_EDGE));
  const stepY = Math.max(1, Math.ceil(height / SAMPLE_EDGE));
  const out = new Uint8Array(Math.ceil(width / stepX) * Math.ceil(height / stepY) * 4);
  let write = 0;

  for (let y = 0; y < height; y += stepY) {
    const row = lines.subarray(y * rowBytes, (y + 1) * rowBytes);
    for (let x = 0; x < width; x += stepX) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 255;
      if (colorType === 3) {
        const index = readBits(row, x, bitDepth);
        red = palette![(index % (palette!.length / 3)) * 3];
        green = palette![(index % (palette!.length / 3)) * 3 + 1];
        blue = palette![(index % (palette!.length / 3)) * 3 + 2];
        alpha = transparency && index < transparency.length ? transparency[index] : 255;
      } else {
        red = sampleChannel(row, x, 0, bitDepth, channels);
        const grey = colorType === 0 || colorType === 4;
        green = grey ? red : sampleChannel(row, x, 1, bitDepth, channels);
        blue = grey ? red : sampleChannel(row, x, 2, bitDepth, channels);
        alpha = colorType === 4 || colorType === 6 ? sampleChannel(row, x, colorType === 4 ? 1 : 3, bitDepth, channels) : 255;
      }
      out[write++] = red;
      out[write++] = green;
      out[write++] = blue;
      out[write++] = alpha;
    }
  }

  return out.subarray(0, write);
}

/** 8/16-bit channel: 16-bit uses the high byte; sub-byte depths are scaled up. */
function sampleChannel(row: Buffer, pixel: number, channel: number, bitDepth: number, channels: number) {
  if (bitDepth >= 8) return row[(pixel * channels + channel) * (bitDepth / 8)] ?? 0;
  return readBits(row, pixel * channels + channel, bitDepth);
}

function readBits(row: Buffer, index: number, bitDepth: number) {
  const bitOffset = index * bitDepth;
  const byte = Math.floor(bitOffset / 8);
  const shift = 8 - bitOffset % 8 - bitDepth;
  const mask = (1 << bitDepth) - 1;
  const value = (row[byte] >> shift) & mask;
  if (bitDepth === 8) return value;
  return Math.round((value / mask) * 255);
}

function unfilter(filter: number, row: Buffer, prev: Buffer | null, bpp: number) {
  if (filter === 0) return;
  for (let i = 0; i < row.length; i += 1) {
    const left = i >= bpp ? row[i - bpp] : 0;
    const up = prev ? prev[i] : 0;
    const upLeft = prev && i >= bpp ? prev[i - bpp] : 0;
    let value: number;
    switch (filter) {
      case 1:
        value = row[i] + left;
        break;
      case 2:
        value = row[i] + up;
        break;
      case 3:
        value = row[i] + Math.floor((left + up) / 2);
        break;
      case 4:
        value = row[i] + paeth(left, up, upLeft);
        break;
      default:
        return;
    }
    row[i] = value & 0xff;
  }
}

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/* ------------------------------------------------------------------- svg --- */

const SVG_COLOR = /(?:fill|stop-color|stroke)\s*[:=]\s*(?:"|')?\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi;

/** Paint order matters: a logo's `fill`s are the brand, its `stroke`s are outlines. */
export function svgColors(svg: string): string[] {
  const counts = new Map<string, number>();
  const grab = (value: string, weight: number) => {
    let hex = "";
    if (value.startsWith("#")) {
      const short = value.length <= 4 ? `#${value.slice(1).split("").map((c) => c + c).join("")}` : value;
      hex = normalizeHexColor(short.slice(0, 7), "");
    } else {
      const numbers = value.match(/\d+(\.\d+)?/g);
      if (numbers && numbers.length >= 3) {
        hex = normalizeHexColor(
          `#${numbers
            .slice(0, 3)
            .map((n) => Math.min(255, Math.round(Number(n))).toString(16).padStart(2, "0"))
            .join("")}`,
          "",
        );
      }
    }
    if (!hex) return;
    counts.set(hex, (counts.get(hex) ?? 0) + weight);
  };

  let match: RegExpExecArray | null;
  while ((match = SVG_COLOR.exec(svg))) {
    const raw = match[1];
    const property = match[0].slice(0, match[0].indexOf(":") > -1 ? match[0].indexOf(":") : match[0].indexOf("="));
    grab(raw, property.includes("fill") ? 6 : property.includes("stop-color") ? 4 : 2);
  }
  // `<rect fill="x">` style attributes without quotes are covered above; also
  // catch `style="fill:#fff"` written inline in design-tool exports.
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex, count]) => ({ hex, count }))
    .flatMap((row) => Array<string>(Math.min(12, Math.max(1, Math.round(row.count / 3)))).fill(row.hex));
}

/** Turns a colour list into the same RGBA byte shape the pixel sampler expects. */
function swatchBuffer(colors: string[]): Uint8Array {
  const out = new Uint8Array(colors.length * 4);
  colors.forEach((color, index) => {
    const hex = normalizeHexColor(color).slice(1);
    out[index * 4] = Number.parseInt(hex.slice(0, 2), 16);
    out[index * 4 + 1] = Number.parseInt(hex.slice(2, 4), 16);
    out[index * 4 + 2] = Number.parseInt(hex.slice(4, 6), 16);
    out[index * 4 + 3] = 255;
  });
  return out;
}

/** PNG bytes → brand colours. Also handy for upload hooks and the unit tests. */
export function swatchesFromPng(buffer: Buffer, max = 6): string[] {
  try {
    const pixels = decodePng(buffer);
    return pixels ? swatchesFromRgba(pixels, { max }).map((swatch) => swatch.hex) : [];
  } catch {
    return [];
  }
}

/** Exposed for the tests + for anyone who only has pixel data (e.g. canvas). */
export function dominantColorsFromRgba(pixels: Uint8Array | Uint8ClampedArray, max = 6) {
  return swatchesFromRgba(pixels, { max }).map((swatch) => swatch.hex);
}
