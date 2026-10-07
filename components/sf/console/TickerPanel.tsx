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
      setNote("টিকার যোগ হয়েছে — ফেয়ার সাইটে সাথে সাথে দেখা যাবে।");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "সংরক্ষণ করা যায়নি।");
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
        <label className="cs-field">
          <span>কারা দেখবেন</span>
          <select value={draft.audience} onChange={(event) => change("audience", event.target.value)}>
            <option value="all">সব ব্যবহারকারী</option>
            <option value="public">পাবলিক / ফেয়ার সাইট</option>
            <option value="teachers">শিক্ষক</option>
            <option value="students">শিক্ষার্থী ও প্রাক্তন শিক্ষার্থী</option>
            <option value="admins">অ্যাডমিন</option>
            <option value="paid_students">পরিশোধিত শিক্ষার্থী</option>
            <option value="unpaid_students">বকেয়া শিক্ষার্থী</option>
          </select>
        </label>
        <label className="cs-field">
          <span>নির্দিষ্ট ভূমিকা (ঐচ্ছিক)</span>
          <select value={draft.target_role} onChange={(event) => change("target_role", event.target.value)}>
            <option value="">যেকোনো ভূমিকা</option>
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <label className="cs-field">
          <span>শুরুর সময় (ঐচ্ছিক)</span>
          <input type="datetime-local" value={draft.starts_at} onChange={(event) => change("starts_at", event.target.value)} />
        </label>
        <label className="cs-field">
          <span>মেয়াদ শেষ (ঐচ্ছিক)</span>
          <input type="datetime-local" value={draft.ends_at} onChange={(event) => change("ends_at", event.target.value)} />
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
              <span className="v2-chip">{row.audience || "all"}{row.target_role ? ` · ${row.target_role}` : ""}</span>
              {row.starts_at || row.ends_at ? <span className="v2-chip">{row.starts_at ? new Date(row.starts_at).toLocaleString("bn-BD") : "এখন থেকে"}{row.ends_at ? ` — ${new Date(row.ends_at).toLocaleString("bn-BD")}` : ""}</span> : null}
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
