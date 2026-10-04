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
  sort_order: number;
  is_active: number;
}

const kinds = ["notice", "result", "schedule", "urgent", "welcome"];

const blank = {
  category: "",
  name: "",
  class_level: "",
  section: "",
  email: "",
  phone: "",
  message: "",
  kind: "notice",
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
      await postJson(`/api/staff/ticker`, { action: "create", fair_slug: fairSlug, ...draft });
      setDraft({ ...blank });
      setNote("টিকার যোগ হয়েছে — ফেয়ার সাইটে সাথে সাথে দেখা যাবে।");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "সংরক্ষণ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row: TickerRow) => {
    await postJson(`/api/staff/ticker`, { action: "update", id: row.id, is_active: row.is_active ? 0 : 1, fair_slug: row.fair_slug, message: row.message, name: row.name, category: row.category, class_level: row.class_level, section: row.section, email: row.email, phone: row.phone, kind: row.kind, sort_order: row.sort_order }).catch(() => null);
    await reload();
  };

  const remove = async (row: TickerRow) => {
    await postJson(`/api/staff/ticker`, { action: "delete", id: row.id }).catch(() => null);
    await reload();
  };

  return (
    <Panel title="টিকার (ঘোষণা)">
      <div className="cs-form-grid">
        <label className="cs-field">
          <span>ক্যাটাগরি</span>
          <input value={draft.category} placeholder="যেমন: রোবোটিক্স" onChange={(event) => change("category", event.target.value)} />
        </label>
        <label className="cs-field">
          <span>নাম</span>
          <input value={draft.name} onChange={(event) => change("name", event.target.value)} />
        </label>
        <label className="cs-field">
          <span>শ্রেণি</span>
          <input value={draft.class_level} placeholder="দশম শ্রেণি" onChange={(event) => change("class_level", event.target.value)} />
        </label>
        <label className="cs-field">
          <span>শাখা</span>
          <input value={draft.section} placeholder="ক" onChange={(event) => change("section", event.target.value)} />
        </label>
        <label className="cs-field">
          <span>ইমেইল</span>
          <input value={draft.email} onChange={(event) => change("email", event.target.value)} />
        </label>
        <label className="cs-field">
          <span>ধরন</span>
          <select value={draft.kind} onChange={(event) => change("kind", event.target.value)}>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="cs-field">
        <span>বার্তা</span>
        <textarea rows={2} value={draft.message} onChange={(event) => change("message", event.target.value)} />
      </label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" className="v2-btn v2-btn-sm" disabled={busy} onClick={() => void add()}>
          <Plus size={15} /> টিকার যোগ করুন
        </button>
        {note ? <span className="panel-ok">{note}</span> : null}
        {problem ? <span className="portal-error">{problem}</span> : null}
      </div>

      <div className="cs-people">
        {tickers.map((row) => (
          <article className="cs-person" key={row.id}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <Megaphone size={16} />
              <strong>{row.message || "(কোনো বার্তা নেই)"}</strong>
              <span className="v2-chip">{row.kind}</span>
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
                {row.is_active ? "চালু — বন্ধ করুন" : "বন্ধ — চালু করুন"}
              </button>
              <button type="button" className="panel-link" onClick={() => void remove(row)}>
                <Trash2 size={14} /> মুছুন
              </button>
            </div>
          </article>
        ))}
        {!tickers.length ? <Empty>এখনো কোনো টিকার নেই — উপরের ফর্ম থেকে যোগ করুন।</Empty> : null}
      </div>
    </Panel>
  );
}
