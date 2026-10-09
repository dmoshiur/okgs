"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Banknote, Pencil, Printer, Receipt, Trash2, Wallet, X } from "lucide-react";
import type { DueRow, ExpenseRow, FundRow } from "@/lib/portal-db";
import { en, formatDateEn } from "@/lib/format";
import { Bars, Empty, money, Notice, Panel, useApi, postJson } from "@/components/sf/console/ui";

interface ClassOption {
  name: string;
  level?: number;
  section_list: string[];
}

const methods = ["Cash", "bKash", "Nagad", "Rocket", "Bank", "Online"];
const purposes = ["Science fair fund", "Class fund", "Club fund", "Admission fee", "Due payment", "Alumni donation"];

/* ------------------------------------------------------------------ funds */

export function FundsPanel({ fairSlug }: { fairSlug: string }) {
  const [status, setStatus] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const { data: classOptions } = useApi<{ classes: ClassOption[] }>("/api/staff/classes");
  const query = `/api/staff/funds?fair=${encodeURIComponent(fairSlug)}${status ? `&status=${status}` : ""}${classFilter ? `&class=${encodeURIComponent(classFilter)}` : ""}`;
  const { data, loading, error, reload } = useApi<{ funds: FundRow[] }>(query, [fairSlug, status, classFilter]);
  const { data: dueData } = useApi<{ dues: DueRow[] }>(`/api/staff/dues?fair=${encodeURIComponent(fairSlug)}&limit=1000`, [fairSlug]);
  const [form, setForm] = useState({ payer_name: "", class_level: "", section: "", student_id: "", phone: "", user_id: "", due_id: "", amount: "", method: "Cash", trx_id: "", purpose: purposes[0], note: "" });
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
        setMessage(`${form.payer_name || "Entry"} updated।`);
      } else {
        await postJson("/api/staff/funds", { ...form, fair_slug: fairSlug, amount: Number(form.amount) || 0, status: "verified" });
        setMessage(`${form.payer_name || "Entry"} — ${form.amount} Tk received.`);
      }
      setEditing("");
      setForm({ ...form, payer_name: "", amount: "", trx_id: "", note: "", student_id: "", due_id: "", user_id: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not save.");
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
      setProblem(issue instanceof Error ? issue.message : "Could not change.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    try {
      await postJson("/api/staff/funds", { id, confirm: "delete" }, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not delete.");
    }
  }

  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, .6fr)" }}>
      <Panel
        title="Fund ledger"
        action={
          <div className="pill-row">
            {[
              { id: "", label: "All" },
              { id: "verified", label: "Verified" },
              { id: "pending", label: "Pending" },
              { id: "rejected", label: "Cancelled" },
            ].map((option) => (
              <button key={option.id} type="button" className={`pill ${status === option.id ? "is-on" : ""}`} onClick={() => setStatus(option.id)}>
                {option.label}
              </button>
            ))}
            <select className="v2-select" value={classFilter} onChange={(event) => setClassFilter(event.target.value)} aria-label="Filter by class"><option value="">All classes</option>{(classOptions?.classes ?? []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
            <a className="v2-btn v2-btn-sm v2-btn-ghost" href={`/sf/print/collections?fair=${encodeURIComponent(fairSlug)}${status ? `&status=${status}` : ""}${classFilter ? `&class=${encodeURIComponent(classFilter)}` : ""}`} target="_blank" rel="noreferrer"><Printer size={14} /> Collection report</a>
          </div>
        }
      >
        <div className="pill-row" style={{ marginBottom: 14 }}>
          <span className="badge-soft">Verified {money(totals.verified)}</span>
          <span className="badge-soft">Pending {money(totals.pending)}</span>
          <span className="badge-soft">{en(funds.length)} entries</span>
        </div>
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Class / section</th>
                <th>Purpose</th>
                <th>Method</th>
                <th>Tk</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {funds.map((fund) => (
                <tr key={fund.id}>
                  <td className="sf-wrap-cell">
                    <strong>{fund.payer_name}</strong>
                    <div className="v2-muted" style={{ fontSize: 12 }}>{fund.student_id || fund.phone || "—"}</div>
                  </td>
                  <td>{fund.class_level || "—"}{fund.section ? ` · ${fund.section}` : ""}</td>
                  <td className="sf-wrap-cell">{fund.purpose}<div className="v2-muted" style={{ fontSize: 12 }}>Receipt {fund.receipt_no} · {formatDateEn(fund.created_at)}</div></td>
                  <td className="sf-wrap-cell">{fund.method}{fund.trx_id ? <div className="v2-muted" style={{ fontSize: 12 }}>{fund.trx_id}</div> : null}</td>
                  <td><strong>{money(fund.amount)}</strong></td>
                  <td className={fund.status === "verified" ? "status-ok" : fund.status === "pending" ? "status-pending" : "status-bad"}>{fund.status === "verified" ? "Verified" : fund.status === "pending" ? "Pending" : "Cancelled"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <a className="v2-btn v2-btn-sm v2-btn-ghost" href={`/sf/print/receipt/${fund.id}`} target="_blank" rel="noreferrer" title="Print receipt"><Printer size={14} /></a>{" "}
                    <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => startEdit(fund)} title="Edit"><Pencil size={14} /></button>{" "}
                    {fund.status !== "verified" ? (
                      <button className="v2-btn v2-btn-sm" type="button" onClick={() => setFundStatus(fund.id, "verified")} title="Verify">
                        <BadgeCheck size={14} />
                      </button>
                    ) : null}{" "}
                    {fund.status !== "rejected" ? (
                      <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => setFundStatus(fund.id, "rejected")} title="Cancelled">
                        <X size={14} />
                      </button>
                    ) : null}{" "}
                    <button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(fund.id)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!funds.length && !loading ? (
                <tr>
                  <td colSpan={7}><Empty>No entries match this filter.</Empty></td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {loading ? <Empty>Loading…</Empty> : null}
        {error ? <Notice kind="bad">{error}</Notice> : null}
      </Panel>

      <Panel title="Record cash received">
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <div>
            <label className="v2-label">Student / donor name</label>
            <input className="v2-input" value={form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">Class</label>
              <input className="v2-input" value={form.class_level} onChange={(e) => setForm({ ...form, class_level: e.target.value })} placeholder="Class 10" />
            </div>
            <div>
              <label className="v2-label">Section</label>
              <input className="v2-input" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="A" />
            </div>
          </div>
          <div>
            <label className="v2-label">ID number</label>
            <input className="v2-input" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
          </div>
          <div>
            <label className="v2-label">Link to a due (optional)</label>
            <select className="v2-select" value={form.due_id} onChange={(event) => {
              const due = (dueData?.dues ?? []).find((item) => item.id === event.target.value);
              setForm({ ...form, due_id: event.target.value, user_id: due?.user_id || form.user_id, payer_name: due?.student_name || form.payer_name, class_level: due?.class_level || form.class_level, section: due?.section || form.section, student_id: due?.student_id || form.student_id, purpose: due?.title || form.purpose });
            }}>
              <option value="">No due — general receipt</option>
              {(dueData?.dues ?? []).filter((due) => Math.max(0, Number(due.amount) - Number(due.paid_amount) - Number(due.pending_amount ?? 0)) > 0).map((due) => <option key={due.id} value={due.id}>{due.student_name} · {due.title} · Balance due {money(Math.max(0, Number(due.amount) - Number(due.paid_amount) - Number(due.pending_amount ?? 0)))}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">Tk</label>
              <input className="v2-input" type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div>
              <label className="v2-label">Method</label>
              <select className="v2-select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {methods.map((method) => <option key={method}>{method}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="v2-label">Purpose</label>
            <select className="v2-select" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              {purposes.map((purpose) => <option key={purpose}>{purpose}</option>)}
            </select>
          </div>
          <div>
            <label className="v2-label">Transaction / mobile</label>
            <input className="v2-input" value={form.trx_id} onChange={(e) => setForm({ ...form, trx_id: e.target.value })} placeholder="bKash TrxID / 01XXXXXXXXX" />
          </div>
          <input type="hidden" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button className="v2-btn" type="submit" disabled={busy}>
            <Banknote size={16} /> {busy ? "Saving…" : editing ? "Save changes" : "Add payment"}
          </button>
          {editing ? <button className="v2-btn v2-btn-ghost" type="button" onClick={() => { setEditing(""); setForm({ payer_name: "", class_level: "", section: "", student_id: "", phone: "", user_id: "", due_id: "", amount: "", method: "Cash", trx_id: "", purpose: purposes[0], note: "" }); }}>Cancel edit</button> : null}
        </form>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------- dues */

export function DuesPanel({ fairSlug }: { fairSlug: string }) {
  const { data: classes } = useApi<{ classes: ClassOption[] }>("/api/staff/classes");
  const { data, loading, error, reload } = useApi<{ dues: DueRow[] }>(`/api/staff/dues?fair=${encodeURIComponent(fairSlug)}`, [fairSlug]);
  const [bulk, setBulk] = useState({ class_level: "", section: "", title: "Science fair fee", amount: "", due_date: "" });
  const [single, setSingle] = useState({ student_name: "", student_id: "", class_level: "", section: "", title: "Science fair fee", amount: "", due_date: "" });
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
      setMessage(`${en(result.created ?? 0)} students have dues created.`);
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not create.");
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
        setMessage("Due updated।");
      } else {
        await postJson("/api/staff/dues", { ...single, fair_slug: fairSlug, amount: Number(single.amount) || 0 });
        setMessage("Due added.");
      }
      setEditingDue("");
      setSingle({ student_name: "", student_id: "", class_level: "", section: "", title: "Science fair fee", amount: "", due_date: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not create.");
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(due: DueRow) {
    const remaining = Math.max(0, Number(due.amount) - Number(due.paid_amount) - Number(due.pending_amount ?? 0));
    const amountText = prompt(`${due.student_name} · ${due.title} — Balance due ${remaining} Tk। How much was received?`, String(remaining));
    if (amountText === null) return;
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) { setProblem(`Enter an amount between 1 and ${remaining}.`); return; }
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
        method: "Cash",
        purpose: due.title,
        status: "verified",
        note: "Receipt against due",
      });
      setMessage(`${money(amount)}Receipt created and linked to the due.`);
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Receipt Could not create.");
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
    if (!confirm("Delete this due?")) return;
    try {
      await postJson("/api/staff/dues", { id }, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not delete.");
    }
  }

  const outstanding = dues.reduce((sum, due) => sum + Math.max(0, Number(due.amount) - Number(due.paid_amount)), 0);

  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.35fr) minmax(290px, .65fr)" }}>
      <Panel
        title="Dues list"
        action={<span className="badge-soft">Balance due {money(outstanding)}</span>}
      >
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Item</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dues.map((due) => (
                <tr key={due.id}>
                  <td className="sf-wrap-cell"><strong>{due.student_name}</strong><div className="v2-muted" style={{ fontSize: 12 }}>{due.student_id}</div></td>
                  <td>{due.class_level}{due.section ? ` · ${due.section}` : ""}</td>
                  <td className="sf-wrap-cell">{due.title}<div className="v2-muted" style={{ fontSize: 12 }}>{due.due_date ? formatDateEn(due.due_date) : ""}</div></td>
                  <td>{money(due.amount)}</td>
                  <td>{money(due.paid_amount)}</td>
                  <td className={due.status === "paid" ? "status-ok" : due.status === "partial" ? "status-pending" : "status-bad"}>
                    {due.status === "paid" ? "Paid" : due.status === "partial" ? "Partial" : due.status === "waived" ? "Waived" : "Balance due"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => startEdit(due)} title="Due Edit"><Pencil size={14} /></button>{" "}
                    {due.status !== "paid" ? (
                      <button className="v2-btn v2-btn-sm" type="button" onClick={() => markPaid(due)} title="Receipt Add"><Wallet size={14} /></button>
                    ) : null}{" "}
                    <button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(due.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {!dues.length && !loading ? <tr><td colSpan={7}><Empty>No dues.</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
        {error ? <Notice kind="bad">{error}</Notice> : null}
      </Panel>

      <div className="v2-grid">
        <Panel
          title={editingDue ? "Due Edit" : "New due"}
          action={
            <div className="pill-row">
              <button type="button" className={`pill ${tab === "bulk" ? "is-on" : ""}`} onClick={() => { setEditingDue(""); setTab("bulk"); }}>Whole class</button>
              <button type="button" className={`pill ${tab === "single" ? "is-on" : ""}`} onClick={() => { if (tab !== "single") setEditingDue(""); setTab("single"); }}>One student</button>
            </div>
          }
        >
          {tab === "bulk" ? (
            <form onSubmit={createBulk} style={{ display: "grid", gap: 10 }}>
              <div>
                <label className="v2-label">Class</label>
                <select className="v2-select" value={bulk.class_level} onChange={(e) => setBulk({ ...bulk, class_level: e.target.value, section: "" })} required>
                  <option value="">Choose a class</option>
                  {options.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}
                </select>
              </div>
              <div>
                <label className="v2-label">Section (leave empty for all)</label>
                <select className="v2-select" value={bulk.section} onChange={(e) => setBulk({ ...bulk, section: e.target.value })}>
                  <option value="">All sections</option>
                  {sections.map((section) => <option key={section} value={section}>{section}</option>)}
                </select>
              </div>
              <div>
                <label className="v2-label">Item</label>
                <input className="v2-input" value={bulk.title} onChange={(e) => setBulk({ ...bulk, title: e.target.value })} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="v2-label">Tk</label>
                  <input className="v2-input" type="number" min={1} value={bulk.amount} onChange={(e) => setBulk({ ...bulk, amount: e.target.value })} required />
                </div>
                <div>
                  <label className="v2-label">Due date</label>
                  <input className="v2-input" type="date" value={bulk.due_date} onChange={(e) => setBulk({ ...bulk, due_date: e.target.value })} />
                </div>
              </div>
              <button className="v2-btn" type="submit" disabled={busy}><Receipt size={16} /> Create for class</button>
            </form>
          ) : (
            <form onSubmit={createSingle} style={{ display: "grid", gap: 10 }}>
              <div>
                <label className="v2-label">Student name</label>
                <input className="v2-input" value={single.student_name} onChange={(e) => setSingle({ ...single, student_name: e.target.value })} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="v2-label">ID</label>
                  <input className="v2-input" value={single.student_id} onChange={(e) => setSingle({ ...single, student_id: e.target.value })} />
                </div>
                <div>
                  <label className="v2-label">Tk</label>
                  <input className="v2-input" type="number" min={1} value={single.amount} onChange={(e) => setSingle({ ...single, amount: e.target.value })} required />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="v2-label">Class</label>
                  <input className="v2-input" value={single.class_level} onChange={(e) => setSingle({ ...single, class_level: e.target.value })} />
                </div>
                <div>
                  <label className="v2-label">Section</label>
                  <input className="v2-input" value={single.section} onChange={(e) => setSingle({ ...single, section: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="v2-label">Item</label>
                <input className="v2-input" value={single.title} onChange={(e) => setSingle({ ...single, title: e.target.value })} required />
              </div>
              <div>
                <label className="v2-label">Due date</label>
                <input className="v2-input" type="date" value={single.due_date} onChange={(e) => setSingle({ ...single, due_date: e.target.value })} />
              </div>
              <button className="v2-btn" type="submit" disabled={busy}><Receipt size={16} /> {busy ? "Saving…" : editingDue ? "Due Save" : "Add"}</button>
              {editingDue ? <button className="v2-btn v2-btn-ghost" type="button" onClick={() => { setEditingDue(""); setSingle({ student_name: "", student_id: "", class_level: "", section: "", title: "Science fair fee", amount: "", due_date: "" }); }}>Cancel edit</button> : null}
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
  const [form, setForm] = useState({ title: "", category: "General", amount: "", paid_to: "", paid_at: "", method: "Cash", voucher_no: "", note: "" });
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
        setMessage("Expense memo updated.");
      } else {
        await postJson("/api/staff/expenses", { ...form, fair_slug: fairSlug, amount: Number(form.amount) || 0 });
        setMessage("Expense added.");
      }
      setEditing("");
      setForm({ ...form, title: "", amount: "", paid_to: "", voucher_no: "", note: "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not save.");
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
    if (!confirm("Delete this expense entry?")) return;
    try {
      await postJson("/api/staff/expenses", { id }, "DELETE");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not delete.");
    }
  }

  return (
    <div className="v2-grid" style={{ gridTemplateColumns: "minmax(0, 1.35fr) minmax(290px, .65fr)" }}>
      <Panel title="Expense list" action={<span className="badge-soft">Total {money(total)}</span>}>
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Item</th><th>Ledger type</th><th>Paid to</th><th>Date</th><th>Tk</th><th>Voucher</th><th /></tr>
            </thead>
            <tbody>
              {expenses.map((item) => (
                <tr key={item.id}>
                  <td className="sf-wrap-cell"><strong>{item.title}</strong>{item.note ? <div className="v2-muted" style={{ fontSize: 12 }}>{item.note}</div> : null}</td>
                  <td>{item.category}</td>
                  <td>{item.paid_to || "—"}</td>
                  <td>{item.paid_at ? formatDateEn(item.paid_at) : "—"}</td>
                  <td><strong>{money(item.amount)}</strong></td>
                  <td>{item.memo_no || item.voucher_no || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}><a className="v2-btn v2-btn-sm v2-btn-ghost" href={`/sf/print/memo/${item.id}`} target="_blank" rel="noreferrer" title="Print memo"><Printer size={14} /></a>{" "}<button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => startEdit(item)} title="Edit"><Pencil size={14} /></button>{" "}<button className="v2-btn v2-btn-sm v2-btn-danger" type="button" onClick={() => remove(item.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {!expenses.length && !loading ? <tr><td colSpan={7}><Empty>No expenses added.</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
        {error ? <Notice kind="bad">{error}</Notice> : null}
      </Panel>

      <Panel title="New expense">
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <div>
            <label className="v2-label">Expense description</label>
            <input className="v2-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. stage decoration" required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">Type</label>
              <select className="v2-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {["General", "Decoration", "Food", "Prizes", "Printing", "Electricity", "Transport", "Sound & light", "Other"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="v2-label">Tk</label>
              <input className="v2-input" type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">Paid to</label>
              <input className="v2-input" value={form.paid_to} onChange={(e) => setForm({ ...form, paid_to: e.target.value })} />
            </div>
            <div>
              <label className="v2-label">Date</label>
              <input className="v2-input" type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="v2-label">Method</label>
              <select className="v2-select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {methods.map((method) => <option key={method}>{method}</option>)}
              </select>
            </div>
            <div>
              <label className="v2-label">Voucher no.</label>
              <input className="v2-input" value={form.voucher_no} onChange={(e) => setForm({ ...form, voucher_no: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="v2-label">Note</label>
            <input className="v2-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <button className="v2-btn" type="submit" disabled={busy}><Receipt size={16} /> {busy ? "Saving…" : editing ? "Memo Save" : "Spent Add"}</button>
          {editing ? <button className="v2-btn v2-btn-ghost" type="button" onClick={() => { setEditing(""); setForm({ title: "", category: "General", amount: "", paid_to: "", paid_at: "", method: "Cash", voucher_no: "", note: "" }); }}>Cancel edit</button> : null}
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
        note: row.students ? `(${en(row.students)} students)` : "",
      }))}
    />
  );
}
