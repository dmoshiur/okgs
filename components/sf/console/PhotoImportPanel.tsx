"use client";

/**
 * Bulk photo mapping — point a spreadsheet of Cloudinary links at the roster.
 *
 * The sheet carries `student_id` (or `roll`) and `photo_url`. "Check without
 * saving" runs the same parse and the same student lookup with `dry_run=1`, so
 * the office sees exactly which IDs will change and which rows matched nobody
 * before a single row is written.
 */
import { useRef, useState } from "react";
import { Download, Eye, FileSpreadsheet, Upload } from "lucide-react";
import { en } from "@/lib/format";
import { photoTemplateCsv } from "@/lib/photo-import";
import { Empty, Notice, Panel } from "@/components/sf/console/ui";

interface PhotoImportResult {
  file: string;
  total: number;
  read: number;
  matched: number;
  updated: number;
  unchanged: number;
  missing: { key: string; row: number }[];
  errors: { row: number; message: string }[];
  error_count: number;
  non_cloudinary: number;
  header_row: number;
  columns: { code: string; roll: string; photo: string };
  dry_run: boolean;
}

function errorText(issue: unknown) {
  return issue instanceof Error ? issue.message : "Something went wrong. Please try again.";
}

export function PhotoImportPanel({ onApplied }: { onApplied?: (updated: number) => void | Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"check" | "apply" | "">("");
  const [result, setResult] = useState<PhotoImportResult | null>(null);
  const [problem, setProblem] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function submit(dryRun: boolean) {
    if (!file) {
      setProblem("Choose a .csv or .xlsx file first.");
      return;
    }
    setBusy(dryRun ? "check" : "apply");
    setProblem("");
    try {
      const body = new FormData();
      body.append("file", file);
      if (dryRun) body.append("dry_run", "1");
      const response = await fetch("/api/staff/students/photos", { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as Partial<PhotoImportResult> & { error?: string; ok?: boolean };
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "The file could not be read.");
      setResult(payload as PhotoImportResult);
      if (!dryRun) {
        await onApplied?.(Number(payload.updated ?? 0));
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch (issue) {
      setProblem(errorText(issue));
    } finally {
      setBusy("");
    }
  }

  function downloadTemplate() {
    const blob = new Blob([photoTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-photo-links.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Panel title="Update student photos from a spreadsheet">
      <div className="sf-import-box">
        <p className="v2-muted sf-help">
          Columns: <code>student_id</code> (the school ID) or <code>roll</code>, plus <code>photo_url</code> — a Cloudinary link such as{" "}
          <code>https://res.cloudinary.com/&lt;cloud&gt;/image/upload/v1/okgs/students/2026-0101.jpg</code>. The header row is found
          automatically in the first ten rows; rows whose ID matches no student are listed, never guessed.
        </p>

        <div className="sf-import-row">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
              setProblem("");
            }}
          />
          <button type="button" className="v2-btn v2-btn-ghost" disabled={Boolean(busy)} onClick={downloadTemplate}>
            <Download size={15} /> Template CSV
          </button>
          <button type="button" className="v2-btn v2-btn-ghost" disabled={!file || Boolean(busy)} onClick={() => void submit(true)}>
            <Eye size={15} /> {busy === "check" ? "Checking…" : "Check without saving"}
          </button>
          <button type="button" className="v2-btn" disabled={!file || Boolean(busy)} onClick={() => void submit(false)}>
            <Upload size={15} /> {busy === "apply" ? "Saving photos…" : "Save photo links"}
          </button>
        </div>

        {problem ? <Notice kind="bad">{problem}</Notice> : null}

        {result ? (
          <div className="sf-import-result">
            <strong>
              <FileSpreadsheet size={14} /> {result.file}
            </strong>
            <span>
              {en(result.read)} of {en(result.total)} row(s) usable · header on row {en(result.header_row)} ·{" "}
              {result.dry_run ? "would update" : "updated"} <b>{en(result.updated)}</b> photo(s) · {en(result.unchanged)} already correct ·{" "}
              {en(result.missing.length)} unmatched
              {result.non_cloudinary ? ` · ${en(result.non_cloudinary)} link(s) not on Cloudinary` : ""}
            </span>
            {result.dry_run ? (
              <span className="sf-badge is-warn">Dry run — nothing was written yet.</span>
            ) : (
              <span className="sf-badge is-good">Saved to the roster.</span>
            )}
            {result.missing.length ? (
              <ul>
                {result.missing.slice(0, 20).map((item) => (
                  <li key={`${item.row}-${item.key}`}>
                    Row {en(item.row)}: no student matches <code>{item.key}</code>.
                  </li>
                ))}
              </ul>
            ) : null}
            {result.errors.length ? (
              <ul>
                {result.errors.slice(0, 20).map((item) => (
                  <li key={`${item.row}-${item.message}`}>
                    Row {en(item.row)}: {item.message}
                  </li>
                ))}
                {result.error_count > result.errors.length ? <li>…and {en(result.error_count - result.errors.length)} more.</li> : null}
              </ul>
            ) : null}
            {!result.missing.length && !result.errors.length ? <Empty>Every row matched a student.</Empty> : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
