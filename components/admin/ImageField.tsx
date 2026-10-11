"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudUpload, Image as ImageIcon, Link2, Loader2, Settings2, Trash2, X } from "lucide-react";
import { isCloudinaryUrl, optimizedImage } from "@/lib/cloudinary";
import { checkImageUrl, secureCloudinaryUrl } from "@/lib/image-url";
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
  accept?: string;
  previewFit?: "cover" | "contain";
  /** Club images are optional, so a bad pasted URL can be skipped on save. */
  saveCanSkipInvalid?: boolean;
  onFileSelected?: (file: File) => void;
}

type Status = { kind: "idle" | "uploading" | "done" | "error"; percent?: number; message?: string };

export function ImageField({ value, onChange, label, help, prefix, title, onError, accept = "image/*", previewFit = "cover", saveCanSkipInvalid = false, onFileSelected }: ImageFieldProps) {
  const [config, setConfig] = useState<MediaConfig | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [localPreview, setLocalPreview] = useState<string>("");
  const [previewBroken, setPreviewBroken] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

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

  // A different URL is a different asset: stop treating the old one as broken.
  useEffect(() => {
    setPreviewBroken(false);
  }, [value]);

  const imageUrlCheck = checkImageUrl(value);
  const imageUrlWarning = imageUrlCheck.valid ? "" : imageUrlCheck.message;
  const safeValue = imageUrlCheck.valid ? imageUrlCheck.value : "";
  const remotePreview = optimizedImage(safeValue, { width: 420, fit: "cover" });
  const preview = previewBroken ? "" : localPreview || remotePreview;

  /**
   * Clearing the field has to clear *everything* about it: the saved URL, any
   * still-running upload, the object-URL preview and the value the file input
   * is holding. Leaving any of those behind is what produced "deleted" images
   * that came back on the next save or stayed visible on the public page.
   */
  const clearValue = useCallback(() => {
    const controller = controllerRef.current;
    controllerRef.current = null;
    controller?.abort();
    if (inputRef.current) inputRef.current.value = "";
    onChange("");
    setLocalPreview("");
    setPreviewBroken(false);
    setStatus({ kind: "idle" });
  }, [onChange]);

  function handleManualUrlChange(next: string) {
    const controller = controllerRef.current;
    controllerRef.current = null;
    controller?.abort();
    setLocalPreview("");
    setStatus({ kind: "idle" });
    onChange(next);
  }

  async function handleFiles(file: File | undefined | null) {
    if (!file) return;
    const previous = controllerRef.current;
    controllerRef.current = null;
    previous?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);
    setStatus({ kind: "uploading", percent: 4 });

    try {
      const result = await uploadToCloudinary({
        file,
        prefix,
        label: title || label,
        tags: ["okgs", prefix || "studio"].filter(Boolean),
        onProgress: (percent) => {
          if (controllerRef.current === controller) setStatus({ kind: "uploading", percent });
        },
        signal: controller.signal,
      });
      if (controllerRef.current !== controller) return;
      const secureUrl = secureCloudinaryUrl(result.url);
      if (!secureUrl) throw new Error("Cloudinary did not return a valid HTTPS image URL. The image was not saved; please try again.");
      onFileSelected?.(file);
      onChange(secureUrl);
      setLocalPreview("");
      setStatus({
        kind: "done",
        message: `${formatBytes(result.bytes)} · ${result.width}×${result.height} · ${result.publicId}`,
      });
    } catch (error) {
      if (controllerRef.current !== controller) return;
      // The upload never reached Cloudinary, so the blob preview is a lie —
      // drop it and keep the last saved URL so other club changes can still save.
      setLocalPreview("");
      setPreviewBroken(false);
      const message = error instanceof Error ? error.message : "The upload failed.";
      setStatus({ kind: "error", message });
      onError?.(message);
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  const notConfigured = config && !config.enabled;

  return (
    <div className={`image-field ${status.kind === "uploading" ? "is-busy" : ""}`}>
      <div className="image-field-head">
        <span className="image-field-title">{label}</span>
        <div className="image-field-actions">
          <button type="button" className="ghost-button" onClick={() => setUrlMode((mode) => !mode)}>
            <Link2 size={13} /> {urlMode ? "Show uploader" : "Paste a link"}
          </button>
          {value ? (
            <button
              type="button"
              className="ghost-button is-danger"
              onClick={clearValue}
              title="Clear the image URL — the public page stops showing this asset"
            >
              <Trash2 size={13} /> Remove
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
              <img
                src={preview}
                alt=""
                style={{ objectFit: previewFit }}
                onError={() => {
                  // Saved URL points at an asset that no longer exists. Show the
                  // "No image" state instead of a broken-image glyph, and make
                  // Remove the obvious next step.
                  if (localPreview) setLocalPreview("");
                  setPreviewBroken(true);
                }}
              />
              {status.kind === "uploading" ? (
                <span className="image-busy">
                  <Loader2 size={14} className="spin" /> {status.percent ?? 0}%
                </span>
              ) : null}
            </span>
          ) : (
            <span className="image-empty">
              <ImageIcon size={18} />
              No image
            </span>
          )}

          <div className="image-drop-copy">
            {urlMode ? (
              <>
                <label className="inline-url-field">
                  <span>Image URL</span>
                  <input
                    type="text"
                    inputMode="url"
                    value={value}
                    placeholder="https://res.cloudinary.com/…"
                    aria-invalid={Boolean(imageUrlWarning)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => handleManualUrlChange(event.target.value)}
                  />
                </label>
                <small>Paste a valid public HTTPS image URL. Existing same-site assets such as /media/club.svg are supported too.</small>
              </>
            ) : notConfigured ? (
              <>
                <b>Cloudinary is not configured</b>
                <small>
                  <Settings2 size={12} /> <code>CLOUDINARY_CLOUD_NAME</code> and <code>CLOUDINARY_UPLOAD_PRESET</code> and uploads work straight from this field. A pasted link works too.
                </small>
              </>
            ) : status.kind === "uploading" ? (
              <>
                <b><CloudUpload size={14} /> Uploading… {status.percent ?? 0}%</b>
                <span className="upload-progress"><i style={{ width: `${status.percent ?? 0}%` }} /></span>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    const controller = controllerRef.current;
                    controllerRef.current = null;
                    controller?.abort();
                    setStatus({ kind: "idle" });
                    setLocalPreview("");
                  }}
                >
                  <X size={12} /> Cancel
                </button>
              </>
            ) : (
              <>
                <b><CloudUpload size={14} /> Drop an image here, or click to choose</b>
                <small>Drag it in, or focus this box and paste with <kbd>Ctrl</kbd>+<kbd>V</kbd>. JPG, PNG, SVG, WebP, AVIF — up to {config ? formatBytes(config.maxBytes) : "…"}</small>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={accept}
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
          ) : null}
          {imageUrlWarning ? (
            <p className="image-msg is-warning" role="status">
              <AlertTriangle size={13} /> {imageUrlWarning}{saveCanSkipInvalid ? " This optional club image will be skipped without blocking other club changes." : " Correct the link or upload a valid image before saving."}
            </p>
          ) : status.kind === "done" ? (
            <p className="image-msg is-done"><CheckCircle2 size={13} /> Uploaded to Cloudinary — {status.message}</p>
          ) : value ? (
            <p className="image-msg">
              {isCloudinaryUrl(value) ? "Cloudinary asset — size and format are optimised automatically." : "External link saved."}
            </p>
          ) : help ? (
            <p className="image-msg image-help">{help}</p>
          ) : null}
          {value && imageUrlCheck.valid ? (
            <a className="image-open" href={imageUrlCheck.value} target="_blank" rel="noreferrer">Open ↗</a>
          ) : null}
        </div>

        {value && !urlMode ? (
          <textarea
            className="image-url-raw"
            value={value}
            rows={1}
            spellCheck={false}
            aria-label={`${label} — image URL`}
            aria-invalid={Boolean(imageUrlWarning)}
            onChange={(event) => handleManualUrlChange(event.target.value)}
          />
        ) : null}
      </div>
    </div>
  );
}
