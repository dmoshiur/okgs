/**
 * QR helpers for science-fair passes.
 *
 * A pass token is `passId.signature` where the signature is an HMAC of the pass id
 * with the server secret — so a screenshot of someone else's card cannot be turned
 * into a valid token, and the scanner can verify everything offline-first.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { portalSecret } from "@/lib/portal-auth";

interface QrOptions {
  size?: number;
  margin?: number;
  dark?: string;
  light?: string;
}

export function signPassId(passId: string) {
  return createHmac("sha256", `${portalSecret()}::pass`).update(passId).digest("base64url").slice(0, 24);
}

export function makePassToken(passId: string) {
  return `${passId}.${signPassId(passId)}`;
}

export function parsePassToken(token: string) {
  const value = String(token ?? "").trim();
  const match = /^([0-9a-zA-Z-]{6,64})\.([A-Za-z0-9_-]{10,64})$/.exec(value);
  if (!match) return null;
  const [, id, signature] = match;
  const expected = signPassId(id);
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return { id, signature };
}

/* ------------------------------------------------------------------ *
 * Project / collection entry tokens
 *
 * The same idea as a pass, but for a fair *entry* (a project, a model, an
 * exhibit). A teacher scans the code printed with the entry and the console marks
 * that entry as verified — no paperwork, no duplicate entries.
 * ------------------------------------------------------------------ */

export function signEntryId(collectionId: string) {
  return createHmac("sha256", `${portalSecret()}::entry`).update(collectionId).digest("base64url").slice(0, 24);
}

export function makeEntryToken(collectionId: string) {
  return `entry-${collectionId}.${signEntryId(collectionId)}`;
}

export function parseEntryToken(token: string) {
  const value = String(token ?? "").trim();
  const match = /^entry-([0-9a-zA-Z-]{6,64})\.([A-Za-z0-9_-]{10,64})$/.exec(value);
  if (!match) return null;
  const [, id, signature] = match;
  const expected = signEntryId(id);
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return { id, signature };
}

/** Public verification URL — printed under the QR on the entry's label. */
export function entryUrl(token: string, base?: string) {
  const origin = (base || process.env.NEXT_PUBLIC_SITE_URL || "https://omarkgschool.com").replace(/\/+$/, "");
  return `${origin}/entry/${token}`;
}

/** Accepts a raw token, a /pass/<token> URL or a full https URL (what the camera sees). */
export function extractToken(scanned: string) {
  const value = String(scanned ?? "").trim();
  if (!value) return "";
  const urlMatch = /\/pass\/([^/?#\s]+)/.exec(value);
  if (urlMatch) return decodeURIComponent(urlMatch[1]);
  const tokenMatch = /([0-9a-zA-Z-]{6,64}\.[A-Za-z0-9_-]{10,64})/.exec(value);
  return tokenMatch ? tokenMatch[1] : value;
}

export interface QrOptions {
  size?: number;
  margin?: number;
  dark?: string;
  light?: string;
}

/** Generate QR code as PNG data URL */
export async function generateQRCode(text: string, size: number = 200): Promise<string> {
  return qrDataUrl(text, { size, margin: 1 });
}

/** PNG data URL — usable directly in <img src> or a server-rendered card. */
export async function qrDataUrl(text: string, options: QrOptions = {}) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: options.margin ?? 1,
    width: options.size ?? 480,
    color: { dark: options.dark ?? "#0b3a25", light: options.light ?? "#ffffff" },
  });
}

/** Inline SVG string — crisp at any size for printable passes. */
export async function qrSvg(text: string, options: QrOptions = {}) {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: options.margin ?? 1,
    color: { dark: options.dark ?? "#0b3a25", light: options.light ?? "#ffffff" },
  });
}
