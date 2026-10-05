/**
 * Cloudinary helpers.
 *
 * Two upload modes are supported:
 *  - **signed** (preferred): the server signs the upload with `CLOUDINARY_API_SECRET`
 *    and the browser posts the signature to Cloudinary. Nothing secret reaches the
 *    client — only a short-lived signature.
 *  - **unsigned**: a legacy fallback using a public upload preset, for schools that
 *    have not added an API key/secret yet.
 */

import { createHash } from "node:crypto";

export interface CloudinarySettings {
  enabled: boolean;
  cloudName: string;
  uploadPreset: string;
  folder: string;
}

export function cloudinarySettings(): CloudinarySettings {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "").trim();
  const uploadPreset = (process.env.CLOUDINARY_UPLOAD_PRESET || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "").trim();
  const folder = (process.env.CLOUDINARY_FOLDER || "okgs").trim().replace(/^\/+|\/+$/g, "");
  return {
    enabled: Boolean(cloudName && uploadPreset),
    cloudName,
    uploadPreset,
    folder: folder || "okgs",
  };
}

export function cloudinaryUploadUrl(cloudName: string) {
  return `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
}

/**
 * Cloudinary public ids must be ASCII. Bangla titles transliterate down to
 * something safe and short, with a time+random suffix so repeats stay unique.
 */
export function asciiPublicId(label: string) {
  const base = String(label ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const stamp = Date.now().toString(36).slice(-5);
  const random = Math.random().toString(36).slice(2, 6);
  return `${base || "image"}-${stamp}${random}`;
}

/** Cloudinary's default is SHA-1; accounts locked to SHA-256 opt in via env. */
export type SignatureAlgorithm = "sha1" | "sha256";

export interface CloudinaryServerSettings {
  enabled: boolean;
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
  maxBytes: number;
  signatureAlgorithm: SignatureAlgorithm;
}

/**
 * Cloudinary accepts SHA-1 (its default, what its SDKs use) and SHA-256.
 * Only switch to SHA-256 when the product environment rejects SHA-1 signatures
 * (`CLOUDINARY_SIGNATURE_ALGORITHM=sha256`) — the server hashes with whatever is
 * configured here, so both ends always agree.
 */
export function cloudinarySignatureAlgorithm(): SignatureAlgorithm {
  const configured = (process.env.CLOUDINARY_SIGNATURE_ALGORITHM || "").trim().toLowerCase();
  return configured === "sha256" ? "sha256" : "sha1";
}

/** Server-side credentials. Never hand the secret to the browser. */
export function cloudinaryServerSettings(): CloudinaryServerSettings {
  const base = cloudinarySettings();
  const apiKey = (process.env.CLOUDINARY_API_KEY || process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || "").trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET_KEY || "").trim();
  return {
    enabled: Boolean(base.cloudName && apiKey && apiSecret),
    cloudName: base.cloudName,
    apiKey,
    apiSecret,
    folder: base.folder,
    maxBytes: Number(process.env.CLOUDINARY_MAX_BYTES || 12 * 1024 * 1024),
    signatureAlgorithm: cloudinarySignatureAlgorithm(),
  };
}

/**
 * Parameters Cloudinary never folds into an upload signature. Everything else
 * that is posted alongside the file (folder, public_id, tags, timestamp, …)
 * MUST appear in the signed string, or the API answers 401 `Invalid Signature`.
 */
export const UNSIGNED_UPLOAD_PARAMS = ["file", "api_key", "signature", "cloud_name", "resource_type"] as const;

/**
 * Serialises upload parameters exactly the way Cloudinary does:
 *   • drop empty values (they may not appear in the request either),
 *   • sort by parameter name (alphabetically),
 *   • join `key=value` pairs with `&`.
 *
 * The API secret is appended afterwards with no separator, then hashed.
 * `folder`, `public_id` and `tags` are sanitised before they get here, so no
 * value can contain the `&`/`=` delimiters and the string stays unambiguous.
 */
export function cloudinarySigningString(params: Record<string, unknown>): string {
  return Object.entries(params)
    .map(([key, value]) => [key, value] as const)
    .filter(([, value]) => value !== null && value !== undefined && String(value) !== "")
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(",") : String(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

/** `SHA(sorted params + api_secret)` — the value Cloudinary expects as `signature`. */
export function cloudinarySignature(
  params: Record<string, unknown>,
  apiSecret: string,
  algorithm: SignatureAlgorithm = "sha1",
): string {
  return createHash(algorithm).update(`${cloudinarySigningString(params)}${apiSecret}`).digest("hex");
}

/**
 * Cloudinary tags allow letters, digits, `_`, `-` and `/` only, and a request
 * carries at most a handful. Anything else is dropped so the browser can never
 * post a tag the signature does not cover.
 */
export function sanitizeCloudinaryTags(value: unknown, limit = 8): string[] {
  const raw = Array.isArray(value) ? value : String(value ?? "").split(",");
  const tags: string[] = [];
  for (const entry of raw) {
    const tag = String(entry ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9/_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length >= limit) break;
  }
  return tags;
}

/** Folder paths are signed verbatim, so normalise them once, on the server. */
export function sanitizeCloudinaryFolder(value: unknown, fallback = ""): string {
  return String(value ?? fallback)
    .trim()
    .replace(/\\+/g, "/")
    .replace(/[^a-zA-Z0-9/_-]+/g, "")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/")
    .slice(0, 160);
}

export interface SignedUpload {
  cloudName: string;
  apiKey: string;
  endpoint: string;
  timestamp: number;
  signature: string;
  /**
   * The complete set of parameters the signature covers — including every
   * non-empty value the browser must POST (`timestamp`, optional `folder`,
   * `public_id`, `tags`). The client posts these verbatim and nothing else, so
   * the two sides can never drift apart again.
   */
  params: Record<string, string>;
  folder: string;
  publicId: string;
  tags: string;
  maxBytes: number;
  accept: string;
  expiresIn: number;
}

export interface SignedUploadOptions {
  /** Sub-folder inside the account folder (already scoped/validated). */
  folder?: string;
  /** Optional public id; the caller generates one when a stable name is wanted. */
  publicId?: string;
  tags?: string[];
  expiresIn?: number;
}

/**
 * Builds a signed upload payload for one file.
 *
 * Cloudinary validates the signature against *every* parameter it receives —
 * excluding only `file`, `api_key`, `signature`, `cloud_name` and
 * `resource_type`. So the signed set must be identical to the posted set:
 * sorted alphabetically, joined with `&`, API secret appended, then hashed.
 * `params` is returned for the browser to send as-is.
 */
export function signedUpload(settings: CloudinaryServerSettings, options: SignedUploadOptions = {}): SignedUpload {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = sanitizeCloudinaryFolder([settings.folder, options.folder].filter(Boolean).join("/"));
  const publicId = String(options.publicId ?? "").trim();
  const tags = sanitizeCloudinaryTags(options.tags).join(",");

  const params: Record<string, string> = { timestamp: String(timestamp) };
  if (folder) params.folder = folder;
  if (publicId) params.public_id = publicId;
  if (tags) params.tags = tags;

  return {
    cloudName: settings.cloudName,
    apiKey: settings.apiKey,
    endpoint: cloudinaryUploadUrl(settings.cloudName),
    timestamp,
    signature: cloudinarySignature(params, settings.apiSecret, settings.signatureAlgorithm),
    params,
    folder,
    publicId,
    tags,
    maxBytes: settings.maxBytes,
    accept: "image/*",
    expiresIn: options.expiresIn ?? 600,
  };
}

/**
 * Namespaces a requested folder inside the caller's own club folder, so a club
 * admin can never write into another club's assets. A no-op for staff/admins.
 */
export function scopeCloudinaryFolder(clubSlug: string, folder: string): string {
  const slug = sanitizeCloudinaryFolder(clubSlug);
  if (!slug) return sanitizeCloudinaryFolder(folder);
  const requested = sanitizeCloudinaryFolder(folder);
  const inside = requested === slug ? "" : requested.startsWith(`${slug}/`) ? requested.slice(slug.length + 1) : requested;
  return [slug, inside].filter(Boolean).join("/");
}

/** What `/api/media/sign` hands the browser: either a signature or the legacy preset. */
export type MediaUploadTicket =
  | ({ mode: "signed"; enabled: true } & SignedUpload)
  | {
      mode: "unsigned";
      enabled: boolean;
      cloudName: string;
      uploadPreset: string;
      folder: string;
      endpoint: string;
      maxBytes: number;
      hint: string;
    };

export interface MediaTicketOptions {
  /** Club admins are locked into `<slug>/…`; staff keep the requested folder. */
  clubSlug?: string;
  folder?: string;
  label?: string;
  fileName?: string;
  /** Client-requested tags (array or comma-separated) — sanitised, then signed. */
  tags?: string[] | string;
  server?: CloudinaryServerSettings;
  legacy?: CloudinarySettings;
}

/**
 * Assembles one upload ticket. Shared by `/api/media/sign` and the signature
 * smoke test so the signed parameter set and the posted parameter set are
 * exercised through the same code path.
 */
export function mediaUploadTicket(options: MediaTicketOptions = {}): MediaUploadTicket {
  const server = options.server ?? cloudinaryServerSettings();
  const legacy = options.legacy ?? cloudinarySettings();
  const scopedPrefix = scopeCloudinaryFolder(options.clubSlug ?? "", options.folder ?? "");

  if (!server.enabled) {
    // No API key/secret yet — tell the client to fall back to the unsigned preset
    // (or explain what is missing so the admin can finish the setup).
    return {
      mode: "unsigned",
      enabled: legacy.enabled,
      cloudName: legacy.cloudName,
      uploadPreset: legacy.uploadPreset,
      folder: [legacy.folder, scopedPrefix].filter(Boolean).join("/"),
      endpoint: legacy.cloudName ? cloudinaryUploadUrl(legacy.cloudName) : "",
      maxBytes: server.maxBytes,
      hint: "CLOUDINARY_API_KEY ও CLOUDINARY_API_SECRET যোগ করলে অ্যাপ নিজেই স্বাক্ষর (signed upload) করবে।",
    };
  }

  const label = String(options.label ?? "").trim();
  const fileName = String(options.fileName ?? "").trim();

  return {
    mode: "signed",
    enabled: true,
    ...signedUpload(server, {
      folder: scopedPrefix,
      publicId: asciiPublicId(label || fileName || "image"),
      tags: [options.clubSlug || "okgs", ...sanitizeCloudinaryTags(options.tags)],
    }),
  };
}

export function isCloudinaryUrl(value: unknown) {
  return /^https?:\/\/res\.cloudinary\.com\//i.test(String(value ?? ""));
}

export interface TransformOptions {
  width?: number;
  height?: number;
  /** "cover" crops to the box, "limit" only shrinks. */
  fit?: "cover" | "limit" | "pad";
  quality?: number | "auto";
  format?: "auto" | "webp" | "jpg";
}

export function cloudNameOf(url: string) {
  const match = /^https?:\/\/res\.cloudinary\.com\/([^/]+)\//i.exec(url);
  return match ? match[1] : "";
}

/**
 * Adds delivery transformations to Cloudinary URLs and leaves everything else
 * (external links, /public assets) untouched.
 */
export function optimizedImage(value: unknown, options: TransformOptions = {}) {
  const url = String(value ?? "").trim();
  if (!url || !isCloudinaryUrl(url)) return url;
  if (/\/upload\/(v\d+|f_auto|q_auto|w_)/.test(url) && url.includes("/upload/f_")) return url;

  const parts: string[] = [];
  parts.push(`f_${options.format ?? "auto"}`);
  parts.push(options.quality === undefined ? "q_auto" : `q_${options.quality}`);
  if (options.width) parts.push(`w_${options.width}`);
  if (options.height) parts.push(`h_${options.height}`);
  parts.push(`c_${options.fit === "cover" ? "fill" : options.fit === "pad" ? "pad" : "limit"}`);

  return url.replace("/upload/", `/upload/${parts.join(",")}/`);
}

/** Convenience for inline `style={{ backgroundImage: ... }}` usage. */
export function backgroundStyle(value: unknown, options: TransformOptions = {}) {
  const url = optimizedImage(value, options);
  return url ? { backgroundImage: `url("${url}")` } : undefined;
}

export function assetLabel(value: unknown) {
  const url = String(value ?? "");
  if (!url) return "";
  if (isCloudinaryUrl(url)) {
    const publicId = url.split("/upload/").pop()!.replace(/^v\d+\//, "").replace(/\.[a-z0-9]+$/i, "");
    return publicId.split("/").pop() || publicId;
  }
  return url.split("/").pop() || url;
}
