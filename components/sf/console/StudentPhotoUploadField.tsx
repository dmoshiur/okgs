"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { en } from "@/lib/format";
import { optimizedImage } from "@/lib/cloudinary";
import { uploadToCloudinary } from "@/lib/upload-client";
import { Notice } from "@/components/sf/console/ui";

function errorText(issue: unknown) {
  return issue instanceof Error ? issue.message : "Something went wrong. Please try again.";
}

/**
 * One consistent Cloudinary-backed photo field for the student and both parents.
 * The upload is direct-to-Cloudinary; only the secure delivery URL is sent to
 * the student PATCH endpoint when the form is saved.
 */
export function StudentPhotoUploadField({
  label,
  value,
  uploadLabel,
  tag,
  onChange,
  onUploadingChange,
}: {
  label: string;
  value: string;
  uploadLabel: string;
  tag: string;
  onChange: (url: string) => void;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const [preview, setPreview] = useState("");
  const [broken, setBroken] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setBroken(false);
  }, [value]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function pickPhoto(file: File | null | undefined) {
    if (!file) return;
    setError("");
    const local = URL.createObjectURL(file);
    setPreview(local);
    setProgress(4);
    onUploadingChange(true);

    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await uploadToCloudinary({
        file,
        prefix: "students",
        label: `${uploadLabel}-${tag}`,
        tags: ["student", tag],
        signal: controller.signal,
        onProgress: (percent) => {
          if (mountedRef.current) setProgress(percent);
        },
      });
      if (mountedRef.current) {
        onChange(result.url);
        setPreview("");
      }
    } catch (issue) {
      if (mountedRef.current) {
        setError(errorText(issue));
        setPreview("");
      }
    } finally {
      controllerRef.current = null;
      if (mountedRef.current) {
        setProgress(null);
        onUploadingChange(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    }
  }

  function removePhoto() {
    controllerRef.current?.abort();
    setPreview("");
    setError("");
    onChange("");
  }

  const image = preview || (broken ? "" : optimizedImage(value, { width: 300, height: 400, fit: "cover" }));

  return (
    <section className="sf-photo-editor" aria-label={label}>
      <strong className="v2-label">{label}</strong>
      <div className="sf-photo-frame">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`${label} preview`} onError={() => setBroken(true)} />
        ) : (
          <span className="sf-photo-empty">
            <ImageOff size={22} /> No photo yet
          </span>
        )}
        {progress !== null ? (
          <span className="sf-photo-progress" role="status">
            <Loader2 size={16} className="sf-spin" /> {en(progress)}%
          </span>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sf-file"
        onChange={(event) => void pickPhoto(event.target.files?.[0])}
        aria-label={`Choose ${label.toLowerCase()}`}
      />
      <div className="sf-photo-actions">
        <button type="button" className="v2-btn v2-btn-sm" disabled={progress !== null} onClick={() => inputRef.current?.click()}>
          <Upload size={14} /> {progress !== null ? `Uploading ${en(progress)}%` : value ? "Replace photo" : "Upload photo"}
        </button>
        {value ? (
          <button type="button" className="v2-btn v2-btn-sm v2-btn-danger" disabled={progress !== null} onClick={removePhoto}>
            <Trash2 size={14} /> Remove
          </button>
        ) : null}
      </div>
      {error ? <Notice kind="bad">{error}</Notice> : null}
      <label className="sf-photo-url">
        <span className="v2-label">{label} URL (Cloudinary)</span>
        <input
          className="v2-input"
          type="url"
          inputMode="url"
          value={value}
          placeholder="https://res.cloudinary.com/…"
          onChange={(event) => onChange(event.target.value.trim())}
        />
        <small className="v2-muted">Uploaded photos use the secure Cloudinary delivery URL, which is saved with the student record.</small>
      </label>
    </section>
  );
}
