/**
 * Cloudinary helpers.
 *
 * Uploads go straight from the browser to Cloudinary with an *unsigned* upload
 * preset, so no API secret is ever shipped to the client. Only the cloud name and
 * the public preset are handed out, and only to a signed-in admin.
 */

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
