"use client";

import type { FieldDef } from "@/lib/content-config";
import { slugify } from "@/lib/content-config";
import type { Club, Fair, ResourceName } from "@/lib/types";
import { ImageField } from "@/components/admin/ImageField";
import { bn } from "@/lib/format";
import { extractDominantLogoColor } from "@/lib/club-colors";

interface FieldControlProps {
  def: FieldDef;
  resource?: ResourceName;
  value: any;
  update: (field: string, value: any) => void;
  clubs: Club[];
  /** Fairs power `reference: "fairs"` selects (fair categories, schedule, collections). */
  fairs?: Pick<Fair, "name" | "slug">[];
  /** Whole form, so fields that depend on siblings (settings.value type) can read them. */
  form: Record<string, any>;
  invalid?: boolean;
  prefix?: string;
  title?: string;
}

function fairPlaceholder(def: FieldDef) {
  return def.reference === "clubs" ? "— General / all clubs —" : "— Current fair —";
}

/** `2026-10-01T09:00` / ISO strings → the exact shape <input type=date|datetime-local> wants. */
function toInputValue(value: unknown, type: "date" | "datetime") {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, type === "date" ? 10 : 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (type === "date") return day;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function FieldControl({ def, resource, value, update, clubs, fairs, form, invalid, prefix, title }: FieldControlProps) {
  // Settings rows decide themselves whether their `value` holds text, a link or an image.
  if (def.name === "value" && form.field_kind === "image") {
    return (
      <div className={`field-block ${invalid ? "is-invalid" : ""}`}>
        <ImageField value={String(value ?? "")} onChange={(next) => update("value", next)} label={def.label} help={def.help} prefix={prefix} title={title} />
      </div>
    );
  }
  if (def.name === "value" && form.field_kind === "url") {
    return <TextField def={{ ...def, type: "url" }} value={value} update={update} invalid={invalid} />;
  }
  if (def.name === "value" && form.field_kind === "text") {
    return <TextField def={{ ...def, type: "text" }} value={value} update={update} invalid={invalid} />;
  }

  const isClubLogo = resource === "clubs" && def.name === "logo_url";

  switch (def.type) {
    case "boolean":
      return (
        <label className={`toggle-field ${value ? "is-on" : ""}`}>
          <span>
            <b>{def.label}</b>
            {def.help ? <small>{def.help}</small> : null}
          </span>
          <input type="checkbox" checked={Boolean(value)} onChange={(event) => update(def.name, event.target.checked)} />
          <i />
        </label>
      );
    case "image":
      return (
        <div className={`field-block ${invalid ? "is-invalid" : ""}`}>
          <ImageField
            value={String(value ?? "")}
            onChange={(next) => update(def.name, next)}
            label={def.label}
            help={def.help}
            prefix={prefix}
            title={title}
            accept={isClubLogo ? "image/png,image/svg+xml,.png,.svg" : "image/*"}
            previewFit={isClubLogo ? "contain" : "cover"}
            onFileSelected={isClubLogo ? (file) => {
              void extractDominantLogoColor(file).then((color) => {
                if (color) update("accent", color);
              });
            } : undefined}
          />
        </div>
      );
    case "select":
      return (
        <BaseField def={def} invalid={invalid}>
          <select value={String(value ?? "")} onChange={(event) => update(def.name, event.target.value)}>
            {!def.required ? <option value="">— Select —</option> : null}
            {(def.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </BaseField>
      );
    case "reference": {
      const live =
        def.reference === "clubs"
          ? clubs.map((club) => ({ label: club.name, value: club.slug }))
          : def.reference === "fairs"
            ? (fairs ?? []).map((fair) => ({ label: fair.name, value: fair.slug }))
            : [];
      const options = live.length ? live : def.options ?? [];
      const empty = def.reference === "clubs" ? clubs.length === 0 : def.reference === "fairs" ? (fairs ?? []).length === 0 : options.length === 0;
      return (
        <BaseField def={def} invalid={invalid}>
          <select value={String(value ?? "")} onChange={(event) => update(def.name, event.target.value)}>
            {!def.required ? <option value="">{fairPlaceholder(def)}</option> : <option value="">Select an option</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {empty ? (
            <small className="field-warn">
              {def.reference === "clubs"
                ? "Create a club first — without one this content cannot appear on any club page."
                : "Create a science fair first."}
            </small>
          ) : null}
        </BaseField>
      );
    }
    case "color":
      return (
        <BaseField def={def} invalid={invalid}>
          <span className="color-input">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? String(value) : "#e7c27e"} onChange={(event) => update(def.name, event.target.value)} />
            <input type="text" value={String(value ?? "")} placeholder="#e7c27e" onChange={(event) => update(def.name, event.target.value)} />
          </span>
        </BaseField>
      );
    case "number":
      return (
        <BaseField def={def} invalid={invalid}>
          <input type="number" min={0} step={1} value={value === "" || value === null || value === undefined ? "" : Number(value)} onChange={(event) => update(def.name, event.target.value === "" ? "" : Number(event.target.value))} />
        </BaseField>
      );
    case "date":
    case "datetime":
      return (
        <BaseField def={def} invalid={invalid}>
          <input
            type={def.type === "date" ? "date" : "datetime-local"}
            value={toInputValue(value, def.type)}
            onChange={(event) => update(def.name, event.target.value)}
          />
        </BaseField>
      );
    case "textarea":
      return (
        <BaseField def={def} invalid={invalid}>
          <textarea
            rows={def.rows ?? (def.name === "body" ? 10 : 4)}
            value={String(value ?? "")}
            placeholder={def.placeholder || `Write ${def.label.toLowerCase()} here…`}
            onChange={(event) => update(def.name, event.target.value)}
          />
          {def.name === "objectives" ? <small className="field-hint">{bn(String(value ?? "").split(/\r?\n/).filter((line) => line.trim()).length)} points</small> : null}
        </BaseField>
      );
    case "url":
      return (
        <BaseField def={def} invalid={invalid}>
          <input type="text" inputMode="url" value={String(value ?? "")} placeholder={def.placeholder || "https://…"} onChange={(event) => update(def.name, event.target.value)} />
          {String(value ?? "").trim() && !/^https?:\/\//i.test(String(value)) ? (
            <small className="field-hint">https:// is added automatically when you save.</small>
          ) : null}
        </BaseField>
      );
    case "text":
    default:
      return <TextField def={def} value={value} update={update} invalid={invalid} form={form} />;
  }
}

function TextField({ def, value, update, invalid, form }: { def: FieldDef; value: any; update: FieldControlProps["update"]; invalid?: boolean; form?: Record<string, any> }) {
  const showSlugTool = def.name === "slug";
  const source = String(form?.title || form?.name || form?.label || "").trim();
  return (
    <BaseField def={def} invalid={invalid}>
      <input
        type="text"
        value={String(value ?? "")}
        placeholder={def.placeholder || `Enter ${def.label.toLowerCase()}`}
        pattern={def.pattern ? def.pattern.replace(/^\^|\$$/g, "") : undefined}
        onChange={(event) => update(def.name, event.target.value)}
      />
      {showSlugTool ? (
        <span className="field-tools">
          <button type="button" disabled={!source} onClick={() => update("slug", slugify(source))}>Build from title</button>
          <button type="button" onClick={() => update("slug", `club-${Date.now().toString(36).slice(-5)}`)}>Random name</button>
        </span>
      ) : null}
    </BaseField>
  );
}

function BaseField({ def, invalid, children }: { def: FieldDef; invalid?: boolean; children: React.ReactNode }) {
  return (
    <label className={`editor-field ${def.full ? "field-wide" : ""} ${invalid ? "is-invalid" : ""}`}>
      <span>
        {def.label}
        {def.required ? <em>*</em> : null}
      </span>
      {children}
      {def.help ? <small className="field-hint">{def.help}</small> : null}
    </label>
  );
}
