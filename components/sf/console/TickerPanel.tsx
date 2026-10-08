"use client";

import { useState } from "react";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { Empty, Panel, postJson, useApi } from "@/components/sf/console/ui";

interface TickerRow {
  id: string;
  fair_slug: string;
  category: string;
  name: string;
  class_level: string;
  section: string;
  email: string;
  phone: string;
  message: string;
  kind: string;
  audience: string;
  target_role: string;
  payment_segment: string;
  starts_at: string;
  ends_at: string;
  sort_order: number;
  is_active: number;
}

const kinds = ["notice", "result", "schedule", "urgent", "welcome"];
const roleOptions = ["superadmin", "admin", "teacher", "staff", "student", "alumni", "volunteer", "guest", "club"];

const blank = {
  category: "",
  name: "",
  class_level: "",
  section: "",
  email: "",
  phone: "",
  message: "",
  kind: "notice",
  audience: "all",
  target_role: "",
  payment_segment: "",
  starts_at: "",
  ends_at: "",
  sort_order: 0,
};

/**
 * Fair ticker — short scrolling notices for the fair site, each tagged with a
 * category / name / class / section / email so the console can filter by who it
 * belongs to, and the fair page can show it in the marquee.
 */
export function TickerPanel({ fairSlug }: { fairSlug: string }) {
  const { data, reload } = useApi<{ tickers: TickerRow[] }>(`/api/staff/ticker?fair=${encodeURIComponent(fairSlug)}&all=1`, [fairSlug]);
  const [draft, setDraft] = useState({ ...blank });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState("");

  const tickers = data?.tickers ?? [];

  const change = (key: keyof typeof blank, value: string | number) => setDraft((current) => ({ ...current, [key]: value }));

  const add = async () => {
    setBusy(true);
    setProblem("");
    setNote("");
    try {
      const toIso = (value: string) => {
        if (!value) return "";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date.toISOString();
      };
      await postJson(`/api/staff/ticker`, { action: "create", fair_slug: fairSlug, ...draft, starts_at: toIso(draft.starts_at), ends_at: toIso(draft.ends_at) });
      setDraft({ ...blank });
      setNote("Ticker added — visible on the fair site immediately.");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row: TickerRow) => {
    await postJson(`/api/staff/ticker`, { action: "update", id: row.id, is_active: row.is_active ? 0 : 1, fair_slug: row.fair_slug, message: row.message, name: row.name, category: row.category, class_level: row.class_level, section: row.section, email: row.email, phone: row.phone, kind: row.kind, audience: row.audience || "all", target_role: row.target_role, payment_segment: row.payment_segment, starts_at: row.starts_at, ends_at: row.ends_at, sort_order: row.sort_order }).catch(() => null);
    await reload();
  };

  const remove = async (row: TickerRow) => {
    await postJson(`/api/staff/ticker`, { action: "delete", id: row.id }).catch(() => null);
    await reload();
  };

  return (
    <Panel title="Ticker (announcements)">
      <div className="cs-form-grid">
        <label className="cs-field">
          <span>Category</span>
          <input value={draft.category} placeholder="e.g. Robotics" onChange={(event) => change("category", event.target.value)} />
        </label>
        <label className="cs-field">
          <span>Name</span>
          <input value={draft.name} onChange={(event) => change("name", event.target.value)} />
        </label>
        <label className="cs-field">
          <span>Class</span>
          <input value={draft.class_level} placeholder="Class 10" onChange={(event) => change("class_level", event.target.value)} />
        </label>
        <label className="cs-field">
          <span>Section</span>
          <input value={draft.section} placeholder="A" onChange={(event) => change("section", event.target.value)} />
        </label>
        <label className="cs-field">
          <span>Email</span>
          <input value={draft.email} onChange={(event) => change("email", event.target.value)} />
        </label>
        <label className="cs-field">
          <span>Type</span>
          <select value={draft.kind} onChange={(event) => change("kind", event.target.value)}>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <label className="cs-field">
          <span>Who sees it</span>
          <select value={draft.audience} onChange={(event) => change("audience", event.target.value)}>
            <option value="all">All users</option>
            <option value="public">Public / fair site</option>
            <option value="teachers">Teacher</option>
            <option value="students">Students & alumni</option>
            <option value="admins">Admin</option>
            <option value="paid_students">Paid Student</option>
            <option value="unpaid_students">Unpaid students</option>
          </select>
        </label>
        <label className="cs-field">
          <span>Specific role (optional)</span>
          <select value={draft.target_role} onChange={(event) => change("target_role", event.target.value)}>
            <option value="">Any role</option>
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <label className="cs-field">
          <span>Start time (optional)</span>
          <input type="datetime-local" value={draft.starts_at} onChange={(event) => change("starts_at", event.target.value)} />
        </label>
        <label className="cs-field">
          <span>Expires (optional)</span>
          <input type="datetime-local" value={draft.ends_at} onChange={(event) => change("ends_at", event.target.value)} />
        </label>
      </div>
      <label className="cs-field">
        <span>Message</span>
        <textarea rows={2} value={draft.message} onChange={(event) => change("message", event.target.value)} />
      </label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" className="v2-btn v2-btn-sm" disabled={busy} onClick={() => void add()}>
          <Plus size={15} /> Add ticker
        </button>
        {note ? <span className="panel-ok">{note}</span> : null}
        {problem ? <span className="portal-error">{problem}</span> : null}
      </div>

      <div className="cs-people">
        {tickers.map((row) => (
          <article className="cs-person" key={row.id}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <Megaphone size={16} />
              <strong>{row.message || "(no message)"}</strong>
              <span className="v2-chip">{row.kind}</span>
              <span className="v2-chip">{row.audience || "all"}{row.target_role ? ` · ${row.target_role}` : ""}</span>
              {row.starts_at || row.ends_at ? <span className="v2-chip">{row.starts_at ? new Date(row.starts_at).toLocaleString("en-US") : "From now"}{row.ends_at ? ` — ${new Date(row.ends_at).toLocaleString("en-US")}` : ""}</span> : null}
              {row.category ? <span className="v2-chip">{row.category}</span> : null}
              {row.name ? <span className="v2-chip">{row.name}</span> : null}
              {row.class_level ? (
                <span className="v2-chip">
                  {row.class_level}
                  {row.section ? ` · ${row.section}` : ""}
                </span>
              ) : null}
              {row.email ? <span className="v2-chip">{row.email}</span> : null}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button type="button" className="panel-link" onClick={() => void toggle(row)}>
                {row.is_active ? "On — turn off" : "Off — turn on"}
              </button>
              <button type="button" className="panel-link" onClick={() => void remove(row)}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </article>
        ))}
        {!tickers.length ? <Empty>No tickers yet — add one from the form above.</Empty> : null}
      </div>
    </Panel>
  );
}
