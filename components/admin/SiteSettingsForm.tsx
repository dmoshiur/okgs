"use client";

/**
 * SiteSettingsForm — the dynamic site identity (SuperAdmin only).
 *
 * Values are persisted as `settings` rows in the primary database, so the
 * header, footer, metadata, favicon, JSON-LD card and QR passes all read the new
 * values on their next render — no deploy, no code change.
 */
import { useMemo, useState } from "react";
import { AlertCircle, Check, Globe2, Image as ImageIcon, Loader2, Phone, RotateCcw, Save, Sparkles } from "lucide-react";
import { ImageField } from "@/components/admin/ImageField";
import type { SiteSettingField } from "@/lib/site-settings";

const groupMeta: Record<SiteSettingField["group"], { label: string; hint: string; icon: typeof Globe2 }> = {
  identity: { label: "Identity", hint: "The name people see in the header, the browser tab and search results.", icon: Globe2 },
  contact: { label: "Contact & address", hint: "Phone numbers, address, office hours and social profiles.", icon: Phone },
  branding: { label: "Branding assets", hint: "Logo and favicon. Upload straight to Cloudinary, or paste a URL.", icon: ImageIcon },
};

export function SiteSettingsForm({
  fields,
  initialValues,
}: {
  fields: SiteSettingField[];
  initialValues: Record<string, string>;
}) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [saved, setSaved] = useState("");

  const groups = useMemo(() => {
    const order: SiteSettingField["group"][] = ["identity", "contact", "branding"];
    return order.map((group) => ({ group, fields: fields.filter((field) => field.group === group) }));
  }, [fields]);

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved("");
    setFieldError("");
    setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setFieldError("");
    try {
      const response = await fetch("/api/superadmin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        errorEn?: string;
        error?: string;
        field?: string;
        values?: Record<string, string>;
      };
      if (!response.ok || !data.ok) {
        setError(data.errorEn || data.error || "The settings could not be saved.");
        setFieldError(data.field ?? "");
        return;
      }
      if (data.values) setValues(data.values);
      setDirty(false);
      setSaved("Saved — the public site is already using the new values.");
    } catch {
      setError("The server could not be reached. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={save}>
      <div className="settings-preview">
        <span className="settings-preview-icon">
          <Sparkles size={16} />
        </span>
        <div>
          <b>{values.site_name || "Untitled site"}</b>
          <small>{values.site_title || values.tagline || "Add a browser title to complete the metadata"}</small>
        </div>
        {values.logo_url ? <img src={values.logo_url} alt="" className="settings-preview-logo" /> : null}
      </div>

      {groups.map(({ group, fields: groupFields }) => {
        const meta = groupMeta[group];
        const Icon = meta.icon;
        return (
          <section className="panel settings-panel" key={group}>
            <div className="panel-heading">
              <div>
                <span className="panel-eyebrow">
                  <Icon size={13} /> {meta.label}
                </span>
                <h2>{meta.hint}</h2>
              </div>
            </div>

            <div className="settings-grid">
              {groupFields.map((field) => {
                const invalid = fieldError === field.key;
                if (field.kind === "image") {
                  return (
                    <div className={`field-block settings-field ${field.full ? "is-wide" : ""} ${invalid ? "is-invalid" : ""}`} key={field.key}>
                      <ImageField
                        value={values[field.key] ?? ""}
                        onChange={(next) => update(field.key, next)}
                        label={field.label}
                        help={field.help}
                        prefix="branding"
                        title={values.site_name || "okgs"}
                        previewFit={field.key === "favicon_url" ? "contain" : "contain"}
                      />
                    </div>
                  );
                }
                return (
                  <div className={`field-block settings-field ${field.full ? "is-wide" : ""} ${invalid ? "is-invalid" : ""}`} key={field.key}>
                    <label className="v2-label" htmlFor={`site-${field.key}`}>
                      {field.label}
                    </label>
                    {field.kind === "textarea" ? (
                      <textarea
                        id={`site-${field.key}`}
                        className="v2-input"
                        rows={3}
                        value={values[field.key] ?? ""}
                        placeholder={field.placeholder}
                        onChange={(event) => update(field.key, event.target.value)}
                      />
                    ) : (
                      <input
                        id={`site-${field.key}`}
                        className="v2-input"
                        type={field.kind === "email" ? "email" : field.kind === "tel" ? "tel" : "text"}
                        value={values[field.key] ?? ""}
                        placeholder={field.placeholder}
                        onChange={(event) => update(field.key, event.target.value)}
                      />
                    )}
                    {field.help ? <small className="field-help">{field.help}</small> : null}
                    {invalid ? <small className="field-error">Please check this value.</small> : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {error ? (
        <p className="studio-error" role="alert">
          <AlertCircle size={15} /> {error}
        </p>
      ) : null}
      {saved ? (
        <p className="form-ok" role="status">
          <Check size={15} /> {saved}
        </p>
      ) : null}

      <div className="settings-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setValues(initialValues);
            setDirty(false);
            setSaved("");
            setError("");
          }}
          disabled={saving || !dirty}
        >
          <RotateCcw size={14} /> Reset changes
        </button>
        <button className="admin-primary-button" type="submit" disabled={saving || !dirty}>
          {saving ? (
            <>
              <Loader2 size={15} className="spin" /> Saving…
            </>
          ) : (
            <>
              <Save size={15} /> Save site settings
            </>
          )}
        </button>
      </div>
    </form>
  );
}
