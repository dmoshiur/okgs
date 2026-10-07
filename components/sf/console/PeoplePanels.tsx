"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Copy, Download, FileSpreadsheet, KeyRound, Printer, QrCode, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { bn, formatDate } from "@/lib/format";
import { normalizePortalRole, roleLabels, type PortalRole } from "@/lib/roles";
import { inferCsvHeader, mapCsvHeader, parseDelimited, type CsvUserField } from "@/lib/csv";
import type { PassRow, PublicUser, PortalClass } from "@/lib/portal-db";
import { Empty, Notice, Panel, money, postJson, useApi } from "@/components/sf/console/ui";

const roleOptions = Object.keys(roleLabels) as PortalRole[];

function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface ClassRow extends PortalClass {
  section_list: string[];
  students: number;
}

type ImportField = CsvUserField | "";
interface ImportReviewRow {
  line: number;
  fields: Record<string, string>;
  role: PortalRole;
  included: boolean;
  issues: string[];
}
const importFieldLabels: Array<{ value: CsvUserField; label: string }> = [
  { value: "name", label: "Name / নাম" }, { value: "name_en", label: "English name" }, { value: "student_id", label: "Student ID / আইডি" },
  { value: "class_level", label: "Class / শ্রেণি" }, { value: "section", label: "Section / শাখা" }, { value: "roll", label: "Roll / রোল" },
  { value: "email", label: "Email / ইমেইল" }, { value: "phone", label: "Phone / মোবাইল" }, { value: "role", label: "Role / ভূমিকা" },
  { value: "designation", label: "Designation" }, { value: "session_year", label: "Session" }, { value: "blood_group", label: "Blood group" },
  { value: "address", label: "Address" }, { value: "guardian_name", label: "Guardian name" }, { value: "guardian_phone", label: "Guardian phone" },
];

/* ------------------------------------------------------------------ users */

export function UsersPanel({ canManageAdmins, canManageSuperAdmins = false, fairSlug = "" }: { canManageAdmins: boolean; canManageSuperAdmins?: boolean; fairSlug?: string }) {
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const query = `/api/staff/users?limit=5000${fairSlug ? `&fair=${encodeURIComponent(fairSlug)}` : ""}${role ? `&role=${encodeURIComponent(role)}` : ""}${search ? `&q=${encodeURIComponent(search)}` : ""}${classFilter ? `&class=${encodeURIComponent(classFilter)}` : ""}${sectionFilter ? `&section=${encodeURIComponent(sectionFilter)}` : ""}${paymentStatus ? `&payment_status=${paymentStatus}` : ""}`;
  const { data, loading, reload } = useApi<{ users: PublicUser[] }>(query, [role, search, classFilter, sectionFilter, paymentStatus]);
  const { data: classData } = useApi<{ classes: ClassRow[] }>("/api/staff/classes");
  const [form, setForm] = useState({ name: "", role: "student" as PortalRole, email: "", student_id: "", class_level: "", section: "", phone: "", designation: "", password: "" });
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [delimiter, setDelimiter] = useState(",");
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [importRole, setImportRole] = useState<PortalRole>("student");
  const [importDefaults, setImportDefaults] = useState({ class_level: "", section: "" });
  const [roleOverrides, setRoleOverrides] = useState<Record<number, PortalRole>>({});
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [credentials, setCredentials] = useState<Array<{ name: string; email: string; student_id: string; role: PortalRole; password: string }>>([]);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const users = data?.users ?? [];
  const sections = classData?.classes.find((item) => item.name === classFilter)?.section_list ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    for (const user of users) map.set(user.role, (map.get(user.role) ?? 0) + 1);
    return Array.from(map.entries());
  }, [users]);
  const rawHeaders = parsedRows[0] ?? [];
  const csvRows = hasHeader ? parsedRows.slice(1) : parsedRows;
  const csvHeaders = hasHeader ? rawHeaders : rawHeaders.map((_, index) => `Column ${index + 1}`);
  const reviewRows = useMemo<ImportReviewRow[]>(() => csvRows.map((cells, index) => {
    const fields: Record<string, string> = {};
    mapping.forEach((field, column) => {
      if (field && fields[field] === undefined) fields[field] = String(cells[column] ?? "").trim();
    });
    const fieldRole = normalizePortalRole(fields.role);
    const assignedRole = roleOverrides[index] ?? fieldRole ?? importRole;
    const name = fields.name?.trim() ?? "";
    const email = fields.email?.trim() ?? "";
    const studentId = fields.student_id?.trim() ?? "";
    const issues: string[] = [];
    if (!name) issues.push("নাম নেই");
    if (!email && !studentId) issues.push("ইমেইল বা আইডি নেই");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) issues.push("ইমেইল ভুল");
    if (!roleOptions.includes(assignedRole)) issues.push("ভূমিকা ভুল");
    if (!canManageSuperAdmins && ["admin", "superadmin"].includes(assignedRole)) issues.push("এই ভূমিকার অনুমতি নেই");
    return { line: index + (hasHeader ? 2 : 1), fields, role: assignedRole, included: !excludedRows.has(index), issues };
  }), [csvRows, mapping, roleOverrides, importRole, hasHeader, excludedRows, canManageSuperAdmins]);
  const importRoles = roleOptions.filter((item) => canManageSuperAdmins || (item !== "admin" && item !== "superadmin"));

  function stageImport(text: string, name = "") {
    const parsed = parseDelimited(text);
    if (!parsed.rows.length) { setProblem("CSV ফাইলে কোনো তথ্য পাওয়া যায়নি।"); return; }
    const detected = inferCsvHeader(parsed.rows);
    setParsedRows(parsed.rows);
    setHasHeader(detected);
    setDelimiter(parsed.delimiter);
    setMapping((parsed.rows[0] ?? []).map((cell) => detected ? mapCsvHeader(cell) : ""));
    setRoleOverrides({});
    setExcludedRows(new Set());
    setSourceName(name);
    setProblem("");
  }

  async function loadCsvFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setProblem("CSV ফাইল সর্বোচ্চ ৫ MB হতে পারবে।"); return; }
    try {
      const text = await file.text();
      setImportText(text);
      stageImport(text, file.name);
    } catch {
      setProblem("ফাইলটি পড়া যায়নি। UTF-8 encoded CSV ব্যবহার করুন।");
    }
    event.target.value = "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      const result = await postJson<{ defaultPassword?: string }>("/api/staff/users", { ...form, fair_slug: fairSlug });
      setMessage(`${form.name} যোগ হয়েছে। ${result.defaultPassword ? `ডিফল্ট পাসওয়ার্ড: ${result.defaultPassword}` : "পাসওয়ার্ড সেট করা হয়েছে।"}`);
      setForm({ ...form, name: "", email: "", student_id: "", phone: "", designation: "", password: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "যোগ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function importCsv() {
    const selected = reviewRows.filter((row) => row.included && row.issues.length === 0);
    if (!selected.length) { setProblem("আমদানির জন্য অন্তত একটি বৈধ সারি নির্বাচন করুন।"); return; }
    setBusy(true);
    setProblem("");
    setMessage("");
    setCredentials([]);
    try {
      const result = await postJson<{
        created: number;
        credentials: Array<{ name: string; email: string; student_id: string; role: PortalRole; password: string }>;
        welcome: { attempted: number; delivered: number; failed: number; configured: boolean };
        problems: { line: number; message: string }[];
      }>("/api/staff/import", {
        rows: selected.map((row) => ({ ...row.fields, role: row.role, source_line: row.line })),
        role: importRole,
        class_level: importDefaults.class_level,
        section: importDefaults.section,
        fair_slug: fairSlug,
      });
      setMessage(`${bn(result.created)}টি অ্যাকাউন্ট তৈরি হয়েছে · স্বাগত ইমেইল ${bn(result.welcome?.delivered ?? 0)}/${bn(result.welcome?.attempted ?? 0)} পাঠানো হয়েছে।`);
      setCredentials(result.credentials ?? []);
      if (result.problems?.length) setProblem(`${bn(result.problems.length)}টি সারি বাদ গেছে: ${result.problems.slice(0, 5).map((item) => `${item.line} — ${item.message}`).join(" · ")}`);
      setParsedRows([]);
      setMapping([]);
      setImportText("");
      setImportOpen(false);
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "আমদানি করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  function downloadCredentials() {
    const rows = [["name", "email", "student_id", "role", "temporary_password"], ...credentials.map((item) => [item.name, item.email, item.student_id, item.role, item.password])];
    const csv = "\uFEFF" + rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    downloadText("okgs-import-credentials.csv", csv);
  }

  function exportFilteredUsers() {
    const rows = [["Name", "Role", "Student ID", "Class", "Section", "Email", "Phone", "Status"], ...users.map((item) => [item.name, item.role, item.student_id, item.class_level, item.section, item.email, item.phone, item.is_active ? "active" : "inactive"] as string[])];
    const csv = "\uFEFF" + rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    downloadText("okgs-filtered-users.csv", csv);
  }

  async function resetPassword(user: PublicUser) {
    const next = prompt(`${user.name} এর নতুন পাসওয়ার্ড (খালি রাখলে ডিফল্ট):`, "");
    if (next === null) return;
    try {
      if (next) {
        await postJson(`/api/staff/users/${user.id}?fair=${encodeURIComponent(fairSlug)}`, { password: next }, "PATCH");
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
      await postJson(`/api/staff/users/${user.id}?fair=${encodeURIComponent(fairSlug)}`, { is_active: user.is_active ? 0 : 1 }, "PATCH");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "পরিবর্তন করা যায়নি।");
    }
  }

  async function remove(user: PublicUser) {
    if (!confirm(`${user.name} কে মুছে ফেলবেন? এই কাজটি ফেরানো যাবে না।`)) return;
    try {
      await postJson(`/api/staff/users/${user.id}?fair=${encodeURIComponent(fairSlug)}`, {}, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "মুছে ফেলা যায়নি।");
    }
  }

  return (
    <div className="v2-grid users-panel-root" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(300px, .6fr)" }}>
      <Panel
        title="ব্যবহারকারী"
        className="users-printable"
        action={
          <div className="users-filter-bar no-print">
            <input className="v2-input" placeholder="নাম / আইডি / ইমেইল" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="v2-select" value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setSectionFilter(""); }}>
              <option value="">সব শ্রেণি</option>
              {(classData?.classes ?? []).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
            </select>
            <select className="v2-select" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
              <option value="">সব শাখা</option>
              {sections.map((section) => <option key={section} value={section}>{section}</option>)}
            </select>
            <select className="v2-select" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
              <option value="">পেমেন্ট: সব</option><option value="paid">পরিশোধিত</option><option value="unpaid">বকেয়া</option>
            </select>
            <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => { const params = new URLSearchParams(); if (classFilter) params.set("class", classFilter); if (sectionFilter) params.set("section", sectionFilter); window.open(`/sf/print/cards?${params.toString()}`, "_blank", "noopener,noreferrer"); }} title="Print student ID cards"><Printer size={14} /> Cards</button>
            <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={exportFilteredUsers} title="CSV export"><Download size={14} /> CSV</button>
            <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => window.print()} title="Print filtered list"><Printer size={14} /> Print</button>
          </div>
        }
      >
        <div className="print-heading"><h1>ব্যবহারকারী তালিকা</h1><p>{role ? roleLabels[role as PortalRole] : "সব ভূমিকা"} · {classFilter || "সব শ্রেণি"}{sectionFilter ? ` · ${sectionFilter}` : ""} · {paymentStatus === "paid" ? "পরিশোধিত" : paymentStatus === "unpaid" ? "বকেয়া" : "সব পেমেন্ট"} · {bn(users.length)} জন</p></div>
        <div className="pill-row users-role-filters no-print" style={{ marginBottom: 12 }}>
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
                  <td className="no-print" style={{ whiteSpace: "nowrap" }}>
                    <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => resetPassword(user)} title="পাসওয়ার্ড"><KeyRound size={14} /></button>{" "}
                    <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => toggleActive(user)} title="চালু/বন্ধ"><Users size={14} /></button>{" "}
                    {canManageAdmins ? <button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(user)} title="মুছুন"><Trash2 size={14} /></button> : null}
                  </td>
                </tr>
              ))}
              {!users.length && !loading ? <tr><td colSpan={6}><Empty>কোনো ব্যবহারকারী নেই।</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="v2-grid users-management-tools">
        <Panel title="নতুন ব্যবহারকারী">
          <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
            <div>
              <label className="v2-label">নাম</label>
              <input className="v2-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="v2-label">ভূমিকা</label>
              <select className="v2-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as PortalRole })}>
                {importRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
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
          title="CSV ফাইল আমদানি ও পর্যালোচনা"
          action={<button type="button" className="pill no-print" onClick={() => setImportOpen(!importOpen)}>{importOpen ? "বন্ধ" : "খুলুন"}</button>}
        >
          {importOpen ? (
            <div className="csv-import-flow">
              <p className="v2-muted">CSV/TSV আপলোড বা পেস্ট করুন। আমদানির আগে হেডার ম্যাপিং, প্রতিটি সারি, ভূমিকা এবং বাদ দেওয়ার তালিকা যাচাই করা যাবে।</p>
              <label className="csv-upload no-print"><FileSpreadsheet size={18} /><span><b>CSV ফাইল বাছুন</b><small>{sourceName || "UTF-8 · CSV / TSV / semicolon-separated · সর্বোচ্চ ৫ MB"}</small></span><input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" onChange={loadCsvFile} /></label>
              <textarea className="v2-textarea no-print" rows={5} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={'name,student_id,class_level,section,email\nআবির হাসান,2026-001,দশম শ্রেণি,ক,abir@example.com'} />
              <button className="v2-btn v2-btn-sm no-print" type="button" onClick={() => stageImport(importText, sourceName)} disabled={!importText.trim()}><Upload size={15} /> ডেটা পড়ুন ও ম্যাপ করুন</button>

              {parsedRows.length ? (
                <>
                  <div className="csv-import-controls no-print">
                    <label className="csv-check"><input type="checkbox" checked={hasHeader} onChange={(event) => { setHasHeader(event.target.checked); setMapping(rawHeaders.map((header) => event.target.checked ? mapCsvHeader(header) : "")); }} /> প্রথম সারি হেডার</label>
                    <span className="v2-muted">ডিলিমিটার: {delimiter === "\t" ? "Tab" : delimiter}</span>
                    <label><span className="v2-label">ব্যাচের ডিফল্ট ভূমিকা</span><select className="v2-select" value={importRole} onChange={(event) => { setImportRole(event.target.value as PortalRole); setRoleOverrides({}); }}>
                      {importRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
                    </select></label>
                    <label><span className="v2-label">ডিফল্ট শ্রেণি (ঐচ্ছিক)</span><select className="v2-select" value={importDefaults.class_level} onChange={(event) => setImportDefaults({ class_level: event.target.value, section: "" })}>
                      <option value="">CSV-র মান ব্যবহার</option>{(classData?.classes ?? []).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                    </select></label>
                    {importDefaults.class_level ? <label><span className="v2-label">ডিফল্ট শাখা (ঐচ্ছিক)</span><select className="v2-select" value={importDefaults.section} onChange={(event) => setImportDefaults({ ...importDefaults, section: event.target.value })}>
                      <option value="">CSV-র মান ব্যবহার</option>{(classData?.classes.find((item) => item.name === importDefaults.class_level)?.section_list ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
                    </select></label> : null}
                  </div>

                  <div className="csv-column-mapping no-print" aria-label="CSV header mapping">
                    {csvHeaders.map((header, column) => <label key={`${column}-${header}`}><span title={header}>{header || `Column ${column + 1}`}</span><select className="v2-select" value={mapping[column] ?? ""} onChange={(event) => setMapping((current) => current.map((value, index) => index === column ? event.target.value as ImportField : value))}>
                      <option value="">বাদ দিন</option>{importFieldLabels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select></label>)}
                  </div>

                  <div className="csv-review-summary"><strong>{bn(reviewRows.filter((row) => row.included && !row.issues.length).length)}টি বৈধ সারি নির্বাচিত</strong><span>{bn(reviewRows.filter((row) => row.issues.length).length)}টি সারিতে সংশোধন/বাদ দেওয়া প্রয়োজন · {bn(reviewRows.length)}টি মোট</span></div>
                  <div className="table-scroll csv-review-table">
                    <table className="data-table"><thead><tr><th>নেবে</th><th>লাইন</th><th>নাম</th><th>আইডি / ইমেইল</th><th>শ্রেণি</th><th>ভূমিকা</th><th>পর্যালোচনা</th></tr></thead>
                      <tbody>{reviewRows.map((row, index) => <tr key={`${row.line}-${index}`} className={row.issues.length ? "csv-row-invalid" : ""}>
                        <td><input aria-label={`Include row ${row.line}`} type="checkbox" checked={row.included} onChange={() => setExcludedRows((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })} /></td>
                        <td>{bn(row.line)}</td><td>{row.fields.name || "—"}</td><td>{row.fields.student_id || row.fields.email || "—"}</td><td>{row.fields.class_level || importDefaults.class_level || "—"}{row.fields.section || importDefaults.section ? ` · ${row.fields.section || importDefaults.section}` : ""}</td>
                        <td><select aria-label={`Role for row ${row.line}`} className="v2-select csv-role-select no-print" value={roleOverrides[index] ?? row.role} onChange={(event) => setRoleOverrides((current) => ({ ...current, [index]: event.target.value as PortalRole }))}>{importRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select><span className="print-only">{roleLabels[row.role]}</span></td>
                        <td>{row.issues.length ? <span className="status-bad">{row.issues.join(" · ")}</span> : <span className="status-ok"><CheckCircle2 size={13} /> ঠিক আছে</span>}</td>
                      </tr>)}</tbody>
                    </table>
                  </div>
                  <button className="v2-btn no-print" type="button" onClick={() => void importCsv()} disabled={busy || !reviewRows.some((row) => row.included && !row.issues.length)}><Upload size={15} /> {busy ? "আমদানি হচ্ছে…" : "পর্যালোচিত সারি নিশ্চিত করে আমদানি করুন"}</button>
                </>
              ) : null}
            </div>
          ) : <Empty>আপলোড বা পেস্টের পর কলাম ম্যাপিং ও সারি যাচাই করে নিশ্চিত করুন।</Empty>}
          {credentials.length ? <div className="credential-result"><div><strong>একবারের লগইন তথ্য</strong><p>স্বাগত ইমেইল পৌঁছায়নি বা ইমেইল দেওয়া হয়নি—এই অস্থায়ী পাসওয়ার্ডগুলো এখনই ডাউনলোড/নিরাপদে বিতরণ করুন। এগুলো আবার দেখানো হবে না।</p></div><button className="v2-btn v2-btn-sm" type="button" onClick={downloadCredentials}><Download size={14} /> Credential CSV</button><div className="table-scroll"><table className="data-table"><thead><tr><th>নাম</th><th>ইমেইল / আইডি</th><th>ভূমিকা</th><th>অস্থায়ী পাসওয়ার্ড</th></tr></thead><tbody>{credentials.map((item, index) => <tr key={`${item.student_id}-${index}`}><td>{item.name}</td><td>{item.email || item.student_id}</td><td>{roleLabels[item.role]}</td><td><code>{item.password}</code></td></tr>)}</tbody></table></div></div> : null}
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- classes */

export function ClassesPanel({ fairSlug }: { fairSlug: string }) {
  interface FeeSummary { expected: number; collected: number; pending: number; students: number; fee_amount: number; title: string; session_year: string }
  interface FeeDraft { fee_amount: string; fee_title: string; fee_session: string }
  const { data, loading, reload } = useApi<{ classes: (ClassRow & { fee_summary: FeeSummary })[]; fee_totals?: { expected: number; collected: number; pending: number } }>(`/api/staff/classes?fair=${encodeURIComponent(fairSlug)}`, [fairSlug]);
  const year = String(new Date().getFullYear());
  const [form, setForm] = useState({ name: "", sections: "ক, খ", level: "", fee_amount: "", fee_title: "শ্রেণি ফি", fee_session: year });
  const [feeDrafts, setFeeDrafts] = useState<Record<string, FeeDraft>>({});
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState("");

  const classes = data?.classes ?? [];
  const draftFor = (item: ClassRow) => feeDrafts[item.id] ?? { fee_amount: String(item.fee_amount ?? 0), fee_title: item.fee_title || "শ্রেণি ফি", fee_session: item.fee_session || year };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setProblem("");
    setBusy("create");
    try {
      await postJson("/api/staff/classes", { ...form, fair_slug: fairSlug, level: Number(form.level) || 0, fee_amount: Number(form.fee_amount) || 0 });
      setMessage(`${form.name} যোগ হয়েছে।`);
      setForm({ name: "", sections: "ক, খ", level: "", fee_amount: "", fee_title: "শ্রেণি ফি", fee_session: year });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "যোগ করা যায়নি।");
    } finally {
      setBusy("");
    }
  }

  async function saveFee(item: ClassRow) {
    const draft = draftFor(item);
    setProblem("");
    setBusy(item.id);
    try {
      const result = await postJson<{ fee_sync?: { created: number; updated: number } }>("/api/staff/classes", { id: item.id, fair_slug: fairSlug, ...draft, fee_amount: Number(draft.fee_amount) || 0 }, "PATCH");
      const sync = result.fee_sync;
      setMessage(sync?.created ? `${item.name}: ${bn(sync.created)} জন শিক্ষার্থীর পাওনা তৈরি হয়েছে।` : `${item.name} এর ফি সেটিংস আপডেট হয়েছে।`);
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "ফি আপডেট করা যায়নি।");
    } finally {
      setBusy("");
    }
  }

  async function remove(id: string) {
    if (!confirm("শ্রেণিটি মুছে ফেলবেন? সংরক্ষিত পাওনার ইতিহাস মুছবে না।")) return;
    try {
      await postJson("/api/staff/classes", { id }, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "মুছে ফেলা যায়নি।");
    }
  }

  const totals = data?.fee_totals;
  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, .65fr)" }}>
      <Panel title="শ্রেণি, শিক্ষার্থী ও নির্ধারিত ফি" action={totals ? <span className="badge-soft">প্রত্যাশিত {money(totals.expected)} · জমা {money(totals.collected)} · বাকি {money(totals.pending)}</span> : null}>
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        <div className="class-fee-list">
          {classes.map((item) => {
            const draft = draftFor(item);
            const summary = item.fee_summary;
            return (
              <article className="class-fee-card" key={item.id}>
                <div className="class-fee-heading">
                  <div><strong>{item.name}</strong><span>{item.section_list.join(" · ") || "শাখা নেই"} · {bn(item.students)} জন শিক্ষার্থী</span></div>
                  <button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(item.id)} aria-label={`${item.name} মুছুন`}><Trash2 size={14} /></button>
                </div>
                <div className="class-fee-stats">
                  <span>প্রত্যাশিত <b>{money(summary?.expected ?? 0)}</b></span>
                  <span>আদায় <b>{money(summary?.collected ?? 0)}</b></span>
                  <span>বাকি <b>{money(summary?.pending ?? 0)}</b></span>
                </div>
                <div className="class-fee-edit">
                  <label><span className="v2-label">শিক্ষার্থীপ্রতি ফি</span><input className="v2-input" type="number" min={0} value={draft.fee_amount} onChange={(event) => setFeeDrafts((state) => ({ ...state, [item.id]: { ...draft, fee_amount: event.target.value } }))} /></label>
                  <label><span className="v2-label">ফি/খাতের নাম</span><input className="v2-input" value={draft.fee_title} onChange={(event) => setFeeDrafts((state) => ({ ...state, [item.id]: { ...draft, fee_title: event.target.value } }))} /></label>
                  <label><span className="v2-label">সেশন</span><input className="v2-input" value={draft.fee_session} onChange={(event) => setFeeDrafts((state) => ({ ...state, [item.id]: { ...draft, fee_session: event.target.value } }))} /></label>
                  <button className="v2-btn v2-btn-sm" type="button" disabled={busy === item.id} onClick={() => void saveFee(item)}>{busy === item.id ? "সেভ হচ্ছে…" : "ফি সংরক্ষণ"}</button>
                </div>
              </article>
            );
          })}
          {!classes.length && !loading ? <Empty>কোনো শ্রেণি নেই।</Empty> : null}
          {loading ? <Empty>লোড হচ্ছে…</Empty> : null}
        </div>
      </Panel>

      <Panel title="নতুন শ্রেণি">
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <label><span className="v2-label">শ্রেণির নাম</span><input className="v2-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="একাদশ শ্রেণি" required /></label>
          <label><span className="v2-label">শাখা (কমা দিয়ে)</span><input className="v2-input" value={form.sections} onChange={(event) => setForm({ ...form, sections: event.target.value })} /></label>
          <label><span className="v2-label">ক্রম</span><input className="v2-input" type="number" value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })} /></label>
          <label><span className="v2-label">শিক্ষার্থীপ্রতি ফি (ঐচ্ছিক)</span><input className="v2-input" type="number" min={0} value={form.fee_amount} onChange={(event) => setForm({ ...form, fee_amount: event.target.value })} /></label>
          <label><span className="v2-label">ফি/খাতের নাম</span><input className="v2-input" value={form.fee_title} onChange={(event) => setForm({ ...form, fee_title: event.target.value })} /></label>
          <label><span className="v2-label">সেশন</span><input className="v2-input" value={form.fee_session} onChange={(event) => setForm({ ...form, fee_session: event.target.value })} /></label>
          <button className="v2-btn" type="submit" disabled={busy === "create"}>{busy === "create" ? "যোগ হচ্ছে…" : "শ্রেণি যোগ করুন"}</button>
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
  const [form, setForm] = useState({ user_id: "", holder_name: "", class_level: "", section: "", holder_role: "student", phone: "", note: "", guest_limit: "" });
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
      const requestBody: Record<string, unknown> = { ...form, ...target, fair_slug: fairSlug };
      if (form.guest_limit === "") delete requestBody.guest_limit;
      else requestBody.guest_limit = Number(form.guest_limit);
      const result = await postJson<{ created: { holder_name: string; parent_pass_id?: string; guest_index?: number }[] }>("/api/staff/passes", requestBody);
      const guestCount = result.created.filter((item) => Boolean(item.parent_pass_id)).length;
      setMessage(`${bn(result.created.length - guestCount)}টি মূল পাস ও ${bn(guestCount)}টি অতিথি পাস ইস্যু/আপডেট হয়েছে।`);
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
                  <td><strong>{pass.holder_name}</strong><div className="v2-muted" style={{ fontSize: 12 }}>{pass.parent_pass_id ? `অতিথি পাস #${bn(pass.guest_index)}` : pass.guest_limit ? `${bn(pass.guest_limit)}টি অতিথি পাস বরাদ্দ` : roleLabels[pass.holder_role as PortalRole] || pass.holder_role}{pass.student_id ? ` · ${pass.student_id}` : ""}</div></td>
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
            <div>
              <label className="v2-label">এই শিক্ষার্থীর জন্য অতিথি/অভিভাবক পাস (সর্বোচ্চ ৪)</label>
              <select className="v2-select" value={form.guest_limit} onChange={(event) => setForm({ ...form, guest_limit: event.target.value })}>
                <option value="">বর্তমান বরাদ্দ অপরিবর্তিত রাখুন</option>
                {[0, 1, 2, 3, 4].map((count) => <option key={count} value={count}>{count === 0 ? "অতিথি পাস নয়" : `${count}টি অতিথি QR পাস`}</option>)}
              </select>
            </div>
            <button className="v2-btn" type="button" onClick={() => issue({})} disabled={busy || !form.holder_name}>
              <QrCode size={16} /> মূল পাস / অতিথি পাস ইস্যু করুন
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
