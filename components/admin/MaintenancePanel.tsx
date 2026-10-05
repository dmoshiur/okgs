"use client";

/**
 * MaintenancePanel — the emergency “Site Down” switch.
 *
 * ON  → every public request is rewritten to /maintenance (the URL is kept, so
 *       switching back off restores the exact page that was requested).
 * OFF → the public site is live again, unchanged.
 *
 * Admins and SuperAdmins keep working throughout, so the person who pressed the
 * button can always sign in and press it again.
 */
import { useState } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2, MessageSquare, Power, ShieldCheck, Timer } from "lucide-react";

export interface MaintenanceClientState {
  enabled: boolean;
  message: string;
  defaultMessage: string;
  updatedAt: string;
}

export function MaintenancePanel({ initialState, siteName }: { initialState: MaintenanceClientState; siteName: string }) {
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState(initialState.message || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function apply(enabled: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/superadmin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, message }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        state?: MaintenanceClientState;
        message?: string;
        messageBn?: string;
        errorEn?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.state) {
        setError(data.errorEn || data.error || "The switch could not be flipped.");
        return;
      }
      setState(data.state);
      setMessage(data.state.message || "");
      setNotice(data.message ?? "");
      setConfirming(false);
    } catch {
      setError("The server could not be reached. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="maintenance-panel">
      <section className={`maintenance-switch ${state.enabled ? "is-down" : "is-live"}`}>
        <div className="maintenance-switch-copy">
          <span className="maintenance-switch-icon" aria-hidden="true">
            {state.enabled ? <AlertTriangle size={22} /> : <ShieldCheck size={22} />}
          </span>
          <div>
            <h2>{state.enabled ? "Site is DOWN" : "Site is LIVE"}</h2>
            <p>
              {state.enabled
                ? `Every public visitor of ${siteName} is seeing the maintenance notice right now. Only admins can browse the site.`
                : `Public pages are serving normally. Flip the switch to take ${siteName} offline instantly.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          className={`maintenance-toggle ${state.enabled ? "is-on" : ""}`}
          onClick={() => (state.enabled ? void apply(false) : setConfirming(true))}
          disabled={busy}
          role="switch"
          aria-checked={state.enabled}
          aria-label={state.enabled ? "Turn the public site back on" : "Take the public site down"}
        >
          <span className="maintenance-toggle-track" aria-hidden="true">
            <span className="maintenance-toggle-thumb" />
          </span>
          <span className="maintenance-toggle-label">
            {busy ? <Loader2 size={14} className="spin" /> : <Power size={14} />}
            {busy ? "Working…" : state.enabled ? "Turn site ON" : "Take site DOWN"}
          </span>
        </button>
      </section>

      {confirming ? (
        <section className="maintenance-confirm" role="alertdialog" aria-label="Confirm maintenance mode">
          <AlertTriangle size={18} />
          <div>
            <b>Take {siteName} offline now?</b>
            <p>
              Public visitors will immediately see the maintenance page with your message below. Admins keep full access and
              can switch it back on at any time.
            </p>
            <div className="maintenance-confirm-actions">
              <button type="button" className="secondary-button" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="danger-button" onClick={() => void apply(true)} disabled={busy}>
                {busy ? <Loader2 size={14} className="spin" /> : <Power size={14} />} Yes, take the site down
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-eyebrow">
              <MessageSquare size={13} /> Maintenance notice
            </span>
            <h2>The message visitors read while the site is down</h2>
          </div>
        </div>
        <div className="field-block">
          <textarea
            className="v2-input"
            rows={4}
            value={message}
            placeholder={state.defaultMessage}
            onChange={(event) => setMessage(event.target.value)}
          />
          <small className="field-help">
            Leave it empty to use the default Bangla notice plus the English line “Site is currently under maintenance. Please
            check back later.”
          </small>
        </div>
        <div className="settings-actions">
          <a className="secondary-button" href="/maintenance" target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Preview the maintenance page
          </a>
          <button className="admin-primary-button" type="button" onClick={() => void apply(state.enabled)} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Save the notice
          </button>
        </div>
      </section>

      {error ? (
        <p className="studio-error" role="alert">
          <AlertTriangle size={15} /> {error}
        </p>
      ) : null}
      {notice ? (
        <p className="form-ok" role="status">
          <Check size={15} /> {notice}
        </p>
      ) : null}

      <p className="maintenance-timestamp">
        <Timer size={13} /> Last changed:{" "}
        {state.updatedAt ? new Date(state.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never"}
      </p>
    </div>
  );
}
