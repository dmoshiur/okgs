"use client";

/**
 * Browser → Cloudinary uploader.
 *
 * Preferred mode is **signed**: the server signs every upload with the Cloudinary
 * API secret (`/api/media/sign`), so no secret ever reaches the browser and the
 * upload cannot be replayed from another device. If the school has not added an
 * API key/secret yet, the client transparently falls back to an unsigned preset.
 *
 * Cloudinary recomputes the signature over every parameter it receives (only
 * `file`, `api_key`, `signature`, `cloud_name` and `resource_type` are excluded),
 * so a signed upload must post *exactly* the parameter set the server signed.
 * That set travels back as `ticket.params` and is posted verbatim — the client
 * never invents a parameter of its own.
 *
 * Uses XMLHttpRequest so we can report real upload progress.
 */

import { secureCloudinaryUrl } from "./image-url";

export interface MediaConfig {
  enabled: boolean;
  /** True when the server holds an API key + secret and signs each upload. */
  signed?: boolean;
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
  /** Every parameter the signature covers — post these verbatim, nothing else. */
  params?: Record<string, string>;
  folder?: string;
  publicId?: string;
  tags?: string;
  uploadPreset?: string;
  maxBytes?: number;
  hint?: string;
}

export interface UploadTicketRequest {
  /** Sub-folder inside the account folder (club slug, "branding", …). */
  prefix?: string;
  label?: string;
  /** Tags the caller wants on the asset — the server folds them into the signature. */
  tags?: string[];
  fileName?: string;
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
export async function requestUploadTicket(options: UploadTicketRequest = {}): Promise<UploadTicket | null> {
  try {
    const response = await fetch("/api/media/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        folder: options.prefix || "",
        label: options.label || "",
        fileName: options.fileName || "",
        tags: options.tags || [],
      }),
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

/**
 * The exact parameter set a signed upload may carry.
 *
 * `ticket.params` is what the server hashed, so it is used as-is. Older tickets
 * (no `params`) are rebuilt from the legacy fields; empty values are dropped
 * because Cloudinary's signature covers "present" parameters only.
 */
export function signedUploadParams(ticket: UploadTicket | null): Record<string, string> {
  if (!ticket) return {};
  const source: Record<string, unknown> =
    ticket.params && typeof ticket.params === "object"
      ? ticket.params
      : { timestamp: ticket.timestamp, folder: ticket.folder, public_id: ticket.publicId, tags: ticket.tags };

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (!text) continue;
    params[key] = text;
  }
  return params;
}

export function isSignedTicket(ticket: UploadTicket | null, endpoint: string): boolean {
  return Boolean(ticket?.mode === "signed" && ticket.signature && ticket.timestamp && ticket.apiKey && endpoint);
}

export interface UploadFormOptions {
  file: File;
  ticket: UploadTicket | null;
  /** Sub-folder inside the account folder — unsigned mode only. */
  prefix?: string;
  label?: string;
  tags?: string[];
  config?: MediaConfig | null;
}

export interface UploadForm {
  mode: "signed" | "unsigned" | "none";
  endpoint: string;
  form: FormData;
}

/**
 * Builds the multipart body for one upload.
 *
 * Signed: `file` + every signed parameter + `api_key` + `signature`.
 * Unsigned: `file` + `folder` / `public_id` / `tags` / `upload_preset`.
 */
export function buildUploadForm({ file, ticket, prefix, label, tags = [], config }: UploadFormOptions): UploadForm {
  const endpoint = ticket?.endpoint || config?.endpoint || "";
  const form = new FormData();
  form.append("file", file);

  if (isSignedTicket(ticket, endpoint) && ticket) {
    for (const [key, value] of Object.entries(signedUploadParams(ticket))) form.append(key, value);
    form.append("api_key", ticket.apiKey as string);
    form.append("signature", ticket.signature as string);
    return { mode: "signed", endpoint, form };
  }

  const preset = ticket?.uploadPreset || config?.uploadPreset || "";
  if (preset && endpoint) {
    const folder = [config?.folder || "okgs", prefix].filter(Boolean).join("/");
    if (folder) form.append("folder", folder);
    form.append("public_id", safePublicId(label || file.name.replace(/\.[a-z0-9]+$/i, "")));
    const joinedTags = (tags.length ? tags : ticket?.tags ? [ticket.tags] : ["okgs"])
      .map((tag) => String(tag).trim())
      .filter(Boolean)
      .join(",");
    if (joinedTags) form.append("tags", joinedTags);
    form.append("upload_preset", preset);
    return { mode: "unsigned", endpoint, form };
  }

  return { mode: "none", endpoint, form };
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
    const ticket = await requestUploadTicket({
      prefix,
      label: label || file.name.replace(/\.[a-z0-9]+$/i, ""),
      fileName: file.name,
      tags,
    });

    const maxBytes = ticket?.maxBytes || 12 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error(`ছবিটি খুব বড় (${formatBytes(file.size)}) — সর্বোচ্চ ${formatBytes(maxBytes)}।`);
    }

    const { mode, endpoint, form } = buildUploadForm({ file, ticket, prefix, label, tags, config: await loadMediaConfig() });

    if (mode === "none" || !endpoint) {
      throw new Error(
        ticket?.hint ||
          "Cloudinary এখনো সেটআপ করা হয়নি — অ্যাডমিন প্যানেল থেকে cloud name, upload preset (অথবা API key ও secret) যোগ করুন।",
      );
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
        if (xhr.status >= 200 && xhr.status < 300) {
          const secureUrl = secureCloudinaryUrl(data?.secure_url);
          if (!secureUrl) {
            reject(new Error("Cloudinary did not return a valid HTTPS image URL. The image was not saved; please try again."));
            return;
          }
          onProgress?.(100);
          resolve({
            url: secureUrl,
            publicId: data?.public_id ?? "",
            width: data?.width ?? 0,
            height: data?.height ?? 0,
            bytes: data?.bytes ?? file.size,
            format: data?.format ?? "",
            version: data?.version ?? 0,
          });
          return;
        }
        // Keep the provider message short — long unbroken strings are what used
        // to blow the error row out of the settings card.
        const detail = (data?.error?.message || "").replace(/\s+/g, " ").slice(0, 220);
        const hint =
          xhr.status === 400 || xhr.status === 401
            ? mode === "signed"
              ? "স্বাক্ষরটি মেলেনি — CLOUDINARY_API_SECRET ও CLOUDINARY_API_KEY একই ক্লাউডের কি না দেখে সার্ভারটি রিস্টার্ট করুন, তারপর আবার চেষ্টা করুন।"
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
      xhr.send(form);
    });
  })();
}
