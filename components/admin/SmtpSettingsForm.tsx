"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Mail, Send, ShieldCheck } from "lucide-react";

interface SmtpFormState {
  host: string;
  port: string;
  secure: boolean;
  username: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  enabled: boolean;
  password_set: boolean;
}

const initial: SmtpFormState = {
  host: "", port: "587", secure: false, username: "", from_name: "OKGS", from_email: "", reply_to: "", enabled: false, password_set: false,
};

/**
 * A proxy or crashed upstream can return an HTML 502 page to a JSON API call.
 * Read the body as text first so the UI can show a useful diagnostic instead
 * of masking the original failure with `Unexpected token '<'` from response.json().
 */
async function readApiJson(response: Response): Promise<Record<string, unknown>> {
  const body = await response.text();
  let data: unknown;

  try {
    data = JSON.parse(body);
  } catch {
    const requestId = ["x-request-id", "x-correlation-id", "x-vercel-id", "cf-ray", "x-amzn-requestid"]
      .map((header) => response.headers.get(header))
      .find(Boolean);
    const reference = requestId ? ` Request ID: ${requestId}.` : "";
    if ([502, 503, 504].includes(response.status)) {
      throw new Error(`The SMTP API returned a non-JSON HTTP ${response.status} response. The application server or reverse proxy may be unavailable; check both sets of logs.${reference}`);
    }
    throw new Error(`The SMTP API returned an invalid non-JSON response (HTTP ${response.status}).${reference}`);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`The SMTP API returned an unexpected response (HTTP ${response.status}).`);
  }
  return data as Record<string, unknown>;
}

function throwApiError(response: Response, data: Record<string, unknown>, fallback: string) {
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `${fallback} (HTTP ${response.status}).`);
  }
}

export function SmtpSettingsForm() {
  const [form, setForm] = useState(initial);
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/superadmin/smtp", { cache: "no-store" })
      .then(async (response) => {
        const data = await readApiJson(response);
        throwApiError(response, data, "SMTP settings could not be loaded.");
        const settings = data.settings && typeof data.settings === "object"
          ? data.settings as Partial<SmtpFormState>
          : undefined;
        if (alive) {
          setForm({ ...initial, ...(settings || {}), port: String(settings?.port ?? 587) });
          setTestTo(settings?.from_email || "");
        }
      })
      .catch((issue) => alive && setError(issue instanceof Error ? issue.message : "SMTP settings could not be loaded."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  function update<K extends keyof SmtpFormState>(key: K, value: SmtpFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setMessage("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/superadmin/smtp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, port: Number(form.port), password, clear_password: clearPassword }),
      });
      const data = await readApiJson(response);
      throwApiError(response, data, "SMTP settings could not be saved.");
      setPassword("");
      setClearPassword(false);
      setForm((current) => ({ ...current, password_set: Boolean(data.password_set) }));
      setMessage("SMTP settings saved. The mail transport is ready to test.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "SMTP settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function test(event: React.FormEvent) {
    event.preventDefault();
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/superadmin/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", to: testTo }),
      });
      const data = await readApiJson(response);
      throwApiError(response, data, "The test email could not be sent.");
      setMessage(`Test email delivered via ${data.provider}.`);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The test email could not be sent.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="panel settings-panel smtp-settings-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-eyebrow"><Mail size={13} /> SMTP & notifications</span>
          <h2>Central email delivery for password resets, imports and role-based broadcasts.</h2>
        </div>
        {form.password_set ? <span className="badge-soft status-ok"><ShieldCheck size={13} /> Password encrypted</span> : null}
      </div>

      {loading ? <p className="v2-muted">Loading mail settings…</p> : (
        <form className="smtp-form" onSubmit={save}>
          <div className="settings-grid">
            <label className="field-block"><span className="v2-label">SMTP host</span><input className="v2-input" value={form.host} onChange={(event) => update("host", event.target.value)} placeholder="smtp.example.com" autoComplete="off" /></label>
            <label className="field-block"><span className="v2-label">Port</span><input className="v2-input" type="number" min={1} max={65535} value={form.port} onChange={(event) => update("port", event.target.value)} /></label>
            <label className="field-block"><span className="v2-label">Username</span><input className="v2-input" value={form.username} onChange={(event) => update("username", event.target.value)} autoComplete="username" /></label>
            <label className="field-block"><span className="v2-label">Password {form.password_set ? "(leave blank to keep current)" : ""}</span><input className="v2-input" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setClearPassword(false); }} autoComplete="new-password" placeholder={form.password_set ? "Saved securely" : "SMTP password or app password"} /></label>
            <label className="field-block"><span className="v2-label">Sender name</span><input className="v2-input" value={form.from_name} onChange={(event) => update("from_name", event.target.value)} placeholder="OKGS" /></label>
            <label className="field-block"><span className="v2-label">Sender email</span><input className="v2-input" type="email" value={form.from_email} onChange={(event) => update("from_email", event.target.value)} placeholder="no-reply@example.com" /></label>
            <label className="field-block"><span className="v2-label">Reply-to (optional)</span><input className="v2-input" type="email" value={form.reply_to} onChange={(event) => update("reply_to", event.target.value)} /></label>
            <label className="field-block smtp-toggle"><input type="checkbox" checked={form.secure} onChange={(event) => update("secure", event.target.checked)} /> Use implicit TLS (usually port 465)</label>
          </div>
          <div className="smtp-controls">
            <label className="smtp-enable"><input type="checkbox" checked={form.enabled} onChange={(event) => update("enabled", event.target.checked)} /> Enable SMTP delivery</label>
            {form.password_set ? <label className="smtp-clear"><input type="checkbox" checked={clearPassword} onChange={(event) => { setClearPassword(event.target.checked); if (event.target.checked) setPassword(""); }} /> Remove saved password</label> : null}
            <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />} Save SMTP settings</button>
          </div>
          <p className="field-help">Credentials are encrypted at rest using AES-256-GCM. Set <code>SMTP_CONFIG_SECRET</code> (recommended) or <code>SESSION_SECRET</code> in the deployment environment. The password is never returned to the browser.</p>
        </form>
      )}

      <form className="smtp-test" onSubmit={test}>
        <label className="field-block"><span className="v2-label">Send a test email to</span><input className="v2-input" type="email" required value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="admin@example.com" /></label>
        <button className="secondary-button" type="submit" disabled={testing || loading}><Send size={14} /> {testing ? "Sending…" : "Send test"}</button>
      </form>
      {error ? <p className="studio-error" role="alert">{error}</p> : null}
      {message ? <p className="form-ok" role="status"><CheckCircle2 size={15} /> {message}</p> : null}
    </section>
  );
}
