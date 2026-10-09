"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Info,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

import { uploadToCloudinary } from "@/lib/upload-client";

/* ------------------------------------------------------------------ layout -- */

/** One titled card in the studio's main column. */
export function StudioCard({
  id,
  title,
  hint,
  action,
  children,
  tone = "plain",
}: {
  id?: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  tone?: "plain" | "accent";
}) {
  return (
    <section className={`cst-card${tone === "accent" ? " is-accent" : ""}`} id={id}>
      <header className="cst-card-head">
        <div>
          <h2>{title}</h2>
          {hint ? <p>{hint}</p> : null}
        </div>
        {action ? <div className="cst-card-action">{action}</div> : null}
      </header>
      <div className="cst-card-body">{children}</div>
    </section>
  );
}

export function StudioGrid({ columns = 2, children }: { columns?: 1 | 2 | 3 | 4; children: React.ReactNode }) {
  return <div className={`cst-grid cst-grid-${columns}`}>{children}</div>;
}

export function StudioNote({ children, kind = "info" }: { children: React.ReactNode; kind?: "info" | "ok" | "warn" }) {
  return (
    <p className={`cst-note is-${kind}`}>
      <Info size={14} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function StudioEmpty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="cst-empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ fields -- */

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  type?: "text" | "url" | "email" | "tel" | "date";
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="cst-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="cst-field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="cst-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={Number.isFinite(value) && value ? value : ""}
        onChange={(event) => {
          const next = Math.floor(Number(event.target.value));
          onChange(Number.isFinite(next) ? Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, next)) : min);
        }}
      />
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="cst-field">
      <label htmlFor={id}>{label}</label>
      <div className="cst-color">
        <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#0f766e"} onChange={(event) => onChange(event.target.value)} />
        <input
          className="cst-color-text"
          value={value}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value.trim())}
          placeholder="#0f766e"
        />
      </div>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ picker -- */

export function ImagePicker({
  slug,
  label,
  value,
  hint,
  aspect = "square",
  onChange,
  onUploaded,
}: {
  slug: string;
  label: string;
  value: string;
  hint?: string;
  aspect?: "square" | "wide";
  onChange: (url: string) => void;
  /** Called with the freshly uploaded file — used to sample the logo palette. */
  onUploaded?: (file: File, url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  // A saved URL can point at an asset that was deleted from Cloudinary. The
  // picker then shows its placeholder instead of a broken-image glyph, and the
  // state re-arms as soon as a different URL is set.
  const [broken, setBroken] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBroken(false);
  }, [value]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    setError("");
    try {
      const result = await uploadToCloudinary({
        file,
        prefix: slug,
        label: `${slug}-${label}`,
        onProgress: setPercent,
      });
      onChange(result.url);
      onUploaded?.(file, result.url);
    } catch (issue) {
      // The upload failed, so the blob preview no longer represents anything.
      setPreview("");
      setBroken(false);
      setError(issue instanceof Error ? issue.message : "আপলোড করা যায়নি।");
    } finally {
      setBusy(false);
      setPercent(0);
      setPreview("");
    }
  };

  return (
    <div className="cst-picker">
      <span className="cst-picker-label">{label}</span>
      <div className="cst-picker-row">
        <span className={`cst-picker-shot is-${aspect}`}>
          {preview || (value && !broken) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview || value}
              alt=""
              onError={() => {
                if (preview) setPreview("");
                setBroken(true);
              }}
            />
          ) : (
            <ImageIcon size={20} aria-hidden />
          )}
        </span>
        <div className="cst-picker-side">
          <div className="cst-picker-actions">
            <button type="button" className="cst-btn cst-btn-soft" disabled={busy} onClick={() => input.current?.click()}>
              <Upload size={14} aria-hidden />
              {busy ? `আপলোড ${percent}%` : value ? "ছবি বদলান" : "ছবি আপলোড"}
            </button>
            {value ? (
              <button
                type="button"
                className="cst-btn cst-btn-quiet"
                onClick={() => {
                  // Clear the saved reference completely — the file input and
                  // the local preview too, so nothing stale is saved back.
                  if (input.current) input.current.value = "";
                  setPreview("");
                  setBroken(false);
                  onChange("");
                }}
              >
                <Trash2 size={13} aria-hidden /> সরান
              </button>
            ) : null}
            <input
              ref={input}
              hidden
              type="file"
              accept="image/*"
              onChange={(event) => {
                void pick(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          {hint ? <small className="cst-picker-hint">{hint}</small> : null}
          {error ? <small className="cst-picker-error">{error}</small> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- lists -- */

/** Free-text list (mission, objectives) with reordering instead of a raw blob. */
export function LinesEditor({
  label,
  values,
  onChange,
  placeholder,
  ordered = false,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  ordered?: boolean;
  hint?: string;
}) {
  const move = (index: number, delta: number) => {
    const next = [...values];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="cst-lines">
      <header className="cst-lines-head">
        <span>{label}</span>
        <button type="button" className="cst-btn cst-btn-soft" onClick={() => onChange([...values, ""])}>
          <Plus size={14} aria-hidden /> নতুন লাইন
        </button>
      </header>
      {hint ? <small className="cst-lines-hint">{hint}</small> : null}

      <ol className="cst-lines-list">
        {values.map((value, index) => (
          <li key={index}>
            <span className="cst-lines-index" aria-hidden>{ordered ? index + 1 : "•"}</span>
            <textarea
              rows={1}
              value={value}
              placeholder={placeholder}
              onChange={(event) => onChange(values.map((row, i) => (i === index ? event.target.value : row)))}
            />
            <span className="cst-lines-tools">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="উপরে নিন"><ChevronUp size={14} /></button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === values.length - 1} aria-label="নিচে নিন"><ChevronDown size={14} /></button>
              <button type="button" onClick={() => onChange(values.filter((_, i) => i !== index))} aria-label="সরান"><Trash2 size={14} /></button>
            </span>
          </li>
        ))}
      </ol>

      {!values.length ? <StudioEmpty>এখনো কিছু লেখা হয়নি — “নতুন লাইন” চাপুন।</StudioEmpty> : null}
    </div>
  );
}

/** Repeater row chrome: number, title, reorder + delete tools. */
export function RepeaterRow({
  index,
  total,
  title,
  subtitle,
  onMove,
  onRemove,
  children,
}: {
  index: number;
  total: number;
  title: string;
  subtitle?: string;
  onMove: (delta: number) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className="cst-row">
      <header className="cst-row-head">
        <span className="cst-row-index" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
        <div className="cst-row-title">
          <strong>{title || "শিরোনামহীন"}</strong>
          {subtitle ? <small>{subtitle}</small> : null}
        </div>
        <div className="cst-row-tools">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="উপরে নিন"><ChevronUp size={14} /></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="নিচে নিন"><ChevronDown size={14} /></button>
          <button type="button" className="is-danger" onClick={onRemove} aria-label="সরান"><Trash2 size={14} /></button>
        </div>
      </header>
      <div className="cst-row-body">{children}</div>
    </article>
  );
}

/** Small status pill used on the header and the checklist. */
export function StatePill({ state, children }: { state: "ok" | "wait" | "todo"; children: React.ReactNode }) {
  return <span className={`cst-pill is-${state}`}>{children}</span>;
}
