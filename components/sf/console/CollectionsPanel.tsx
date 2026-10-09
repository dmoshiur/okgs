"use client";

import { useState } from "react";
import { Boxes, Image as ImageIcon, QrCode, Trash2 } from "lucide-react";
import type { FairCollection } from "@/lib/types";
import { en } from "@/lib/format";
import { Empty, Notice, Panel, postJson, useApi } from "@/components/sf/console/ui";
import { ImageField } from "@/components/admin/ImageField";

const statusOptions = ["Registered", "Finalist", "On display", "Winner"];
const typeOptions = ["Model", "Experiment", "Robotics", "Poster", "Digital", "Artwork"];

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
    project_type: "Model",
    status: "On display",
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
  const winners = items.filter((item) => item.status === "Winner" || item.position).length;

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
      setMessage(`“${form.title}” added to the collection.`);
      setForm({ ...form, title: "", description: "", student_name: "", student_id: "", section: "", team_members: "", image_url: "", gallery_urls: "", video_url: "", position: "", note: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: FairCollection) {
    if (!confirm(`“${item.title}” Delete?`)) return;
    try {
      await postJson(`/api/admin/fair_collections/${item.id}`, {}, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not delete.");
    }
  }

  async function update(item: FairCollection, patch: Record<string, unknown>) {
    try {
      await postJson(`/api/admin/fair_collections/${item.id}`, patch, "PATCH");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not change.");
    }
  }

  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.3fr) minmax(310px, .7fr)" }}>
      <Panel
        title="Fair collection"
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="badge-soft"><Boxes size={13} /> {en(items.length)} items</span>
            <span className="badge-soft">{en(winners)} award-winning</span>
            <input className="v2-input" style={{ width: 170 }} placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      >
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Project</th><th>Class</th><th>Type</th><th>Status</th><th>Result</th><th /></tr></thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <td className="sf-wrap-cell">
                    <strong>{item.title}</strong>
                    <div className="v2-muted" style={{ fontSize: 12 }}>{item.student_name || "—"}{item.team_members ? ` · ${item.team_members}` : ""}</div>
                  </td>
                  <td>{item.class_level || "—"}{item.section ? ` · ${item.section}` : ""}</td>
                  <td className="sf-wrap-cell">{item.project_type}<div className="v2-muted" style={{ fontSize: 12 }}>{item.category}</div></td>
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
                      placeholder="1st place"
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
                        title="Project QR — teachers scan to verify"
                      >
                        <QrCode size={14} />
                      </a>
                      <button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(item)}><Trash2 size={14} /></button>
                    </span>
                  </td>
                </tr>
              ))}
              {!visible.length && !loading ? <tr><td colSpan={6}><Empty>No items yet — add one from the form on the right.</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Add a collection item">
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <div>
            <label className="v2-label">Project name</label>
            <input className="v2-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label className="v2-label">Category</label>
            <input className="v2-input" list="fair-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <datalist id="fair-categories">
              {categories.map((category) => <option key={category} value={category} />)}
            </datalist>
          </div>
          <div>
            <label className="v2-label">Details</label>
            <textarea className="v2-textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">Type</label>
              <select className="v2-select" value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })}>
                {typeOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="v2-label">Status</label>
              <select className="v2-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {statusOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">Student name</label>
              <input className="v2-input" value={form.student_name} onChange={(e) => setForm({ ...form, student_name: e.target.value })} />
            </div>
            <div>
              <label className="v2-label">ID</label>
              <input className="v2-input" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">Class</label>
              <input className="v2-input" value={form.class_level} onChange={(e) => setForm({ ...form, class_level: e.target.value })} />
            </div>
            <div>
              <label className="v2-label">Section</label>
              <input className="v2-input" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="v2-label">Team members</label>
            <textarea className="v2-textarea" rows={2} value={form.team_members} onChange={(e) => setForm({ ...form, team_members: e.target.value })} />
          </div>
          <div>
            <label className="v2-label">Club</label>
            <select className="v2-select" value={form.club_slug} onChange={(e) => setForm({ ...form, club_slug: e.target.value })}>
              <option value="">— No club —</option>
              {clubs.map((club) => <option key={club.slug} value={club.slug}>{club.name}</option>)}
            </select>
          </div>
          <div>
            <label className="v2-label"><ImageIcon size={13} style={{ verticalAlign: -2 }} /> Project photo</label>
            <ImageField value={form.image_url} onChange={(next) => setForm({ ...form, image_url: next })} label="Project photo" prefix={fairSlug || "fair"} title={form.title} />
          </div>
          <div>
            <label className="v2-label">Other photos (one per line)</label>
            <textarea className="v2-textarea" rows={2} value={form.gallery_urls} onChange={(e) => setForm({ ...form, gallery_urls: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">Place / award</label>
              <input className="v2-input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="1st place" />
            </div>
            <div>
              <label className="v2-label">Score</label>
              <input className="v2-input" type="number" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
            </div>
          </div>
          <button className="v2-btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Add to collection"}</button>
        </form>
      </Panel>
    </div>
  );
}
