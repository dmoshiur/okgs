"use client";

import { useState } from "react";
import { Boxes, Image as ImageIcon, QrCode, Trash2 } from "lucide-react";
import type { FairCollection } from "@/lib/types";
import { bn } from "@/lib/format";
import { Empty, Notice, Panel, postJson, useApi } from "@/components/sf/console/ui";
import { ImageField } from "@/components/admin/ImageField";

const statusOptions = ["নিবন্ধিত", "চূড়ান্ত", "প্রদর্শিত", "বিজয়ী"];
const typeOptions = ["মডেল", "পরীক্ষা", "রোবোটিক্স", "পোস্টার", "ডিজিটাল", "চিত্রকর্ম"];

/**
 * "Add and save the collection of the science fair" — the archive of every
 * project, with photos, team, class and result. Saved through the same validated
 * content API the studio uses, so it shows up in both places.
 */
export function CollectionsPanel({ fairSlug, categories, clubs }: { fairSlug: string; categories: string[]; clubs: { slug: string; name: string }[] }) {
  const { data, loading, reload } = useApi<{ items: FairCollection[] }>(`/api/admin/fair_collections`, [fairSlug]);
  const [form, setForm] = useState({
    title: "",
    category: categories[0] ?? "",
    description: "",
    project_type: "মডেল",
    status: "প্রদর্শিত",
    position: "",
    score: "",
    student_name: "",
    student_id: "",
    class_level: "",
    section: "",
    team_members: "",
    club_slug: "",
    image_url: "",
    gallery_urls: "",
    video_url: "",
    note: "",
  });
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const items = (data?.items ?? []).filter((item) => (fairSlug ? item.fair_slug === fairSlug || !item.fair_slug : true));
  const visible = search
    ? items.filter((item) => `${item.title} ${item.student_name} ${item.category} ${item.class_level}`.toLowerCase().includes(search.toLowerCase()))
    : items;
  const winners = items.filter((item) => item.status === "বিজয়ী" || item.position).length;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      await postJson("/api/admin/fair_collections", {
        ...form,
        fair_slug: fairSlug,
        score: Number(form.score) || 0,
        is_active: 1,
      });
      setMessage(`“${form.title}” সংগ্রহে যোগ হয়েছে।`);
      setForm({ ...form, title: "", description: "", student_name: "", student_id: "", section: "", team_members: "", image_url: "", gallery_urls: "", video_url: "", position: "", note: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "সংরক্ষণ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: FairCollection) {
    if (!confirm(`“${item.title}” মুছে ফেলবেন?`)) return;
    try {
      await postJson(`/api/admin/fair_collections/${item.id}`, {}, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "মুছে ফেলা যায়নি।");
    }
  }

  async function update(item: FairCollection, patch: Record<string, unknown>) {
    try {
      await postJson(`/api/admin/fair_collections/${item.id}`, patch, "PATCH");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "পরিবর্তন করা যায়নি।");
    }
  }

  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.3fr) minmax(310px, .7fr)" }}>
      <Panel
        title="মেলার সংগ্রহশালা"
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="badge-soft"><Boxes size={13} /> {bn(items.length)} টি</span>
            <span className="badge-soft">{bn(winners)} টি পুরস্কারপ্রাপ্ত</span>
            <input className="v2-input" style={{ width: 170 }} placeholder="খুঁজুন" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      >
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>প্রকল্প</th><th>শ্রেণি</th><th>ধরন</th><th>অবস্থা</th><th>ফলাফল</th><th /></tr></thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    <div className="v2-muted" style={{ fontSize: 12 }}>{item.student_name || "—"}{item.team_members ? ` · ${item.team_members}` : ""}</div>
                  </td>
                  <td>{item.class_level || "—"}{item.section ? ` · ${item.section}` : ""}</td>
                  <td>{item.project_type}<div className="v2-muted" style={{ fontSize: 12 }}>{item.category}</div></td>
                  <td>
                    <select className="v2-select" style={{ minWidth: 120 }} value={item.status} onChange={(e) => update(item, { status: e.target.value })}>
                      {statusOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      className="v2-input"
                      style={{ minWidth: 110 }}
                      defaultValue={item.position}
                      placeholder="১ম স্থান"
                      onBlur={(e) => e.target.value !== item.position ? update(item, { position: e.target.value }) : undefined}
                    />
                  </td>
                  <td>
                    <span style={{ display: "inline-flex", gap: 6 }}>
                      <a
                        className="v2-btn v2-btn-sm v2-btn-ghost"
                        href={`/api/qr?entry=${item.id}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        title="প্রকল্পের QR — শিক্ষক স্ক্যান করে যাচাই করবেন"
                      >
                        <QrCode size={14} />
                      </a>
                      <button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(item)}><Trash2 size={14} /></button>
                    </span>
                  </td>
                </tr>
              ))}
              {!visible.length && !loading ? <tr><td colSpan={6}><Empty>এখনো কোনো সংগ্রহ যোগ করা হয়নি — ডান দিকের ফর্ম থেকে যোগ করুন।</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="নতুন সংগ্রহ যোগ করুন">
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <div>
            <label className="v2-label">প্রকল্পের নাম</label>
            <input className="v2-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label className="v2-label">ক্যাটাগরি</label>
            <input className="v2-input" list="fair-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <datalist id="fair-categories">
              {categories.map((category) => <option key={category} value={category} />)}
            </datalist>
          </div>
          <div>
            <label className="v2-label">বিবরণ</label>
            <textarea className="v2-textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">ধরন</label>
              <select className="v2-select" value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })}>
                {typeOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="v2-label">অবস্থা</label>
              <select className="v2-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {statusOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">শিক্ষার্থীর নাম</label>
              <input className="v2-input" value={form.student_name} onChange={(e) => setForm({ ...form, student_name: e.target.value })} />
            </div>
            <div>
              <label className="v2-label">আইডি</label>
              <input className="v2-input" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">শ্রেণি</label>
              <input className="v2-input" value={form.class_level} onChange={(e) => setForm({ ...form, class_level: e.target.value })} />
            </div>
            <div>
              <label className="v2-label">শাখা</label>
              <input className="v2-input" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="v2-label">দলের সদস্য</label>
            <textarea className="v2-textarea" rows={2} value={form.team_members} onChange={(e) => setForm({ ...form, team_members: e.target.value })} />
          </div>
          <div>
            <label className="v2-label">ক্লাব</label>
            <select className="v2-select" value={form.club_slug} onChange={(e) => setForm({ ...form, club_slug: e.target.value })}>
              <option value="">— কোনো ক্লাব নয় —</option>
              {clubs.map((club) => <option key={club.slug} value={club.slug}>{club.name}</option>)}
            </select>
          </div>
          <div>
            <label className="v2-label"><ImageIcon size={13} style={{ verticalAlign: -2 }} /> প্রকল্পের ছবি</label>
            <ImageField value={form.image_url} onChange={(next) => setForm({ ...form, image_url: next })} label="প্রকল্পের ছবি" prefix={fairSlug || "fair"} title={form.title} />
          </div>
          <div>
            <label className="v2-label">অন্যান্য ছবি (প্রতি লাইনে একটি)</label>
            <textarea className="v2-textarea" rows={2} value={form.gallery_urls} onChange={(e) => setForm({ ...form, gallery_urls: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">স্থান / পুরস্কার</label>
              <input className="v2-input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="১ম স্থান" />
            </div>
            <div>
              <label className="v2-label">স্কোর</label>
              <input className="v2-input" type="number" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
            </div>
          </div>
          <button className="v2-btn" type="submit" disabled={busy}>{busy ? "সেভ হচ্ছে…" : "সংগ্রহে যোগ করুন"}</button>
        </form>
      </Panel>
    </div>
  );
}
