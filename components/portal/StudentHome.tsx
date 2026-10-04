"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarClock, Download, LogOut, QrCode, Receipt, Wallet } from "lucide-react";
import type { DueRow, FundRow, PassRow, PublicUser } from "@/lib/portal-db";
import type { Fair } from "@/lib/types";
import { bn, formatDate } from "@/lib/format";
import { roleLabels, type PortalRole } from "@/lib/roles";
import { Empty, Notice, Panel, money, postJson, useApi } from "@/components/sf/console/ui";

interface MeResponse {
  user: PublicUser;
  role: PortalRole;
  dues: DueRow[];
  funds: FundRow[];
  passes: PassRow[];
  outstanding: number;
  contributed: number;
}

const methods = ["বিকাশ", "নগদ (Nagad)", "রকেট", "নগদ", "ব্যাংক"];

/** /me — the student & alumni home: dues, contributions and the QR pass. */
export function StudentHome({ fair }: { fair: Fair | null }) {
  const { data, loading, error, reload } = useApi<MeResponse>("/api/portal/me");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(methods[0]);
  const [trx, setTrx] = useState("");
  const [purpose, setPurpose] = useState("বিজ্ঞান মেলা ফান্ড");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const user = data?.user;
  const pass = data?.passes?.[0];

  async function submitFund(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setProblem("");
    try {
      await postJson("/api/portal/me", {
        action: "fund",
        amount: Number(amount) || 0,
        method,
        trx_id: trx,
        purpose,
        fair_slug: fair?.slug ?? "",
      });
      setMessage("আপনার জমা জমা হয়েছে — শিক্ষক যাচাই করলে ড্যাশবোর্ডে যুক্ত হবে।");
      setAmount("");
      setTrx("");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "জমা দেওয়া যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function payDue(due: DueRow) {
    const rest = Math.max(0, Number(due.amount) - Number(due.paid_amount));
    const value = prompt(`${due.title} — বাকি ${rest} টাকা। কত টাকা দিচ্ছেন?`, String(rest));
    if (value === null) return;
    setProblem("");
    setMessage("");
    try {
      await postJson("/api/portal/me", { action: "pay-dues", due_id: due.id, amount: Number(value) || 0, method, trx_id: trx, fair_slug: due.fair_slug });
      setMessage("পেমেন্ট জমা হয়েছে — শিক্ষক যাচাই করবেন।");
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "জমা দেওয়া যায়নি।");
    }
  }

  async function makePass() {
    setProblem("");
    try {
      await postJson("/api/portal/me", { action: "pass", fair_slug: fair?.slug ?? "" });
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "পাস তৈরি করা যায়নি।");
    }
  }

  async function logout() {
    await fetch("/api/portal/login", { method: "DELETE" });
    window.location.href = "/";
  }

  if (loading && !data) return <p className="v2-wrap v2-muted" style={{ padding: 40 }}>লোড হচ্ছে…</p>;
  if (error) return <p className="v2-wrap"><Notice kind="bad">{error}</Notice></p>;
  if (!user) return null;

  return (
    <div className="v2 app-shell">
      <header className="app-top">
        <div className="v2-wrap app-top-inner">
          <div className="brand">
            <div className="brand-copy">
              <strong>{user.name}</strong>
              <small>
                {roleLabels[data!.role]} {user.class_level ? `· ${user.class_level}` : ""}{user.section ? ` · শাখা ${user.section}` : ""}
                {user.student_id ? ` · ID ${user.student_id}` : ""}
              </small>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="v2-btn v2-btn-sm v2-btn-ghost" href="/">সাইট</Link>
            <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={logout}><LogOut size={15} /></button>
          </div>
        </div>
      </header>

      <main className="v2-wrap app-body">
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}

        <div className="metric-grid" style={{ marginBottom: 16 }}>
          <div className="metric metric-accent">
            <span><Wallet size={14} /> আমার মোট জমা</span>
            <strong>{money(data!.contributed)}</strong>
            <small>যাচাইকৃত</small>
          </div>
          <div className="metric">
            <span><Receipt size={14} /> বাকি পাওনা</span>
            <strong>{money(data!.outstanding)}</strong>
            <small>{bn(data!.dues.filter((due) => due.status !== "paid").length)} টি খাত</small>
          </div>
          <div className="metric">
            <span><QrCode size={14} /> QR পাস</span>
            <strong style={{ fontSize: 20 }}>{pass ? (pass.status === "active" ? "সক্রিয়" : pass.status === "used" ? "ব্যবহৃত" : "বাতিল") : "তৈরি হয়নি"}</strong>
            <small>{pass ? `স্ক্যান ${bn(pass.scan_count)} বার` : "নিচে থেকে তৈরি করুন"}</small>
          </div>
          {fair?.starts_on ? (
            <div className="metric">
              <span><CalendarClock size={14} /> মেলা</span>
              <strong style={{ fontSize: 19 }}>{formatDate(fair.starts_on)}</strong>
              <small>{fair.name}</small>
            </div>
          ) : null}
        </div>

        <div className="v2-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <Panel title="আমার পাওনা">
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>খাত</th><th>পরিমাণ</th><th>জমা</th><th>অবস্থা</th><th /></tr></thead>
                <tbody>
                  {data!.dues.map((due) => (
                    <tr key={due.id}>
                      <td><strong>{due.title}</strong><div className="v2-muted" style={{ fontSize: 12 }}>{due.due_date ? formatDate(due.due_date) : ""}</div></td>
                      <td>{money(due.amount)}</td>
                      <td>{money(due.paid_amount)}</td>
                      <td className={due.status === "paid" ? "status-ok" : due.status === "partial" ? "status-pending" : "status-bad"}>
                        {due.status === "paid" ? "পরিশোধিত" : due.status === "partial" ? "আংশিক" : "বাকি"}
                      </td>
                      <td>
                        {due.status !== "paid" ? (
                          <button className="v2-btn v2-btn-sm" type="button" onClick={() => payDue(due)}>জমা দিন</button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!data!.dues.length ? <tr><td colSpan={5}><Empty>আপনার কোনো পাওনা নেই।</Empty></td></tr> : null}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="ফান্ড জমা দিন">
            <form onSubmit={submitFund} style={{ display: "grid", gap: 10 }}>
              <div>
                <label className="v2-label">টাকার পরিমাণ</label>
                <input className="v2-input" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="v2-label">মাধ্যম</label>
                  <select className="v2-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {methods.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </div>
                <div>
                  <label className="v2-label">ট্রানজেকশন নম্বর</label>
                  <input className="v2-input" value={trx} onChange={(e) => setTrx(e.target.value)} placeholder="TrxID" />
                </div>
              </div>
              <div>
                <label className="v2-label">কোন খাতে</label>
                <select className="v2-select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                  {["বিজ্ঞান মেলা ফান্ড", "ক্লাব ফান্ড", "ক্লাস ফান্ড", "অনুদান", "অন্যান্য"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <button className="v2-btn" type="submit" disabled={busy}><BadgeCheck size={16} /> {busy ? "পাঠানো হচ্ছে…" : "জমা দিন"}</button>
              <p className="v2-muted" style={{ margin: 0, fontSize: 12.5 }}>
                টাকা সরাসরি অনলাইনে কাটা হয় না — আপনি যে মাধ্যম দিয়ে দিয়েছেন সেটি লিখে দিন; শিক্ষক যাচাই করে ড্যাশবোর্ডে যোগ করবেন।
              </p>
            </form>
          </Panel>

          <Panel title="আমার QR পাস">
            {pass ? (
              <div style={{ display: "grid", gap: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/qr?text=${encodeURIComponent(`/pass/${pass.token}`)}&size=520`}
                  alt="QR পাস"
                  style={{ width: 220, height: 220, background: "#fff", padding: 8, borderRadius: 14, border: "1px solid var(--okgs-line)" }}
                />
                <div className="pass-meta v2-muted" style={{ fontSize: 13 }}>
                  <span>স্ট্যাটাস: {pass.status === "active" ? "সক্রিয়" : pass.status === "used" ? "ব্যবহৃত" : "বাতিল"}</span>
                  <span>স্ক্যান: {bn(pass.scan_count)} বার</span>
                </div>
                <a className="v2-btn v2-btn-ghost" href={`/pass/${pass.token}`} target="_blank" rel="noreferrer">
                  <Download size={15} /> কার্ড খুলুন / ছাপুন
                </a>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <p className="v2-muted" style={{ margin: 0 }}>মেলার গেটে ঢুকতে QR পাস দরকার — এক চাপে তৈরি হয়ে যাবে।</p>
                <button className="v2-btn" type="button" onClick={makePass}><QrCode size={16} /> QR পাস তৈরি করুন</button>
              </div>
            )}
          </Panel>

          <Panel title="আমার জমার ইতিহাস">
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>উদ্দেশ্য</th><th>মাধ্যম</th><th>টাকা</th><th>অবস্থা</th></tr></thead>
                <tbody>
                  {data!.funds.map((fund) => (
                    <tr key={fund.id}>
                      <td>{fund.purpose}<div className="v2-muted" style={{ fontSize: 12 }}>{formatDate(fund.created_at)}</div></td>
                      <td>{fund.method}{fund.trx_id ? <div className="v2-muted" style={{ fontSize: 12 }}>{fund.trx_id}</div> : null}</td>
                      <td>{money(fund.amount)}</td>
                      <td className={fund.status === "verified" ? "status-ok" : fund.status === "pending" ? "status-pending" : "status-bad"}>
                        {fund.status === "verified" ? "যাচাইকৃত" : fund.status === "pending" ? "অপেক্ষমাণ" : "বাতিল"}
                      </td>
                    </tr>
                  ))}
                  {!data!.funds.length ? <tr><td colSpan={4}><Empty>এখনো কোনো জমা নেই।</Empty></td></tr> : null}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}
