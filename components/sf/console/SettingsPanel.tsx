"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, FileCode2, FlaskConical, Palette, School, Sparkles } from "lucide-react";
import type { Fair, SiteTheme } from "@/lib/types";
import { bn } from "@/lib/format";
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
      setProblem(issue instanceof Error ? issue.message : "পরিবর্তন করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function setMode(next: "school" | "fair") {
    setCurrent({ ...current, mode: next });
    await call({ action: "fair-mode", mode: next, slug: current.slug }, next === "fair" ? "পুরো সাইট এখন বিজ্ঞান মেলার সাইট — যেকোনো সময় ফেরানো যাবে।" : "সাইট আবার স্কুল মোডে ফেরানো হয়েছে।");
  }

  async function activateTheme(theme: SiteTheme) {
    setLocalThemes((list) => list.map((item) => ({ ...item, is_default: item.id === theme.id })));
    await call({ action: "theme", id: theme.id, key: theme.key }, `${theme.name} থিম চালু হয়েছে।`);
  }

  return (
    <div className="v2-grid" style={{ gap: 16 }}>
      <div className="v2-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Panel title="সাইট মোড">
          <p className="v2-muted" style={{ marginTop: 0 }}>
            এক ক্লিকে পুরো ওয়েবসাইটকে <strong>বিজ্ঞান মেলার সাইট</strong> বানিয়ে ফেলুন। ফিরিয়ে আনতেও একই বোতাম।
          </p>
          <div className="v2-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              type="button"
              className={`v2-btn ${current.mode === "school" ? "" : "v2-btn-ghost"}`}
              disabled={busy}
              onClick={() => setMode("school")}
            >
              <School size={16} /> স্কুল সাইট
            </button>
            <button
              type="button"
              className={`v2-btn ${current.mode === "fair" ? "" : "v2-btn-ghost"}`}
              disabled={busy}
              onClick={() => setMode("fair")}
            >
              <FlaskConical size={16} /> মেলা মোড
            </button>
          </div>
          <div className="pill-row" style={{ marginTop: 14 }}>
            <span className="badge-soft">{current.mode === "fair" ? "এখন: মেলা সাইট" : "এখন: স্কুল সাইট"}</span>
            {current.mode === "fair" ? <a className="badge-soft" href="/" target="_blank" rel="noreferrer"><Eye size={12} /> দেখুন</a> : null}
          </div>
        </Panel>

        <Panel title="সক্রিয় মেলা">
          <div style={{ display: "grid", gap: 10 }}>
            <select className="v2-select" value={current.slug} onChange={(e) => setCurrent({ ...current, slug: e.target.value })}>
              {fairs.map((fair) => (
                <option key={fair.slug} value={fair.slug}>{fair.name}{fair.starts_on ? ` · ${fair.starts_on}` : ""}</option>
              ))}
            </select>
            <button className="v2-btn" type="button" disabled={busy} onClick={() => call({ action: "fair-slug", slug: current.slug }, "সক্রিয় মেলা বদলানো হয়েছে।")}>
              সক্রিয় করুন
            </button>
            <a className="v2-btn v2-btn-ghost" href={`/fair/${current.slug}`} target="_blank" rel="noreferrer">মেলার সাইট দেখুন</a>
          </div>
        </Panel>

        <Panel title="হোমপেজের এলিমেন্ট">
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={current.banner}
                onChange={async (e) => {
                  setCurrent({ ...current, banner: e.target.checked });
                  await call({ action: "banner", enabled: e.target.checked }, e.target.checked ? "বড় মেলা-ব্যানার চালু।" : "ব্যানার লুকানো হয়েছে।");
                }}
              />
              হোমপেজে ultra big মেলা-ব্যানার
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={current.registration}
                onChange={async (e) => {
                  setCurrent({ ...current, registration: e.target.checked });
                  await call({ action: "registration", enabled: e.target.checked }, e.target.checked ? "নিবন্ধন চালু।" : "নিবন্ধন বন্ধ।");
                }}
              />
              নিবন্ধন চালু
            </label>
            <p className="v2-muted" style={{ margin: 0, fontSize: 13 }}>
              মেলার নাম, তারিখ, লোগো, পোস্টার, রুটিন ও ক্যাটাগরি পরিবর্তন করতে অ্যাডমিন স্টুডিও → “বিজ্ঞান মেলা ২০২৬” গ্রুপে যান।
            </p>
          </div>
        </Panel>
      </div>

      <Panel
        title="টেমপ্লেট থিম ও কাস্টম CSS"
        action={<span className="badge-soft"><Palette size={13} /> {bn(localThemes.length)} টি থিম</span>}
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
                <span className="badge-soft">{theme.mode === "dark" ? "ডার্ক" : "লাইট"}</span>
                <span className="badge-soft">{theme.hero_style}</span>
                {theme.is_default ? <span className="badge-soft status-ok"><CheckCircle2 size={12} /> সক্রিয়</span> : null}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="v2-btn v2-btn-sm" type="button" disabled={busy || !isAdmin || theme.is_default} onClick={() => activateTheme(theme)}>
                  চালু করুন
                </button>
                <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => setCssTheme(theme.id)}>
                  <FileCode2 size={13} /> CSS
                </button>
              </div>
            </article>
          ))}
          {!localThemes.length ? <Empty>কোনো থিম নেই — অ্যাডমিন স্টুডিও → টেমপ্লেট থিম থেকে যোগ করুন।</Empty> : null}
        </div>

        {selected ? (
          <div>
            <p className="v2-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={13} /> “{selected.name}” এর কাস্টম CSS
            </p>
            <textarea className="v2-textarea" rows={10} value={css} onChange={(e) => setCss(e.target.value)} spellCheck={false} />
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button
                className="v2-btn"
                type="button"
                disabled={busy || !isAdmin}
                onClick={() => call({ action: "theme-css", id: selected.id, custom_css: css }, "CSS সংরক্ষিত হয়েছে — সাইটে সঙ্গে সঙ্গে প্রয়োগ হয়েছে।")}
              >
                CSS সংরক্ষণ করুন
              </button>
              <button className="v2-btn v2-btn-ghost" type="button" onClick={() => setCss(selected.custom_css ?? "")}>রিসেট</button>
              {!isAdmin ? <span className="badge-soft">CSS বদলাতে অ্যাডমিন লগইন দরকার</span> : null}
            </div>
            <p className="v2-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
              পুরো সাইটে ব্যবহারযোগ্য ভেরিয়েবল: <code>--okgs-accent</code>, <code>--okgs-accent-2</code>, <code>--okgs-surface</code>, <code>--okgs-ink</code>, <code>--okgs-radius</code>।
              যেমন: <code>.v2-btn {"{"} border-radius: 999px; {"}"}</code>
            </p>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
