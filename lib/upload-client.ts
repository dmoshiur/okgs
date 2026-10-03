"use client";

/**
 * Browser → Cloudinary uploader (unsigned preset).
 * Uses XMLHttpRequest so we can report real upload progress.
 */

export interface MediaConfig {
  enabled: boolean;
  cloudName: string;
  uploadPreset: string;
  folder: string;
  endpoint: string;
  maxBytes: number;
}

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  version: number;
}

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];

let cachedConfig: Promise<MediaConfig | null> | undefined;

export function loadMediaConfig(force = false): Promise<MediaConfig | null> {
  if (!cachedConfig || force) {
    cachedConfig = fetch("/api/media/config", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<MediaConfig>) : null))
      .catch(() => null);
  }
  return cachedConfig;
}

export function isUploadable(file: File) {
  return file.type.startsWith("image/") || allowedTypes.includes(file.type);
}

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "০ KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const amount = value / 1024 ** index;
  const bn = new Intl.NumberFormat("bn-BD", { maximumFractionDigits: index === 0 ? 0 : 1 }).format(amount);
  return `${bn} ${units[index]}`;
}

/** Cloudinary public ids are ASCII — transliterate the label into something safe. */
export function safePublicId(label: string) {
  const base = label
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

export interface UploadOptions {
  file: File;
  /** e.g. the club slug, used for the Cloudinary folder + public id. */
  prefix?: string;
  label?: string;
  tags?: string[];
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export function uploadToCloudinary({ file, prefix, label, tags = [], onProgress, signal }: UploadOptions): Promise<UploadResult> {
  return loadMediaConfig().then(async (config) => {
    if (!config) throw new Error("মিডিয়া সেটিংস পাওয়া যায়নি — আবার লগইন করে চেষ্টা করুন।");
    if (!config.enabled) {
      throw new Error("Cloudinary এখনো সেটআপ করা হয়নি। CLOUDINARY_CLOUD_NAME ও CLOUDINARY_UPLOAD_PRESET যোগ করুন।");
    }
    if (!isUploadable(file)) throw new Error("শুধু ছবির ফাইল আপলোড করা যাবে (JPG, PNG, WebP, GIF, AVIF)।");
    if (config.maxBytes && file.size > config.maxBytes) {
      throw new Error(`ছবিটি খুব বড় (${formatBytes(file.size)}) — সর্বোচ্চ ${formatBytes(config.maxBytes)}।`);
    }

    const folder = [config.folder, prefix].filter(Boolean).join("/");
    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", config.uploadPreset);
    body.append("folder", folder);
    body.append("public_id", safePublicId(label || file.name.replace(/\.[a-z0-9]+$/i, "")));
    body.append("timestamp", String(Math.floor(Date.now() / 1000)));
    if (tags.length) body.append("tags", tags.join(","));

    return new Promise<UploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", config.endpoint, true);
      xhr.responseType = "json";

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
      };

      xhr.onload = () => {
        const data = xhr.response as
          | { secure_url?: string; public_id?: string; width?: number; height?: number; bytes?: number; format?: string; version?: number; error?: { message?: string } }
          | null;
        if (xhr.status >= 200 && xhr.status < 300 && data?.secure_url) {
          onProgress?.(100);
          resolve({
            url: data.secure_url,
            publicId: data.public_id ?? "",
            width: data.width ?? 0,
            height: data.height ?? 0,
            bytes: data.bytes ?? file.size,
            format: data.format ?? "",
            version: data.version ?? 0,
          });
          return;
        }
        const detail = data?.error?.message || "";
        const hint =
          xhr.status === 400 || xhr.status === 401
            ? "আপলোড প্রিসেটটি ‘unsigned’ কিনা এবং সঠিক নাম দেওয়া কিনা দেখে নিন।"
            : xhr.status === 0
              ? "ইন্টারনেট সংযোগ বা Cloudinary-র CORS সেটিং পরীক্ষা করুন।"
              : "";
        reject(new Error([`আপলোড ব্যর্থ (${xhr.status || "নেটওয়ার্ক"})।`, detail, hint].filter(Boolean).join(" ")));
      };

      xhr.onerror = () => reject(new Error("আপলোড করা যায়নি — ইন্টারনেট সংযোগ পরীক্ষা করুন।"));
      xhr.onabort = () => reject(new Error("আপলোড বাতিল করা হয়েছে।"));
      if (signal) {
        if (signal.aborted) {
          reject(new Error("আপলোড বাতিল করা হয়েছে।"));
          return;
        }
        signal.addEventListener("abort", () => xhr.abort(), { once: true });
      }
      xhr.send(body);
    });
  });
}
