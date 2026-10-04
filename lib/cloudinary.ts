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

export interface CloudinaryServerSettings {
  enabled: boolean;
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
  maxBytes: number;
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
  };
}

export interface SignedUpload {
  cloudName: string;
  apiKey: string;
  endpoint: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  tags: string;
  maxBytes: number;
  accept: string;
  expiresIn: number;
}

/**
 * Builds a signed upload payload for one file. Cloudinary wants every parameter
 * that is not `file`, `api_key` or `signature` to be part of the signature, in
 * alphabetical order, joined with `&`, with the API secret appended.
 */
export function signedUpload(
  settings: CloudinaryServerSettings,
  options: { folder?: string; publicId?: string; tags?: string[]; expiresIn?: number } = {},
): SignedUpload {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = [settings.folder, options.folder].filter(Boolean).join("/").replace(/\/+/g, "/");
  const publicId = (options.publicId || "").trim();
  const tags = (options.tags || []).filter(Boolean).join(",");

  const params: Record<string, string> = { timestamp: String(timestamp) };
  if (folder) params.folder = folder;
  if (publicId) params.public_id = publicId;
  if (tags) params.tags = tags;

  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const signature = createHash("sha1").update(`${toSign}${settings.apiSecret}`).digest("hex");

  return {
    cloudName: settings.cloudName,
    apiKey: settings.apiKey,
    endpoint: cloudinaryUploadUrl(settings.cloudName),
    timestamp,
    signature,
    folder,
    publicId,
    tags,
    maxBytes: settings.maxBytes,
    accept: "image/*",
    expiresIn: options.expiresIn ?? 600,
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
