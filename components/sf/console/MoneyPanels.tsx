"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Banknote, Pencil, Printer, Receipt, Trash2, Wallet, X } from "lucide-react";
import type { DueRow, ExpenseRow, FundRow } from "@/lib/portal-db";
import { bn, formatDate } from "@/lib/format";
import { Bars, Empty, money, Notice, Panel, useApi, postJson } from "@/components/sf/console/ui";

interface ClassOption {
  name: string;
  level?: number;
  section_list: string[];
}

const methods = ["নগদ", "বিকাশ", "নগদ (Nagad)", "রকেট", "ব্যাংক", "অনলাইন"];
const purposes = ["বিজ্ঞান মেলা ফান্ড", "ক্লাস ফান্ড", "ক্লাব ফান্ড", "ভর্তি ফি", "পাওনা পরিশোধ", "প্রাক্তন শিক্ষার্থী অনুদান"];

/* ------------------------------------------------------------------ funds */

export function FundsPanel({ fairSlug }: { fairSlug: string }) {
  const [status, setStatus] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const { data: classOptions } = useApi<{ classes: ClassOption[] }>("/api/staff/classes");
  const query = `/api/staff/funds?fair=${encodeURIComponent(fairSlug)}${status ? `&status=${status}` : ""}${classFilter ? `&class=${encodeURIComponent(classFilter)}` : ""}`;
  const { data, loading, error, reload } = useApi<{ funds: FundRow[] }>(query, [fairSlug, status, classFilter]);
  const { data: dueData } = useApi<{ dues: DueRow[] }>(`/api/staff/dues?fair=${encodeURIComponent(fairSlug)}&limit=1000`, [fairSlug]);
  const [form, setForm] = useState({ payer_name: "", class_level: "", section: "", student_id: "", phone: "", user_id: "", due_id: "", amount: "", method: "নগদ", trx_id: "", purpose: purposes[0], note: "" });
  const [editing, setEditing] = useState("");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const funds = data?.funds ?? [];
  const totals = useMemo(() => {
    const verified = funds.filter((fund) => fund.status === "verified").reduce((sum, fund) => sum + Number(fund.amount), 0);
    const pending = funds.filter((fund) => fund.status === "pending").reduce((sum, fund) => sum + Number(fund.amount), 0);
    return { verified, pending };
  }, [funds]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setProblem("");
    try {
      if (editing) {
        await postJson("/api/staff/funds", { ...form, id: editing, fair_slug: fairSlug, amount: Number(form.amount) || 0 }, "PATCH");
        setMessage(`${form.payer_name || "এন্ট্রি"} সম্পাদনা করা হয়েছে।`);
      } else {
        await postJson("/api/staff/funds", { ...form, fair_slug: fairSlug, amount: Number(form.amount) || 0, status: "verified" });
        setMessage(`${form.payer_name || "এন্ট্রি"} — ${form.amount} টাকা জমা হয়েছে।`);
      }
      setEditing("");
      setForm({ ...form, payer_name: "", amount: "", trx_id: "", note: "", student_id: "", due_id: "", user_id: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "সংরক্ষণ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(fund: FundRow) {
    setEditing(fund.id);
    setForm({ payer_name: fund.payer_name, class_level: fund.class_level, section: fund.section, student_id: fund.student_id, phone: fund.phone, user_id: fund.user_id, due_id: fund.due_id, amount: String(fund.amount), method: fund.method, trx_id: fund.trx_id, purpose: fund.purpose, note: fund.note });
    setProblem("");
    setMessage("");
  }

  async function setFundStatus(id: string, next: "verified" | "rejected") {
    try {
      await postJson("/api/staff/funds", { id, status: next }, "PATCH");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "পরিবর্তন করা যায়নি।");
    }
  }

  async function remove(id: string) {
    if (!confirm("এই এন্ট্রিটি মুছে ফেলবেন?")) return;
    try {
      await postJson("/api/staff/funds", { id, confirm: "delete" }, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "মুছে ফেলা যায়নি।");
    }
  }

  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, .6fr)" }}>
      <Panel
        title="ফান্ডের খাতা"
        action={
          <div className="pill-row">
            {[
              { id: "", label: "সব" },
              { id: "verified", label: "যাচাইকৃত" },
              { id: "pending", label: "অপেক্ষমাণ" },
              { id: "rejected", label: "বাতিল" },
            ].map((option) => (
              <button key={option.id} type="button" className={`pill ${status === option.id ? "is-on" : ""}`} onClick={() => setStatus(option.id)}>
                {option.label}
              </button>
            ))}
            <select className="v2-select" value={classFilter} onChange={(event) => setClassFilter(event.target.value)} aria-label="Filter by class"><option value="">সব শ্রেণি</option>{(classOptions?.classes ?? []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
            <a className="v2-btn v2-btn-sm v2-btn-ghost" href={`/sf/print/collections?fair=${encodeURIComponent(fairSlug)}${status ? `&status=${status}` : ""}${classFilter ? `&class=${encodeURIComponent(classFilter)}` : ""}`} target="_blank" rel="noreferrer"><Printer size={14} /> Collection report</a>
          </div>
        }
      >
        <div className="pill-row" style={{ marginBottom: 14 }}>
          <span className="badge-soft">যাচাইকৃত {money(totals.verified)}</span>
          <span className="badge-soft">অপেক্ষমাণ {money(totals.pending)}</span>
          <span className="badge-soft">মোট {bn(funds.length)} এন্ট্রি</span>
        </div>
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>নাম</th>
                <th>শ্রেণি / শাখা</th>
                <th>উদ্দেশ্য</th>
                <th>মাধ্যম</th>
                <th>টাকা</th>
                <th>অবস্থা</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {funds.map((fund) => (
                <tr key={fund.id}>
                  <td>
                    <strong>{fund.payer_name}</strong>
                    <div className="v2-muted" style={{ fontSize: 12 }}>{fund.student_id || fund.phone || "—"}</div>
                  </td>
                  <td>{fund.class_level || "—"}{fund.section ? ` · ${fund.section}` : ""}</td>
                  <td>{fund.purpose}<div className="v2-muted" style={{ fontSize: 12 }}>রসিদ {fund.receipt_no} · {formatDate(fund.created_at)}</div></td>
                  <td>{fund.method}{fund.trx_id ? <div className="v2-muted" style={{ fontSize: 12 }}>{fund.trx_id}</div> : null}</td>
                  <td><strong>{money(fund.amount)}</strong></td>
                  <td className={fund.status === "verified" ? "status-ok" : fund.status === "pending" ? "status-pending" : "status-bad"}>{fund.status === "verified" ? "যাচাই" : fund.status === "pending" ? "অপেক্ষা" : "বাতিল"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <a className="v2-btn v2-btn-sm v2-btn-ghost" href={`/sf/print/receipt/${fund.id}`} target="_blank" rel="noreferrer" title="রসিদ ছাপুন"><Printer size={14} /></a>{" "}
                    <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => startEdit(fund)} title="সম্পাদনা"><Pencil size={14} /></button>{" "}
                    {fund.status !== "verified" ? (
                      <button className="v2-btn v2-btn-sm" type="button" onClick={() => setFundStatus(fund.id, "verified")} title="যাচাই করুন">
                        <BadgeCheck size={14} />
                      </button>
                    ) : null}{" "}
                    {fund.status !== "rejected" ? (
                      <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => setFundStatus(fund.id, "rejected")} title="বাতিল">
                        <X size={14} />
                      </button>
                    ) : null}{" "}
                    <button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(fund.id)} title="মুছুন">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!funds.length && !loading ? (
                <tr>
                  <td colSpan={7}><Empty>এই ফিল্টারে কোনো এন্ট্রি নেই।</Empty></td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {loading ? <Empty>লোড হচ্ছে…</Empty> : null}
        {error ? <Notice kind="bad">{error}</Notice> : null}
      </Panel>

      <Panel title="হাতে টাকা জমা নিন">
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <div>
            <label className="v2-label">শিক্ষার্থী / দাতার নাম</label>
            <input className="v2-input" value={form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">শ্রেণি</label>
              <input className="v2-input" value={form.class_level} onChange={(e) => setForm({ ...form, class_level: e.target.value })} placeholder="দশম শ্রেণি" />
            </div>
            <div>
              <label className="v2-label">শাখা</label>
              <input className="v2-input" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="ক" />
            </div>
          </div>
          <div>
            <label className="v2-label">আইডি নম্বর</label>
            <input className="v2-input" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
          </div>
          <div>
            <label className="v2-label">পাওনার সাথে যুক্ত করুন (ঐচ্ছিক)</label>
            <select className="v2-select" value={form.due_id} onChange={(event) => {
              const due = (dueData?.dues ?? []).find((item) => item.id === event.target.value);
              setForm({ ...form, due_id: event.target.value, user_id: due?.user_id || form.user_id, payer_name: due?.student_name || form.payer_name, class_level: due?.class_level || form.class_level, section: due?.section || form.section, student_id: due?.student_id || form.student_id, purpose: due?.title || form.purpose });
            }}>
              <option value="">পাওনা নয় — সাধারণ রসিদ</option>
              {(dueData?.dues ?? []).filter((due) => Math.max(0, Number(due.amount) - Number(due.paid_amount) - Number(due.pending_amount ?? 0)) > 0).map((due) => <option key={due.id} value={due.id}>{due.student_name} · {due.title} · বাকি {money(Math.max(0, Number(due.amount) - Number(due.paid_amount) - Number(due.pending_amount ?? 0)))}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">টাকা</label>
              <input className="v2-input" type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div>
              <label className="v2-label">মাধ্যম</label>
              <select className="v2-select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {methods.map((method) => <option key={method}>{method}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="v2-label">উদ্দেশ্য</label>
            <select className="v2-select" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              {purposes.map((purpose) => <option key={purpose}>{purpose}</option>)}
            </select>
          </div>
          <div>
            <label className="v2-label">ট্রানজেকশন / মোবাইল</label>
            <input className="v2-input" value={form.trx_id} onChange={(e) => setForm({ ...form, trx_id: e.target.value })} placeholder="bKash TrxID / 01XXXXXXXXX" />
          </div>
          <input type="hidden" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button className="v2-btn" type="submit" disabled={busy}>
            <Banknote size={16} /> {busy ? "সেভ হচ্ছে…" : editing ? "পরিবর্তন সংরক্ষণ" : "জমা যোগ করুন"}
          </button>
          {editing ? <button className="v2-btn v2-btn-ghost" type="button" onClick={() => { setEditing(""); setForm({ payer_name: "", class_level: "", section: "", student_id: "", phone: "", user_id: "", due_id: "", amount: "", method: "নগদ", trx_id: "", purpose: purposes[0], note: "" }); }}>সম্পাদনা বাতিল</button> : null}
        </form>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------- dues */

export function DuesPanel({ fairSlug }: { fairSlug: string }) {
  const { data: classes } = useApi<{ classes: ClassOption[] }>("/api/staff/classes");
  const { data, loading, error, reload } = useApi<{ dues: DueRow[] }>(`/api/staff/dues?fair=${encodeURIComponent(fairSlug)}`, [fairSlug]);
  const [bulk, setBulk] = useState({ class_level: "", section: "", title: "বিজ্ঞান মেলা ফি", amount: "", due_date: "" });
  const [single, setSingle] = useState({ student_name: "", student_id: "", class_level: "", section: "", title: "বিজ্ঞান মেলা ফি", amount: "", due_date: "" });
  const [editingDue, setEditingDue] = useState("");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [tab, setTab] = useState<"bulk" | "single">("bulk");
  const [busy, setBusy] = useState(false);

  const dues = data?.dues ?? [];
  const options = classes?.classes ?? [];
  const sections = options.find((option) => option.name === bulk.class_level)?.section_list ?? [];

  async function createBulk(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      const result = await postJson<{ created: number }>("/api/staff/dues", {
        bulk: true,
        fair_slug: fairSlug,
        class_level: bulk.class_level,
        section: bulk.section,
        title: bulk.title,
        amount: Number(bulk.amount) || 0,
        due_date: bulk.due_date,
      });
      setMessage(`${bn(result.created ?? 0)} জন শিক্ষার্থীর জন্য পাওনা তৈরি হয়েছে।`);
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "তৈরি করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function createSingle(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      if (editingDue) {
        await postJson("/api/staff/dues", { id: editingDue, ...single, amount: Number(single.amount) || 0 }, "PATCH");
        setMessage("পাওনা সম্পাদনা করা হয়েছে।");
      } else {
        await postJson("/api/staff/dues", { ...single, fair_slug: fairSlug, amount: Number(single.amount) || 0 });
        setMessage("পাওনা যোগ হয়েছে।");
      }
      setEditingDue("");
      setSingle({ student_name: "", student_id: "", class_level: "", section: "", title: "বিজ্ঞান মেলা ফি", amount: "", due_date: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "তৈরি করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(due: DueRow) {
    const remaining = Math.max(0, Number(due.amount) - Number(due.paid_amount) - Number(due.pending_amount ?? 0));
    const amountText = prompt(`${due.student_name} · ${due.title} — বাকি ${remaining} টাকা। কত টাকা জমা নিলেন?`, String(remaining));
    if (amountText === null) return;
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) { setProblem(`টাকার পরিমাণ ১ থেকে ${remaining} এর মধ্যে দিন।`); return; }
    try {
      await postJson("/api/staff/funds", {
        fair_slug: fairSlug,
        due_id: due.id,
        user_id: due.user_id,
        payer_name: due.student_name,
        payer_role: "student",
        class_level: due.class_level,
        section: due.section,
        student_id: due.student_id,
        amount,
        method: "নগদ",
        purpose: due.title,
        status: "verified",
        note: "পাওনার বিপরীতে রসিদ",
      });
      setMessage(`${money(amount)}-এর রসিদ তৈরি হয়েছে এবং পাওনার সঙ্গে যুক্ত হয়েছে।`);
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "রসিদ তৈরি করা যায়নি।");
    }
  }

  function startEdit(due: DueRow) {
    setEditingDue(due.id);
    setTab("single");
    setSingle({ student_name: due.student_name, student_id: due.student_id, class_level: due.class_level, section: due.section, title: due.title, amount: String(due.amount), due_date: due.due_date });
    setProblem("");
    setMessage("");
  }

  async function remove(id: string) {
    if (!confirm("পাওনাটি মুছে ফেলবেন?")) return;
    try {
      await postJson("/api/staff/dues", { id }, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "মুছে ফেলা যায়নি।");
    }
  }

  const outstanding = dues.reduce((sum, due) => sum + Math.max(0, Number(due.amount) - Number(due.paid_amount)), 0);

  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.35fr) minmax(290px, .65fr)" }}>
      <Panel
        title="পাওনার তালিকা"
        action={<span className="badge-soft">বাকি {money(outstanding)}</span>}
      >
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>শিক্ষার্থী</th>
                <th>শ্রেণি</th>
                <th>খাত</th>
                <th>পরিমাণ</th>
                <th>জমা</th>
                <th>অবস্থা</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dues.map((due) => (
                <tr key={due.id}>
                  <td><strong>{due.student_name}</strong><div className="v2-muted" style={{ fontSize: 12 }}>{due.student_id}</div></td>
                  <td>{due.class_level}{due.section ? ` · ${due.section}` : ""}</td>
                  <td>{due.title}<div className="v2-muted" style={{ fontSize: 12 }}>{due.due_date ? formatDate(due.due_date) : ""}</div></td>
                  <td>{money(due.amount)}</td>
                  <td>{money(due.paid_amount)}</td>
                  <td className={due.status === "paid" ? "status-ok" : due.status === "partial" ? "status-pending" : "status-bad"}>
                    {due.status === "paid" ? "পরিশোধিত" : due.status === "partial" ? "আংশিক" : due.status === "waived" ? "মাফ" : "বাকি"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => startEdit(due)} title="পাওনা সম্পাদনা"><Pencil size={14} /></button>{" "}
                    {due.status !== "paid" ? (
                      <button className="v2-btn v2-btn-sm" type="button" onClick={() => markPaid(due)} title="রসিদ যোগ করুন"><Wallet size={14} /></button>
                    ) : null}{" "}
                    <button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(due.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {!dues.length && !loading ? <tr><td colSpan={7}><Empty>কোনো পাওনা নেই।</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
        {error ? <Notice kind="bad">{error}</Notice> : null}
      </Panel>

      <div className="v2-grid">
        <Panel
          title={editingDue ? "পাওনা সম্পাদনা" : "নতুন পাওনা"}
          action={
            <div className="pill-row">
              <button type="button" className={`pill ${tab === "bulk" ? "is-on" : ""}`} onClick={() => { setEditingDue(""); setTab("bulk"); }}>পুরো ক্লাস</button>
              <button type="button" className={`pill ${tab === "single" ? "is-on" : ""}`} onClick={() => { if (tab !== "single") setEditingDue(""); setTab("single"); }}>একজন</button>
            </div>
          }
        >
          {tab === "bulk" ? (
            <form onSubmit={createBulk} style={{ display: "grid", gap: 10 }}>
              <div>
                <label className="v2-label">শ্রেণি</label>
                <select className="v2-select" value={bulk.class_level} onChange={(e) => setBulk({ ...bulk, class_level: e.target.value, section: "" })} required>
                  <option value="">শ্রেণি বাছুন</option>
                  {options.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}
                </select>
              </div>
              <div>
                <label className="v2-label">শাখা (খালি রাখলে সব শাখা)</label>
                <select className="v2-select" value={bulk.section} onChange={(e) => setBulk({ ...bulk, section: e.target.value })}>
                  <option value="">সব শাখা</option>
                  {sections.map((section) => <option key={section} value={section}>{section}</option>)}
                </select>
              </div>
              <div>
                <label className="v2-label">খাত</label>
                <input className="v2-input" value={bulk.title} onChange={(e) => setBulk({ ...bulk, title: e.target.value })} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="v2-label">টাকা</label>
                  <input className="v2-input" type="number" min={1} value={bulk.amount} onChange={(e) => setBulk({ ...bulk, amount: e.target.value })} required />
                </div>
                <div>
                  <label className="v2-label">শেষ তারিখ</label>
                  <input className="v2-input" type="date" value={bulk.due_date} onChange={(e) => setBulk({ ...bulk, due_date: e.target.value })} />
                </div>
              </div>
              <button className="v2-btn" type="submit" disabled={busy}><Receipt size={16} /> ক্লাসের জন্য তৈরি করুন</button>
            </form>
          ) : (
            <form onSubmit={createSingle} style={{ display: "grid", gap: 10 }}>
              <div>
                <label className="v2-label">শিক্ষার্থীর নাম</label>
                <input className="v2-input" value={single.student_name} onChange={(e) => setSingle({ ...single, student_name: e.target.value })} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="v2-label">আইডি</label>
                  <input className="v2-input" value={single.student_id} onChange={(e) => setSingle({ ...single, student_id: e.target.value })} />
                </div>
                <div>
                  <label className="v2-label">টাকা</label>
                  <input className="v2-input" type="number" min={1} value={single.amount} onChange={(e) => setSingle({ ...single, amount: e.target.value })} required />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="v2-label">শ্রেণি</label>
                  <input className="v2-input" value={single.class_level} onChange={(e) => setSingle({ ...single, class_level: e.target.value })} />
                </div>
                <div>
                  <label className="v2-label">শাখা</label>
                  <input className="v2-input" value={single.section} onChange={(e) => setSingle({ ...single, section: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="v2-label">খাত</label>
                <input className="v2-input" value={single.title} onChange={(e) => setSingle({ ...single, title: e.target.value })} required />
              </div>
              <div>
                <label className="v2-label">শেষ তারিখ</label>
                <input className="v2-input" type="date" value={single.due_date} onChange={(e) => setSingle({ ...single, due_date: e.target.value })} />
              </div>
              <button className="v2-btn" type="submit" disabled={busy}><Receipt size={16} /> {busy ? "সেভ হচ্ছে…" : editingDue ? "পাওনা সংরক্ষণ" : "যোগ করুন"}</button>
              {editingDue ? <button className="v2-btn v2-btn-ghost" type="button" onClick={() => { setEditingDue(""); setSingle({ student_name: "", student_id: "", class_level: "", section: "", title: "বিজ্ঞান মেলা ফি", amount: "", due_date: "" }); }}>সম্পাদনা বাতিল</button> : null}
            </form>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- expenses */

export function ExpensesPanel({ fairSlug }: { fairSlug: string }) {
  const { data, loading, error, reload } = useApi<{ expenses: ExpenseRow[] }>(`/api/staff/expenses?fair=${encodeURIComponent(fairSlug)}`, [fairSlug]);
  const [form, setForm] = useState({ title: "", category: "সাধারণ", amount: "", paid_to: "", paid_at: "", method: "নগদ", voucher_no: "", note: "" });
  const [editing, setEditing] = useState("");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const expenses = data?.expenses ?? [];
  const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      if (editing) {
        await postJson("/api/staff/expenses", { ...form, id: editing, fair_slug: fairSlug, amount: Number(form.amount) || 0 }, "PATCH");
        setMessage("খরচের মেমো সম্পাদনা করা হয়েছে।");
      } else {
        await postJson("/api/staff/expenses", { ...form, fair_slug: fairSlug, amount: Number(form.amount) || 0 });
        setMessage("খরচ যোগ হয়েছে।");
      }
      setEditing("");
      setForm({ ...form, title: "", amount: "", paid_to: "", voucher_no: "", note: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "সংরক্ষণ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(item: ExpenseRow) {
    setEditing(item.id);
    setForm({ title: item.title, category: item.category, amount: String(item.amount), paid_to: item.paid_to, paid_at: item.paid_at, method: item.method, voucher_no: item.voucher_no, note: item.note });
    setProblem("");
    setMessage("");
  }

  async function remove(id: string) {
    if (!confirm("খরচের এন্ট্রিটি মুছে ফেলবেন?")) return;
    try {
      await postJson("/api/staff/expenses", { id }, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "মুছে ফেলা যায়নি।");
    }
  }

  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.35fr) minmax(290px, .65fr)" }}>
      <Panel title="খরচের তালিকা" action={<span className="badge-soft">মোট {money(total)}</span>}>
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>খাত</th><th>খাতভিত্তিক ধরন</th><th>কাকে দেওয়া</th><th>তারিখ</th><th>টাকা</th><th>ভাউচার</th><th /></tr>
            </thead>
            <tbody>
              {expenses.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.title}</strong>{item.note ? <div className="v2-muted" style={{ fontSize: 12 }}>{item.note}</div> : null}</td>
                  <td>{item.category}</td>
                  <td>{item.paid_to || "—"}</td>
                  <td>{item.paid_at ? formatDate(item.paid_at) : "—"}</td>
                  <td><strong>{money(item.amount)}</strong></td>
                  <td>{item.memo_no || item.voucher_no || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}><a className="v2-btn v2-btn-sm v2-btn-ghost" href={`/sf/print/memo/${item.id}`} target="_blank" rel="noreferrer" title="মেমো ছাপুন"><Printer size={14} /></a>{" "}<button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => startEdit(item)} title="সম্পাদনা"><Pencil size={14} /></button>{" "}<button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(item.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {!expenses.length && !loading ? <tr><td colSpan={7}><Empty>কোনো খরচ যোগ করা হয়নি।</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
        {error ? <Notice kind="bad">{error}</Notice> : null}
      </Panel>

      <Panel title="নতুন খরচ">
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <div>
            <label className="v2-label">খরচের বিবরণ</label>
            <input className="v2-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="যেমন: স্টেজ সাজসজ্জা" required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">ধরন</label>
              <select className="v2-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {["সাধারণ", "সাজসজ্জা", "খাবার", "পুরস্কার", "প্রিন্টিং", "ইলেকট্রিসিটি", "পরিবহন", "সাউন্ড ও লাইট", "অন্যান্য"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="v2-label">টাকা</label>
              <input className="v2-input" type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">কাকে দেওয়া হলো</label>
              <input className="v2-input" value={form.paid_to} onChange={(e) => setForm({ ...form, paid_to: e.target.value })} />
            </div>
            <div>
              <label className="v2-label">তারিখ</label>
              <input className="v2-input" type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">মাধ্যম</label>
              <select className="v2-select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {methods.map((method) => <option key={method}>{method}</option>)}
              </select>
            </div>
            <div>
              <label className="v2-label">ভাউচার নম্বর</label>
              <input className="v2-input" value={form.voucher_no} onChange={(e) => setForm({ ...form, voucher_no: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="v2-label">নোট</label>
            <input className="v2-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <button className="v2-btn" type="submit" disabled={busy}><Receipt size={16} /> {busy ? "সেভ হচ্ছে…" : editing ? "মেমো সংরক্ষণ" : "খরচ যোগ করুন"}</button>
          {editing ? <button className="v2-btn v2-btn-ghost" type="button" onClick={() => { setEditing(""); setForm({ title: "", category: "সাধারণ", amount: "", paid_to: "", paid_at: "", method: "নগদ", voucher_no: "", note: "" }); }}>সম্পাদনা বাতিল</button> : null}
        </form>
      </Panel>
    </div>
  );
}

export function ClassBars({ rows }: { rows: { class_level: string; section: string; total: number; students: number }[] }) {
  return (
    <Bars
      rows={rows.map((row) => ({
        label: `${row.class_level}${row.section && row.section !== "—" ? ` · ${row.section}` : ""}`,
        value: row.total,
        note: row.students ? `(${bn(row.students)} জন)` : "",
      }))}
    />
  );
}
