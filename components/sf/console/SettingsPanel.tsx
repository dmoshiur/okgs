"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, FileCode2, FlaskConical, Palette, School, Sparkles } from "lucide-react";
import type { Fair, SiteTheme } from "@/lib/types";
import { en } from "@/lib/format";
import { Empty, Notice, Panel, postJson } from "@/components/sf/console/ui";

interface SettingsPanelProps {
  fairs: Fair[];
  themes: SiteTheme[];
  activeFairSlug: string;
  mode: "school" | "fair";
  bannerEnabled: boolean;
  registrationOpen: boolean;
  isAdmin: boolean;
}

/** Site-wide switches: fair mode, which fair is live, banners and templates. */
export function SettingsPanel({ fairs, themes, activeFairSlug, mode, bannerEnabled, registrationOpen, isAdmin }: SettingsPanelProps) {
  const [current, setCurrent] = useState({ mode, slug: activeFairSlug, banner: bannerEnabled, registration: registrationOpen });
  const [localThemes, setLocalThemes] = useState(themes);
  const [css, setCss] = useState("");
  const [cssTheme, setCssTheme] = useState(themes.find((theme) => theme.is_default)?.id ?? themes[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = localThemes.find((theme) => theme.id === cssTheme) ?? localThemes[0];

  useEffect(() => {
    setCss(selected?.custom_css ?? "");
  }, [selected?.id, selected?.custom_css]);

  async function call(body: Record<string, unknown>, note: string) {
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      await postJson("/api/staff/settings", body);
      setMessage(note);
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not change.");
    } finally {
      setBusy(false);
    }
  }

  async function setMode(next: "school" | "fair") {
    setCurrent({ ...current, mode: next });
    await call({ action: "fair-mode", mode: next, slug: current.slug }, next === "fair" ? "The whole site is now the Science Fair site — you can switch back at any time." : "The site has been switched back to school mode.");
  }

  async function activateTheme(theme: SiteTheme) {
    setLocalThemes((list) => list.map((item) => ({ ...item, is_default: item.id === theme.id })));
    await call({ action: "theme", id: theme.id, key: theme.key }, `${theme.name} theme is now active.`);
  }

  return (
    <div className="v2-grid" style={{ gap: 16 }}>
      <div className="v2-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Panel title="Site mode">
          <p className="v2-muted" style={{ marginTop: 0 }}>
            With one click, turn the whole website into a <strong>Science Fair site</strong> . Use the same button to switch back.
          </p>
          <div className="v2-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              type="button"
              className={`v2-btn ${current.mode === "school" ? "" : "v2-btn-ghost"}`}
              disabled={busy}
              onClick={() => setMode("school")}
            >
              <School size={16} /> School site
            </button>
            <button
              type="button"
              className={`v2-btn ${current.mode === "fair" ? "" : "v2-btn-ghost"}`}
              disabled={busy}
              onClick={() => setMode("fair")}
            >
              <FlaskConical size={16} /> Fair mode
            </button>
          </div>
          <div className="pill-row" style={{ marginTop: 14 }}>
            <span className="badge-soft">{current.mode === "fair" ? "Now: fair site" : "Now: school site"}</span>
            {current.mode === "fair" ? <a className="badge-soft" href="/" target="_blank" rel="noreferrer"><Eye size={12} /> View</a> : null}
          </div>
        </Panel>

        <Panel title="Active fair">
          <div style={{ display: "grid", gap: 10 }}>
            <select className="v2-select" value={current.slug} onChange={(e) => setCurrent({ ...current, slug: e.target.value })}>
              {fairs.map((fair) => (
                <option key={fair.slug} value={fair.slug}>{fair.name}{fair.starts_on ? ` · ${fair.starts_on}` : ""}</option>
              ))}
            </select>
            <button className="v2-btn" type="button" disabled={busy} onClick={() => call({ action: "fair-slug", slug: current.slug }, "Active fair changed.")}>
              Activate
            </button>
            <a className="v2-btn v2-btn-ghost" href={`/fair/${current.slug}`} target="_blank" rel="noreferrer">View fair site</a>
          </div>
        </Panel>

        <Panel title="Homepage elements">
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={current.banner}
                onChange={async (e) => {
                  setCurrent({ ...current, banner: e.target.checked });
                  await call({ action: "banner", enabled: e.target.checked }, e.target.checked ? "Large fair banner is on." : "Banner hidden.");
                }}
              />
              Large fair banner on the homepage
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={current.registration}
                onChange={async (e) => {
                  setCurrent({ ...current, registration: e.target.checked });
                  await call({ action: "registration", enabled: e.target.checked }, e.target.checked ? "Registration is open." : "Registration is closed.");
                }}
              />
              Registration open
            </label>
            <p className="v2-muted" style={{ margin: 0, fontSize: 13 }}>
              To change the fair name, dates, logo, poster, schedule or categories, go to Admin Studio → the “Science Fair 2026” group.
            </p>
          </div>
        </Panel>
      </div>

      <Panel
        title="Template themes & custom CSS"
        action={<span className="badge-soft"><Palette size={13} /> {en(localThemes.length)} themes</span>}
      >
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}

        <div className="v2-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", marginBottom: 18 }}>
          {localThemes.map((theme) => (
            <article
              key={theme.id}
              className="v2-card"
              style={{
                padding: 16,
                borderColor: theme.is_default ? "var(--okgs-accent)" : undefined,
                borderWidth: theme.is_default ? 2 : 1,
              }}
            >
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: theme.accent }} />
                <span style={{ width: 26, height: 26, borderRadius: 8, background: theme.accent_2 }} />
                <span style={{ width: 26, height: 26, borderRadius: 8, background: theme.surface, border: "1px solid var(--okgs-line)" }} />
                <span style={{ width: 26, height: 26, borderRadius: 8, background: theme.ink }} />
              </div>
              <strong style={{ display: "block" }}>{theme.name}</strong>
              <p className="v2-muted" style={{ fontSize: 13, margin: "4px 0 12px" }}>{theme.description}</p>
              <div className="pill-row">
                <span className="badge-soft">{theme.mode === "dark" ? "Dark" : "Light"}</span>
                <span className="badge-soft">{theme.hero_style}</span>
                {theme.is_default ? <span className="badge-soft status-ok"><CheckCircle2 size={12} /> Active</span> : null}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="v2-btn v2-btn-sm" type="button" disabled={busy || !isAdmin || theme.is_default} onClick={() => activateTheme(theme)}>
                  Turn on
                </button>
                <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => setCssTheme(theme.id)}>
                  <FileCode2 size={13} /> CSS
                </button>
              </div>
            </article>
          ))}
          {!localThemes.length ? <Empty>No themes — add one from Admin Studio → Template themes.</Empty> : null}
        </div>

        {selected ? (
          <div>
            <p className="v2-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={13} /> “{selected.name}” custom CSS
            </p>
            <textarea className="v2-textarea" rows={10} value={css} onChange={(e) => setCss(e.target.value)} spellCheck={false} />
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button
                className="v2-btn"
                type="button"
                disabled={busy || !isAdmin}
                onClick={() => call({ action: "theme-css", id: selected.id, custom_css: css }, "CSS saved — applied to the site immediately.")}
              >
                Save CSS
              </button>
              <button className="v2-btn v2-btn-ghost" type="button" onClick={() => setCss(selected.custom_css ?? "")}>Reset</button>
              {!isAdmin ? <span className="badge-soft">Admin login is required to change CSS</span> : null}
            </div>
            <p className="v2-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
              CSS variables available across the site: <code>--okgs-accent</code>, <code>--okgs-accent-2</code>, <code>--okgs-surface</code>, <code>--okgs-ink</code>, <code>--okgs-radius</code>।
              e.g. <code>.v2-btn {"{"} border-radius: 999px; {"}"}</code>
            </p>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
