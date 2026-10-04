"use client";

import { useMemo, useState } from "react";
import { Copy, KeyRound, Printer, QrCode, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { bn, formatDate } from "@/lib/format";
import { roleLabels, type PortalRole } from "@/lib/roles";
import type { PassRow, PublicUser, PortalClass } from "@/lib/portal-db";
import { Empty, Notice, Panel, money, postJson, useApi } from "@/components/sf/console/ui";

const roleOptions = Object.keys(roleLabels) as PortalRole[];

interface ClassRow extends PortalClass {
  section_list: string[];
  students: number;
}

/* ------------------------------------------------------------------ users */

export function UsersPanel({ canManageAdmins }: { canManageAdmins: boolean }) {
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const query = `/api/staff/users?limit=800${role ? `&role=${role}` : ""}${search ? `&q=${encodeURIComponent(search)}` : ""}${classFilter ? `&class=${encodeURIComponent(classFilter)}` : ""}`;
  const { data, loading, reload } = useApi<{ users: PublicUser[] }>(query, [role, search, classFilter]);
  const { data: classData } = useApi<{ classes: ClassRow[] }>("/api/staff/classes");
  const [form, setForm] = useState({ name: "", role: "student" as PortalRole, email: "", student_id: "", class_level: "", section: "", phone: "", designation: "", password: "" });
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const users = data?.users ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    for (const user of users) {
      const key = user.role;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries());
  }, [users]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      const result = await postJson<{ defaultPassword?: string }>("/api/staff/users", form);
      setMessage(
        `${form.name} যোগ হয়েছে। ${result.defaultPassword ? `ডিফল্ট পাসওয়ার্ড: ${result.defaultPassword}` : "পাসওয়ার্ড সেট করা হয়েছে।"}`,
      );
      setForm({ ...form, name: "", email: "", student_id: "", phone: "", designation: "", password: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "যোগ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function importCsv() {
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      const result = await postJson<{ created: number; defaultPassword: string; problems: { line: number; message: string }[] }>("/api/staff/import", {
        csv,
        role: form.role,
        class_level: form.class_level,
        section: form.section,
      });
      setMessage(`${bn(result.created)} জন শিক্ষার্থী যোগ হয়েছে। ডিফল্ট পাসওয়ার্ড: ${result.defaultPassword}`);
      if (result.problems?.length) setProblem(`${bn(result.problems.length)} টি লাইনে সমস্যা: ${result.problems.slice(0, 4).map((p) => `${p.line} — ${p.message}`).join(", ")}`);
      setCsv("");
      setImportOpen(false);
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "আমদানি করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(user: PublicUser) {
    const next = prompt(`${user.name} এর নতুন পাসওয়ার্ড (খালি রাখলে ডিফল্ট):`, "");
    if (next === null) return;
    try {
      if (next) {
        await postJson(`/api/staff/users/${user.id}`, { password: next }, "PATCH");
        setMessage(`${user.name} এর পাসওয়ার্ড বদলানো হয়েছে।`);
      } else {
        const result = await postJson<{ hint?: string }>("/api/staff/users", { id: user.id }, "PATCH");
        setMessage(`${user.name} — ডিফল্ট পাসওয়ার্ড ${result.hint || "সেট হয়েছে"}।`);
      }
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "পাসওয়ার্ড বদলানো যায়নি।");
    }
  }

  async function toggleActive(user: PublicUser) {
    try {
      await postJson(`/api/staff/users/${user.id}`, { is_active: user.is_active ? 0 : 1 }, "PATCH");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "পরিবর্তন করা যায়নি।");
    }
  }

  async function remove(user: PublicUser) {
    if (!confirm(`${user.name} কে মুছে ফেলবেন? এই কাজটি ফেরানো যাবে না।`)) return;
    try {
      await postJson(`/api/staff/users/${user.id}`, {}, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "মুছে ফেলা যায়নি।");
    }
  }

  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(300px, .6fr)" }}>
      <Panel
        title="ব্যবহারকারী"
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input className="v2-input" style={{ width: 190 }} placeholder="নাম / আইডি / ইমেইল" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="v2-select" style={{ width: 150 }} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">সব শ্রেণি</option>
              {(classData?.classes ?? []).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
            </select>
          </div>
        }
      >
        <div className="pill-row" style={{ marginBottom: 12 }}>
          <button type="button" className={`pill ${role === "" ? "is-on" : ""}`} onClick={() => setRole("")}>সব ({bn(users.length)})</button>
          {grouped.map(([key, count]) => (
            <button key={key} type="button" className={`pill ${role === key ? "is-on" : ""}`} onClick={() => setRole(key)}>
              {roleLabels[key as PortalRole] ?? key} ({bn(count)})
            </button>
          ))}
        </div>

        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>নাম</th><th>ভূমিকা</th><th>শ্রেণি</th><th>লগইন</th><th>অবস্থা</th><th /></tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <div className="v2-muted" style={{ fontSize: 12 }}>{user.designation || user.club_slug || user.guardian_name || "—"}</div>
                  </td>
                  <td>{roleLabels[user.role] ?? user.role}</td>
                  <td>{user.class_level || "—"}{user.section ? ` · ${user.section}` : ""}</td>
                  <td>
                    <div style={{ fontSize: 12 }}>{user.email || "—"}</div>
                    <div className="v2-muted" style={{ fontSize: 12 }}>{user.student_id || ""}</div>
                  </td>
                  <td className={user.is_active ? "status-ok" : "status-bad"}>{user.is_active ? "সক্রিয়" : "বন্ধ"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => resetPassword(user)} title="পাসওয়ার্ড"><KeyRound size={14} /></button>{" "}
                    <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => toggleActive(user)} title="চালু/বন্ধ"><Users size={14} /></button>{" "}
                    {canManageAdmins ? (
                      <button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(user)} title="মুছুন"><Trash2 size={14} /></button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!users.length && !loading ? <tr><td colSpan={6}><Empty>কোনো ব্যবহারকারী নেই।</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="v2-grid">
        <Panel title="নতুন ব্যবহারকারী">
          <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
            <div>
              <label className="v2-label">নাম</label>
              <input className="v2-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="v2-label">ভূমিকা</label>
              <select className="v2-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as PortalRole })}>
                {roleOptions.filter((role) => canManageAdmins || role !== "admin").map((role) => (
                  <option key={role} value={role}>{roleLabels[role]}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label className="v2-label">ইমেইল</label>
                <input className="v2-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="v2-label">আইডি নম্বর</label>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label className="v2-label">মোবাইল</label>
                <input className="v2-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="v2-label">পদবি</label>
                <input className="v2-input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="শ্রেণি শিক্ষক" />
              </div>
            </div>
            <div>
              <label className="v2-label">পাসওয়ার্ড (খালি রাখলে ডিফল্ট)</label>
              <input className="v2-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <button className="v2-btn" type="submit" disabled={busy}><UserPlus size={16} /> যোগ করুন</button>
          </form>
        </Panel>

        <Panel
          title="CSV আমদানি"
          action={<button type="button" className="pill" onClick={() => setImportOpen(!importOpen)}>{importOpen ? "বন্ধ" : "খুলুন"}</button>}
        >
          {importOpen ? (
            <div style={{ display: "grid", gap: 10 }}>
              <p className="v2-muted" style={{ margin: 0, fontSize: 13 }}>
                হেডার: <code>name, student_id, class_level, section, roll, email, phone</code> — Excel/Google Sheets থেকে কপি করে পেস্ট করুন।
              </p>
              <textarea
                className="v2-textarea"
                rows={7}
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder={"name,student_id,class_level,section\nআবির হাসান,2026-001,দশম শ্রেণি,ক"}
              />
              <button className="v2-btn" type="button" onClick={importCsv} disabled={busy || !csv.trim()}>
                <Upload size={16} /> আমদানি করুন
              </button>
            </div>
          ) : (
            <Empty>একসাথে অনেক শিক্ষার্থী যোগ করতে CSV আমদানি ব্যবহার করুন।</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- classes */

export function ClassesPanel() {
  const { data, loading, reload } = useApi<{ classes: ClassRow[] }>("/api/staff/classes");
  const [form, setForm] = useState({ name: "", sections: "ক, খ", level: "" });
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");

  const classes = data?.classes ?? [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setProblem("");
    try {
      await postJson("/api/staff/classes", { name: form.name, sections: form.sections, level: Number(form.level) || 0 });
      setMessage(`${form.name} যোগ হয়েছে।`);
      setForm({ name: "", sections: "ক, খ", level: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "যোগ করা যায়নি।");
    }
  }

  async function remove(id: string) {
    if (!confirm("শ্রেণিটি মুছে ফেলবেন?")) return;
    try {
      await postJson("/api/staff/classes", { id }, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "মুছে ফেলা যায়নি।");
    }
  }

  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.3fr) minmax(280px, .7fr)" }}>
      <Panel title="শ্রেণি ও শাখা">
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>শ্রেণি</th><th>শাখা</th><th>শিক্ষার্থী</th><th>ক্রম</th><th /></tr></thead>
            <tbody>
              {classes.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.section_list.join(", ") || "—"}</td>
                  <td>{bn(item.students)}</td>
                  <td>{bn(item.sort_order)}</td>
                  <td><button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(item.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {!classes.length && !loading ? <tr><td colSpan={5}><Empty>কোনো শ্রেণি নেই।</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="নতুন শ্রেণি">
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <div>
            <label className="v2-label">শ্রেণির নাম</label>
            <input className="v2-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="একাদশ শ্রেণি" required />
          </div>
          <div>
            <label className="v2-label">শাখা (কমা দিয়ে)</label>
            <input className="v2-input" value={form.sections} onChange={(e) => setForm({ ...form, sections: e.target.value })} />
          </div>
          <div>
            <label className="v2-label">ক্রম (ছোট সংখ্যা আগে)</label>
            <input className="v2-input" type="number" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
          </div>
          <button className="v2-btn" type="submit">শ্রেণি যোগ করুন</button>
        </form>
      </Panel>
    </div>
  );
}

/* ----------------------------------------------------------------- passes */

export function PassesPanel({ fairSlug, fairName }: { fairSlug: string; fairName: string }) {
  const { data, loading, reload } = useApi<{
    passes: PassRow[];
    stats: Record<string, number>;
    candidates: PublicUser[];
  }>(`/api/staff/passes?fair=${encodeURIComponent(fairSlug)}`, [fairSlug]);
  const [form, setForm] = useState({ user_id: "", holder_name: "", class_level: "", section: "", holder_role: "student", phone: "", note: "" });
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const passes = data?.passes ?? [];
  const stats = data?.stats ?? {};
  const candidates = (data?.candidates ?? []).filter((user) =>
    !search ? false : `${user.name} ${user.student_id} ${user.class_level}`.toLowerCase().includes(search.toLowerCase()),
  ).slice(0, 8);

  async function issue(target: Partial<typeof form> & { all?: boolean }) {
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      const result = await postJson<{ created: { holder_name: string }[] }>("/api/staff/passes", { ...form, ...target, fair_slug: fairSlug });
      setMessage(`${bn(result.created.length)} টি QR পাস তৈরি হয়েছে।`);
      setForm({ ...form, user_id: "", holder_name: "", class_level: "", section: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "পাস তৈরি করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(pass: PassRow) {
    try {
      await postJson("/api/staff/passes", { id: pass.id, status: pass.status === "revoked" ? "active" : "revoked" }, "PATCH");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "পরিবর্তন করা যায়নি।");
    }
  }

  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.35fr) minmax(300px, .65fr)" }}>
      <Panel
        title="QR পাস"
        action={
          <div className="pill-row">
            <span className="badge-soft">সক্রিয় {bn(stats.active ?? 0)}</span>
            <span className="badge-soft">ব্যবহৃত {bn(stats.used ?? 0)}</span>
            <span className="badge-soft">বাতিল {bn(stats.revoked ?? 0)}</span>
          </div>
        }
      >
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>নাম</th><th>শ্রেণি</th><th>স্ট্যাটাস</th><th>স্ক্যান</th><th>শেষ</th><th /></tr></thead>
            <tbody>
              {passes.map((pass) => (
                <tr key={pass.id}>
                  <td><strong>{pass.holder_name}</strong><div className="v2-muted" style={{ fontSize: 12 }}>{pass.holder_role}{pass.student_id ? ` · ${pass.student_id}` : ""}</div></td>
                  <td>{pass.class_level}{pass.section ? ` · ${pass.section}` : ""}</td>
                  <td className={pass.status === "active" ? "status-ok" : pass.status === "used" ? "status-pending" : "status-bad"}>
                    {pass.status === "active" ? "সক্রিয়" : pass.status === "used" ? "ব্যবহৃত" : "বাতিল"}
                  </td>
                  <td>{bn(pass.scan_count)}</td>
                  <td className="v2-muted" style={{ fontSize: 12 }}>{pass.last_scan_at ? formatDate(pass.last_scan_at) : "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <a className="v2-btn v2-btn-sm v2-btn-ghost" href={`/pass/${pass.token}`} target="_blank" rel="noreferrer" title="কার্ড দেখুন"><Printer size={14} /></a>{" "}
                    <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => revoke(pass)} title="বাতিল/চালু">
                      <QrCode size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!passes.length && !loading ? <tr><td colSpan={6}><Empty>এই মেলার জন্য এখনো কোনো পাস তৈরি হয়নি।</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="v2-grid">
        <Panel title="একজনের জন্য পাস">
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <label className="v2-label">ব্যবহারকারী খুঁজুন</label>
              <input className="v2-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম / আইডি / শ্রেণি" />
              {candidates.length ? (
                <div className="pill-row" style={{ marginTop: 8 }}>
                  {candidates.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="pill"
                      onClick={() => setForm({ ...form, user_id: user.id, holder_name: user.name, class_level: user.class_level, section: user.section, holder_role: user.role })}
                    >
                      {user.name} · {user.class_level || roleLabels[user.role]}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div>
              <label className="v2-label">নাম</label>
              <input className="v2-input" value={form.holder_name} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} required />
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label className="v2-label">ধরন</label>
                <select className="v2-select" value={form.holder_role} onChange={(e) => setForm({ ...form, holder_role: e.target.value })}>
                  {roleOptions.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                </select>
              </div>
              <div>
                <label className="v2-label">মোবাইল</label>
                <input className="v2-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <button className="v2-btn" type="button" onClick={() => issue({})} disabled={busy || !form.holder_name}>
              <QrCode size={16} /> পাস তৈরি করুন
            </button>
            <button className="v2-btn v2-btn-ghost" type="button" onClick={() => issue({ all: true, class_level: form.class_level })} disabled={busy}>
              <Copy size={16} /> {form.class_level ? `${form.class_level} — ` : "সব শিক্ষার্থীর"} জন্য পাস
            </button>
            <p className="v2-muted" style={{ margin: 0, fontSize: 12.5 }}>
              {fairName} — পাসের QR কার্ড স্ক্যানার দিয়ে যাচাই করা যায়; ছাপার জন্য /pass/&lt;token&gt; পাতা আছে।
            </p>
          </div>
        </Panel>
        <Panel title="পাস বিতরণ">
          <Bars rows={[{ label: "সক্রিয়", value: stats.active ?? 0 }, { label: "ব্যবহৃত", value: stats.used ?? 0 }, { label: "বাতিল", value: stats.revoked ?? 0 }]} unit="" />
        </Panel>
      </div>
    </div>
  );
}

function Bars({ rows, unit = "৳" }: { rows: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div>
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span>{row.label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.round((row.value / max) * 100)}%` }} /></span>
          <strong style={{ fontSize: 13 }}>{unit === "৳" ? money(row.value) : bn(row.value)}</strong>
        </div>
      ))}
    </div>
  );
}
