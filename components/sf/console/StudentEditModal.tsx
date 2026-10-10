"use client";

/**
 * Edit one student — every field the office corrects by hand, including the
 * student's, father's and mother's photos.
 *
 * Each photo uploads straight from the browser to Cloudinary (signed by
 * `/api/media/sign`, so no API secret reaches the client) and previews as soon as
 * a file is picked. Saving PATCHes the secure delivery URLs alongside the
 * student's details and active-fair payment status.
 */
import { useCallback, useState } from "react";
import { Save, X } from "lucide-react";
import { Empty, Notice, postJson } from "@/components/sf/console/ui";
import { StudentPhotoUploadField } from "@/components/sf/console/StudentPhotoUploadField";
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
  father_photo_url: string;
  mother_photo_url: string;
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
    father_photo_url: student.father_photo_url,
    mother_photo_url: student.mother_photo_url,
    payment_status: student.payment_status,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState({ student: false, father: false, mother: false });
  const uploading = Object.values(uploadingPhotos).some(Boolean);

  const set = useCallback(<K extends keyof StudentEditValues>(key: K, value: StudentEditValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (uploading) {
      setError("Wait for all student and parent photo uploads to finish before saving.");
      return;
    }
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
          <div className="sf-photo-editors">
            <StudentPhotoUploadField
              label="Student's Photo"
              tag="student"
              uploadLabel={values.student_code || values.name || "student"}
              value={values.photo_url}
              onChange={(url) => set("photo_url", url)}
              onUploadingChange={(isUploading) => setUploadingPhotos((current) => ({ ...current, student: isUploading }))}
            />
            <StudentPhotoUploadField
              label="Father's Photo"
              tag="father"
              uploadLabel={values.student_code || values.name || "student"}
              value={values.father_photo_url}
              onChange={(url) => set("father_photo_url", url)}
              onUploadingChange={(isUploading) => setUploadingPhotos((current) => ({ ...current, father: isUploading }))}
            />
            <StudentPhotoUploadField
              label="Mother's Photo"
              tag="mother"
              uploadLabel={values.student_code || values.name || "student"}
              value={values.mother_photo_url}
              onChange={(url) => set("mother_photo_url", url)}
              onUploadingChange={(isUploading) => setUploadingPhotos((current) => ({ ...current, mother: isUploading }))}
            />
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
          <button type="submit" className="v2-btn" disabled={busy || uploading}>
            <Save size={15} /> {busy ? "Saving…" : uploading ? "Wait for photo uploads…" : "Save changes"}
          </button>
        </footer>
      </form>
    </div>
  );
}
