"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CloudUpload, Image as ImageIcon, Link2, Loader2, Settings2, Trash2, X } from "lucide-react";
import { isCloudinaryUrl, optimizedImage } from "@/lib/cloudinary";
import { formatBytes, loadMediaConfig, uploadToCloudinary, type MediaConfig } from "@/lib/upload-client";

interface ImageFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  help?: string;
  /** Sub-folder inside the Cloudinary folder, usually the club slug. */
  prefix?: string;
  /** Used for the generated public id. */
  title?: string;
  onError?: (message: string) => void;
}

type Status = { kind: "idle" | "uploading" | "done" | "error"; percent?: number; message?: string };

export function ImageField({ value, onChange, label, help, prefix, title, onError }: ImageFieldProps) {
  const [config, setConfig] = useState<MediaConfig | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [localPreview, setLocalPreview] = useState<string>("");
  const [urlMode, setUrlMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    let alive = true;
    loadMediaConfig().then((result) => {
      if (alive) setConfig(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!localPreview) return;
    return () => URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  // Clear the "done" banner as soon as the value moves on (e.g. another upload or manual edit).
  useEffect(() => {
    if (status.kind === "done" && !value) setStatus({ kind: "idle" });
  }, [value, status.kind]);

  const preview = localPreview || optimizedImage(value, { width: 420, fit: "cover" });

  async function handleFiles(file: File | undefined | null) {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);
    setStatus({ kind: "uploading", percent: 4 });
    controllerRef.current = new AbortController();

    try {
      const result = await uploadToCloudinary({
        file,
        prefix,
        label: title || label,
        tags: ["okgs", prefix || "studio"].filter(Boolean),
        onProgress: (percent) => setStatus({ kind: "uploading", percent }),
        signal: controllerRef.current.signal,
      });
      onChange(result.url);
      setLocalPreview("");
      setStatus({
        kind: "done",
        message: `${formatBytes(result.bytes)} · ${result.width}×${result.height} · ${result.publicId}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "আপলোড ব্যর্থ।";
      setStatus({ kind: "error", message });
      onError?.(message);
    } finally {
      controllerRef.current = null;
    }
  }

  const notConfigured = config && !config.enabled;

  return (
    <div className={`image-field ${status.kind === "uploading" ? "is-busy" : ""}`}>
      <div className="image-field-head">
        <span className="image-field-title">{label}</span>
        <div className="image-field-actions">
          <button type="button" className="ghost-button" onClick={() => setUrlMode((mode) => !mode)}>
            <Link2 size={13} /> {urlMode ? "আপলোড দেখান" : "লিংক দিন"}
          </button>
          {value ? (
            <button
              type="button"
              className="ghost-button is-danger"
              onClick={() => {
                onChange("");
                setLocalPreview("");
                setStatus({ kind: "idle" });
              }}
            >
              <Trash2 size={13} /> সরান
            </button>
          ) : null}
        </div>
      </div>

      <div className="image-field-body">
        <div
          className="image-drop"
          tabIndex={0}
          role="button"
          onPaste={(event) => void handleFiles(Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"))?.getAsFile())}
          onDragOver={(event) => {
            event.preventDefault();
            event.currentTarget.classList.add("is-over");
          }}
          onDragLeave={(event) => event.currentTarget.classList.remove("is-over")}
          onDrop={(event) => {
            event.preventDefault();
            event.currentTarget.classList.remove("is-over");
            void handleFiles(event.dataTransfer.files?.[0]);
          }}
          onClick={() => !urlMode && inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          {preview ? (
            <span className="image-thumb">
              <img src={preview} alt="" />
              {status.kind === "uploading" ? (
                <span className="image-busy">
                  <Loader2 size={14} className="spin" /> {status.percent ?? 0}%
                </span>
              ) : null}
            </span>
          ) : (
            <span className="image-empty">
              <ImageIcon size={18} />
              ছবি নেই
            </span>
          )}

          <div className="image-drop-copy">
            {urlMode ? (
              <>
                <label className="inline-url-field">
                  <span>ছবির লিংক</span>
                  <input
                    type="url"
                    value={value}
                    placeholder="https://res.cloudinary.com/…"
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => onChange(event.target.value)}
                  />
                </label>
                <small>সরাসরি Cloudinary, Google Drive বা অন্য যেকোনো পাবলিক ছবির লিংক বসাতে পারেন।</small>
              </>
            ) : notConfigured ? (
              <>
                <b>Cloudinary সেটআপ করা নেই</b>
                <small>
                  <Settings2 size={12} /> <code>CLOUDINARY_CLOUD_NAME</code> ও <code>CLOUDINARY_UPLOAD_PRESET</code> বসালেই এখান থেকে সরাসরি আপলোড চলবে। এখন লিংক দিয়েও কাজ চলবে।
                </small>
              </>
            ) : status.kind === "uploading" ? (
              <>
                <b><CloudUpload size={14} /> আপলোড হচ্ছে… {status.percent ?? 0}%</b>
                <span className="upload-progress"><i style={{ width: `${status.percent ?? 0}%` }} /></span>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    controllerRef.current?.abort();
                    setStatus({ kind: "idle" });
                    setLocalPreview("");
                  }}
                >
                  <X size={12} /> বাতিল
                </button>
              </>
            ) : (
              <>
                <b><CloudUpload size={14} /> ছবি ছেড়ে দিন বা ক্লিক করুন</b>
                <small>জ্যাগ করে আনুন, অথবা ফোকাস করে <kbd>Ctrl</kbd>+<kbd>V</kbd> দিয়ে পেস্ট করুন। JPG, PNG, WebP, AVIF — সর্বোচ্চ {config ? formatBytes(config.maxBytes) : "…"}</small>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              void handleFiles(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>

        <div className="image-field-foot">
          {status.kind === "error" ? (
            <p className="image-msg is-error"><X size={13} /> {status.message}</p>
          ) : status.kind === "done" ? (
            <p className="image-msg is-done"><CheckCircle2 size={13} /> Cloudinary-তে আপলোড হয়েছে — {status.message}</p>
          ) : value ? (
            <p className="image-msg">
              {isCloudinaryUrl(value) ? "Cloudinary অ্যাসেট — স্বয়ংক্রিয়ভাবে সাইজ ও ফরম্যাট অপ্টিমাইজ হবে।" : "বাইরের লিংক সংরক্ষিত।"}
            </p>
          ) : help ? (
            <p className="image-msg image-help">{help}</p>
          ) : null}
          {value ? (
            <a className="image-open" href={value} target="_blank" rel="noreferrer">খুলে দেখুন ↗</a>
          ) : null}
        </div>

        {value && !urlMode ? (
          <textarea
            className="image-url-raw"
            value={value}
            rows={1}
            spellCheck={false}
            aria-label={`${label} — লিংক`}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : null}
      </div>
    </div>
  );
}
