"use client";

/**
 * Browser → Cloudinary uploader.
 *
 * Preferred mode is **signed**: the server signs every upload with the Cloudinary
 * API secret (`/api/media/sign`), so no secret ever reaches the browser and the
 * upload cannot be replayed from another device. If the school has not added an
 * API key/secret yet, the client transparently falls back to an unsigned preset.
 *
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

/** What the server hands back for one upload — signed or unsigned. */
export interface UploadTicket {
  ok?: boolean;
  mode?: "signed" | "unsigned";
  enabled?: boolean;
  cloudName?: string;
  apiKey?: string;
  endpoint?: string;
  timestamp?: number;
  signature?: string;
  folder?: string;
  publicId?: string;
  tags?: string;
  uploadPreset?: string;
  maxBytes?: number;
  hint?: string;
}

let cachedConfig: Promise<MediaConfig | null> | undefined;

/** Legacy config read — still used by the admin studio status line. */
export function loadMediaConfig(force = false): Promise<MediaConfig | null> {
  if (!cachedConfig || force) {
    cachedConfig = fetch("/api/media/config", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<MediaConfig>) : null))
      .catch(() => null);
  }
  return cachedConfig;
}

/** Asks the server for a fresh signature for exactly this file. */
export async function requestUploadTicket(options: { prefix?: string; label?: string } = {}): Promise<UploadTicket | null> {
  try {
    const response = await fetch("/api/media/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ folder: options.prefix || "", label: options.label || "" }),
    });
    if (!response.ok) return null;
    return (await response.json()) as UploadTicket;
  } catch {
    return null;
  }
}

export function isUploadable(file: File) {
  const extensionIsImage = /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(file.name);
  return file.type.startsWith("image/") || allowedTypes.includes(file.type) || extensionIsImage;
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
  return (async () => {
    if (!isUploadable(file)) throw new Error("শুধু ছবির ফাইল আপলোড করা যাবে (JPG, PNG, SVG, WebP, GIF, AVIF)।");
    const ticket = await requestUploadTicket({ prefix, label: label || file.name.replace(/\.[a-z0-9]+$/i, "") });

    const maxBytes = ticket?.maxBytes || 12 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error(`ছবিটি খুব বড় (${formatBytes(file.size)}) — সর্বোচ্চ ${formatBytes(maxBytes)}।`);
    }

    const endpoint = ticket?.endpoint || (await loadMediaConfig())?.endpoint || "";
    const signed = Boolean(ticket?.mode === "signed" && ticket.signature && ticket.timestamp && endpoint);
    const unsigned = !signed && Boolean(ticket?.uploadPreset || (await loadMediaConfig())?.uploadPreset);

    if (!signed && !unsigned) {
      throw new Error(
        ticket?.hint ||
          "Cloudinary এখনো সেটআপ করা হয়নি — অ্যাডমিন প্যানেল থেকে cloud name, upload preset (অথবা API key ও secret) যোগ করুন।",
      );
    }

    const publicId = safePublicId(label || file.name.replace(/\.[a-z0-9]+$/i, ""));
    const folder = signed
      ? ticket?.folder || [prefix].filter(Boolean).join("/")
      : [((await loadMediaConfig())?.folder || "okgs"), prefix].filter(Boolean).join("/");

    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);
    body.append("tags", tags.length ? tags.join(",") : ticket?.tags || "okgs");

    if (signed && ticket) {
      body.append("api_key", ticket.apiKey || "");
      body.append("timestamp", String(ticket.timestamp));
      body.append("signature", ticket.signature || "");
      if (ticket.publicId) body.append("public_id", ticket.publicId);
    } else {
      body.append("public_id", publicId);
      body.append("upload_preset", ticket?.uploadPreset || (await loadMediaConfig())?.uploadPreset || "");
    }

    return new Promise<UploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint, true);
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
            ? signed
              ? "সার্ভার-সাইড স্বাক্ষর মিলছে না — পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।"
              : "আপলোড প্রিসেটটি ‘unsigned’ কিনা এবং সঠিক নাম দেওয়া কিনা দেখে নিন।"
            : xhr.status === 0
              ? "ইন্টারনেট সংযোগ বা Cloudinary-র CORS সেটিং পরীক্ষা করুন।"
              : "";
        reject(new Error([`আপলোড ব্যর্থ (${xhr.status || "নেটওয়ার্ক"})।`, detail, hint].filter(Boolean).join(" ")));
      };

      xhr.onerror = () => reject(new Error("আপলোড করা যায়নি — ইন্টারনেট সংযোগ বা Cloudinary সেটিং পরীক্ষা করুন।"));
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
  })();
}
