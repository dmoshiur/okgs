"use client";

/**
 * Edit one student — every field the office corrects by hand, plus the photo.
 *
 * The photo uploads straight from the browser to Cloudinary (signed by
 * `/api/media/sign`, so no API secret reaches the client) and previews the moment
 * a file is picked, before the upload finishes. Saving PATCHes
 * `/api/staff/students/:id`, which stores the delivery URL and — when the payment
 * status changed — writes the payments row for the active fair.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageOff, Loader2, Save, Trash2, Upload, X } from "lucide-react";
import { optimizedImage } from "@/lib/cloudinary";
import { formatBytes, uploadToCloudinary } from "@/lib/upload-client";
import { en } from "@/lib/format";
import { Empty, Notice, postJson } from "@/components/sf/console/ui";
import type { StudentListRow } from "@/components/sf/console/StudentsPanel";

export interface StudentEditValues {
  name: string;
  student_code: string;
  roll: string;
  class_name: string;
  section: string;
  shift: string;
  student_group: string;
  branch: string;
  sms_contact: string;
  father_contact: string;
  father_name: string;
  mother_name: string;
  tags: string;
  photo_url: string;
  payment_status: "PAID" | "UNPAID";
}

function errorText(issue: unknown) {
  return issue instanceof Error ? issue.message : "Something went wrong. Please try again.";
}

export function StudentEditModal({
  student,
  fairSlug,
  classes,
  sections,
  shifts,
  onClose,
  onSaved,
}: {
  student: StudentListRow;
  fairSlug: string;
  classes: string[];
  sections: string[];
  shifts: string[];
  onClose: () => void;
  onSaved: (name: string, changed: string[]) => void | Promise<void>;
}) {
  const [values, setValues] = useState<StudentEditValues>(() => ({
    name: student.name,
    student_code: student.student_code,
    roll: student.roll,
    class_name: student.class_name,
    section: student.section,
    shift: student.shift,
    student_group: student.student_group,
    branch: student.branch,
    sms_contact: student.sms_contact,
    father_contact: student.father_contact,
    father_name: student.father_name,
    mother_name: student.mother_name,
    tags: student.tags,
    photo_url: student.photo_url,
    payment_status: student.payment_status,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<{ percent: number } | null>(null);
  const [uploadError, setUploadError] = useState("");
  /** Local object URL — the preview shows before Cloudinary answers. */
  const [preview, setPreview] = useState("");
  const [photoBroken, setPhotoBroken] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => setPhotoBroken(false), [values.photo_url]);

  const set = useCallback(<K extends keyof StudentEditValues>(key: K, value: StudentEditValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  async function pickPhoto(file: File | null | undefined) {
    if (!file) return;
    setUploadError("");
    const local = URL.createObjectURL(file);
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return local;
    });
    setUploading({ percent: 4 });
    controllerRef.current = new AbortController();
    try {
      const result = await uploadToCloudinary({
        file,
        prefix: "students",
        label: values.student_code || values.name || "student",
        tags: ["student", values.class_name || "roster"],
        signal: controllerRef.current.signal,
        onProgress: (percent) => setUploading({ percent }),
      });
      set("photo_url", result.url);
      setPreview("");
    } catch (issue) {
      setUploadError(errorText(issue));
      setPreview("");
    } finally {
      setUploading(null);
      controllerRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function clearPhoto() {
    controllerRef.current?.abort();
    setPreview("");
    set("photo_url", "");
    setUploadError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) {
      setError("The student name cannot be empty.");
      return;
    }
    if (!values.student_code.trim()) {
      setError("The student ID cannot be empty.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await postJson<{ changed: string[] }>(`/api/staff/students/${student.id}`, { ...values, fair_slug: fairSlug }, "PATCH");
      await onSaved(values.name, result.changed ?? []);
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      setBusy(false);
    }
  }

  const shownPhoto = preview || (photoBroken ? "" : optimizedImage(values.photo_url, { width: 300, height: 400, fit: "cover" }));

  return (
    <div className="sf-modal-backdrop no-print" role="presentation" onClick={onClose}>
      <form
        className="sf-modal sf-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-edit-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={save}
      >
        <header className="sf-modal-head">
          <h3 id="student-edit-title">Edit student — {student.name}</h3>
          <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </header>

        {error ? <Notice kind="bad">{error}</Notice> : null}

        <div className="sf-edit-grid">
          <div className="sf-photo-editor">
            <div className="sf-photo-frame">
              {shownPhoto ? (
                <img src={shownPhoto} alt={`${values.name} — photo preview`} onError={() => setPhotoBroken(true)} />
              ) : (
                <span className="sf-photo-empty">
                  <ImageOff size={22} /> No photo yet
                </span>
              )}
              {uploading ? (
                <span className="sf-photo-progress" role="status">
                  <Loader2 size={16} className="sf-spin" /> {en(uploading.percent)}%
                </span>
              ) : null}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sf-file"
              onChange={(event) => void pickPhoto(event.target.files?.[0])}
              aria-label="Upload student photo"
            />
            <div className="sf-photo-actions">
              <button type="button" className="v2-btn v2-btn-sm" disabled={Boolean(uploading)} onClick={() => inputRef.current?.click()}>
                <Upload size={14} /> {uploading ? `Uploading ${en(uploading.percent)}%` : values.photo_url ? "Replace photo" : "Upload photo"}
              </button>
              {values.photo_url ? (
                <button type="button" className="v2-btn v2-btn-sm v2-btn-danger" disabled={Boolean(uploading)} onClick={clearPhoto}>
                  <Trash2 size={14} /> Remove
                </button>
              ) : null}
            </div>
            {uploadError ? <Notice kind="bad">{uploadError}</Notice> : null}
            <label className="sf-photo-url">
              <span className="v2-label">Photo URL (Cloudinary)</span>
              <input className="v2-input" value={values.photo_url} placeholder="https://res.cloudinary.com/…" onChange={(event) => set("photo_url", event.target.value.trim())} />
              <small className="v2-muted">Uploaded files go straight to Cloudinary; the delivery link is what gets saved and printed.</small>
            </label>
          </div>

          <div className="sf-form-grid">
            <label>
              <span className="v2-label">Name *</span>
              <input className="v2-input" required value={values.name} onChange={(event) => set("name", event.target.value)} />
            </label>
            <label>
              <span className="v2-label">Student ID *</span>
              <input className="v2-input" required value={values.student_code} onChange={(event) => set("student_code", event.target.value)} />
            </label>
            <label>
              <span className="v2-label">Roll</span>
              <input className="v2-input" inputMode="numeric" value={values.roll} onChange={(event) => set("roll", event.target.value)} />
            </label>
            <label>
              <span className="v2-label">Class</span>
              <input className="v2-input" list="sf-edit-classes" value={values.class_name} onChange={(event) => set("class_name", event.target.value)} />
              <datalist id="sf-edit-classes">
                {classes.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label>
              <span className="v2-label">Section</span>
              <input className="v2-input" list="sf-edit-sections" value={values.section} onChange={(event) => set("section", event.target.value)} />
              <datalist id="sf-edit-sections">
                {sections.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label>
              <span className="v2-label">Shift</span>
              <input className="v2-input" list="sf-edit-shifts" value={values.shift} onChange={(event) => set("shift", event.target.value)} />
              <datalist id="sf-edit-shifts">
                {shifts.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label>
              <span className="v2-label">Group</span>
              <input className="v2-input" value={values.student_group} onChange={(event) => set("student_group", event.target.value)} />
            </label>
            <label>
              <span className="v2-label">Branch</span>
              <input className="v2-input" value={values.branch} onChange={(event) => set("branch", event.target.value)} />
            </label>
            <label>
              <span className="v2-label">Father&apos;s name</span>
              <input className="v2-input" value={values.father_name} onChange={(event) => set("father_name", event.target.value)} />
            </label>
            <label>
              <span className="v2-label">Mother&apos;s name</span>
              <input className="v2-input" value={values.mother_name} onChange={(event) => set("mother_name", event.target.value)} />
            </label>
            <label>
              <span className="v2-label">SMS contact</span>
              <input className="v2-input" inputMode="tel" value={values.sms_contact} onChange={(event) => set("sms_contact", event.target.value)} />
            </label>
            <label>
              <span className="v2-label">Father&apos;s contact</span>
              <input className="v2-input" inputMode="tel" value={values.father_contact} onChange={(event) => set("father_contact", event.target.value)} />
            </label>
            <label>
              <span className="v2-label">Tags</span>
              <input className="v2-input" value={values.tags} onChange={(event) => set("tags", event.target.value)} />
            </label>
            <label>
              <span className="v2-label">Payment status ({fairSlug})</span>
              <select
                className="v2-select"
                value={values.payment_status}
                onChange={(event) => set("payment_status", event.target.value === "PAID" ? "PAID" : "UNPAID")}
              >
                <option value="PAID">PAID</option>
                <option value="UNPAID">UNPAID</option>
              </select>
              <small className="v2-muted">Saved to the payments table for the active fair — a PAID student becomes printable in bulk.</small>
            </label>
          </div>
        </div>

        {student.entered_at ? <Empty>Last admitted at the gate: {student.entered_at.slice(0, 16).replace("T", " ")} UTC.</Empty> : null}

        <footer className="sf-modal-foot">
          <button type="button" className="v2-btn v2-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="v2-btn" disabled={busy || Boolean(uploading)}>
            <Save size={15} /> {busy ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </form>
    </div>
  );
}
