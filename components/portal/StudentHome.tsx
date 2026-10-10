"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, BellRing, CalendarClock, ChevronDown, Eye, Activity, LogOut, QrCode, Receipt, Ticket, Wallet } from "lucide-react";
import type { DueRow, FundRow, PassRow, PublicUser } from "@/lib/portal-db";
import type { Fair } from "@/lib/types";
import { bn, formatDate } from "@/lib/format";
import { roleLabels, type PortalRole } from "@/lib/roles";
import { Empty, Notice, money, postJson, useApi } from "@/components/sf/console/ui";
import { PortalAnnouncements } from "@/components/portal/PortalAnnouncements";
import "@/components/portal/student.css";

interface RosterView {
  name: string;
  student_code: string;
  roll: string;
  class_name: string;
  section: string;
  shift: string;
  sms_contact: string;
  payment_status: "PAID" | "UNPAID";
  ticket_url: string;
}

/** Each due as the server computes it: live totals from verified receipts. */
type StudentDue = DueRow & { balance: number; payable: number };

interface MeResponse {
  user: PublicUser;
  roster?: RosterView | null;
  role: PortalRole;
  dues: StudentDue[];
  funds: FundRow[];
  passes: PassRow[];
  guest_passes?: PassRow[];
  outstanding: number;
  contributed: number;
  pending_receipts: number;
  dues_total: number;
}

const methods = ["বিকাশ", "নগদ (Nagad)", "রকেট", "নগদ", "ব্যাংক"];
const purposes = ["বিজ্ঞান মেলা ফান্ড", "ক্লাব ফান্ড", "ক্লাস ফান্ড", "অনুদান", "অন্যান্য"];

const passStatusText: Record<string, string> = { active: "সক্রিয়", used: "ব্যবহৃত", revoked: "বাতিল" };
const fundStatusText: Record<string, string> = { verified: "যাচাইকৃত", pending: "অপেক্ষমাণ", rejected: "বাতিল" };

function problemOf(issue: unknown, fallback: string) {
  return issue instanceof Error ? issue.message : fallback;
}

/** /me — the student & alumni dashboard: money owed and paid, the QR pass, notices. */
export function StudentHome({ fair }: { fair: Fair | null }) {
  const { data, loading, error, reload } = useApi<MeResponse>("/api/portal/me");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");

  if (loading && !data) return <p className="v2-wrap v2-muted" style={{ padding: 40 }}>লোড হচ্ছে…</p>;
  if (error) return <p className="v2-wrap"><Notice kind="bad">{error}</Notice></p>;
  if (!data?.user) return null;

  const { user } = data;
  const pass = data.passes[0] ?? null;
  const guestPasses = data.guest_passes ?? [];
  const roster = data.roster ?? null;
  const openDues = data.dues.filter((due) => due.balance > 0);
  const firstName = user.name.split(" ")[0] || user.name;
  const paid = roster?.payment_status === "PAID";

  return (
    <div className="v2 app-shell stu">
      <header className="app-top stu-top">
        <div className="v2-wrap app-top-inner">
          <div className="stu-id">
            <span className="stu-avatar" aria-hidden="true">{user.name.trim().charAt(0) || "•"}</span>
            <div className="stu-id-copy">
              <strong>{user.name}</strong>
              <small>
                {roleLabels[data.role]}
                {user.class_level ? ` · ${user.class_level}` : ""}
                {user.section ? ` · শাখা ${user.section}` : ""}
                {user.student_id ? ` · ID ${user.student_id}` : ""}
              </small>
            </div>
          </div>
          <div className="app-top-actions stu-top-actions">
            <Link className="v2-btn v2-btn-sm v2-btn-ghost" href="/">ওয়েবসাইট</Link>
            <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" aria-label="লগআউট" onClick={() => void logout()}><LogOut size={15} /></button>
          </div>
        </div>
      </header>

      <main className="v2-wrap app-body stu-body">
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}
        {user.must_change_password ? <Notice kind="bad">আপনার অস্থায়ী পাসওয়ার্ড বদলে নিন — নিচের “নিরাপত্তা” অংশে যান।</Notice> : null}

        <section className="stu-hero" aria-label="সারাংশ">
          <div className="stu-hero-copy">
            <span className="stu-eyebrow">{fair?.name ?? "বিজ্ঞান মেলা"}</span>
            <h1>স্বাগতম, {firstName}</h1>
            <p>
              {roster ? `রোল ${bn(roster.roll)} · ${roster.class_name}${roster.section ? ` · শাখা ${roster.section}` : ""}${roster.shift ? ` · ${roster.shift}` : ""}` : "আপনার পাওনা, জমা ও QR পাস এখানে দেখুন।"}
            </p>
          </div>
          <div className="stu-hero-status">
            <span className={`stu-pill ${paid ? "is-good" : "is-warn"}`}>{roster ? (paid ? "মেলা ফি পরিশোধিত" : "মেলা ফি বাকি") : "শিক্ষার্থী"}</span>
            <span className={`stu-pill ${pass?.status === "active" ? "is-good" : "is-muted"}`}>
              <QrCode size={13} /> {pass ? `QR পাস: ${passStatusText[pass.status] ?? pass.status}` : "QR পাস ইস্যু হয়নি"}
            </span>
          </div>
        </section>

        <section className="stu-metrics" aria-label="আর্থিক সারাংশ">
          <article className="stu-metric is-primary">
            <span className="stu-metric-label"><Wallet size={15} /> আমার মোট জমা</span>
            <strong>{money(data.contributed)}</strong>
            <small>যাচাইকৃত জমা</small>
            {data.pending_receipts > 0 ? <small className="stu-metric-note">যাচাই অপেক্ষায় {money(data.pending_receipts)}</small> : null}
          </article>
          <article className={`stu-metric ${data.outstanding > 0 ? "is-warn" : "is-good"}`}>
            <span className="stu-metric-label"><Receipt size={15} /> বাকি পাওনা</span>
            <strong>{money(data.outstanding)}</strong>
            <small>
              {!data.dues.length
                ? "কোনো পাওনা নেই"
                : openDues.length
                  ? `${bn(openDues.length)} টি খাতে বাকি`
                  : "সব পাওনা পরিশোধিত"}
            </small>
          </article>
          <article className="stu-metric">
            <span className="stu-metric-label"><QrCode size={15} /> QR পাস</span>
            <strong className="stu-metric-small">{pass ? passStatusText[pass.status] ?? pass.status : "অপেক্ষমাণ"}</strong>
            <small>{pass ? `স্ক্যান ${bn(pass.scan_count)} বার` : "পেমেন্ট নিশ্চিত হলে ইস্যু হবে"}</small>
          </article>
          <article className="stu-metric">
            <span className="stu-metric-label"><CalendarClock size={15} /> মেলা</span>
            <strong className="stu-metric-small">{fair?.starts_on ? formatDate(fair.starts_on) : "—"}</strong>
            <small>{fair?.name ?? "বিজ্ঞান মেলা"}</small>
          </article>
        </section>

        <div className="stu-grid">
          <div className="stu-main">
            <PortalAnnouncements />

            <section className="stu-card" id="student-dues">
              <header className="stu-card-head">
                <h2>আমার পাওনা</h2>
                <span className="stu-card-sub">{data.dues.length ? `${bn(data.dues.length)} টি খাত` : ""}</span>
              </header>
              {data.dues.length ? (
                <ul className="stu-list">
                  {data.dues.map((due) => (
                    <DueItem
                      key={due.id}
                      due={due}
                      onDone={async (text) => { setMessage(text); setProblem(""); await reload(); }}
                      onError={(text) => { setProblem(text); setMessage(""); }}
                    />
                  ))}
                </ul>
              ) : (
                <Empty>আপনার কোনো পাওনা নেই।</Empty>
              )}
            </section>

            <section className="stu-card" id="student-history">
              <header className="stu-card-head">
                <h2>আমার জমার ইতিহাস</h2>
                <span className="stu-card-sub">সর্বশেষ {bn(Math.min(data.funds.length, 100))}টি</span>
              </header>
              {data.funds.length ? (
                <ul className="stu-list">
                  {data.funds.map((fund) => (
                    <li key={fund.id} className="stu-row">
                      <div className="stu-row-main">
                        <strong>{fund.purpose || "জমা"}</strong>
                        <span className="stu-row-meta">
                          {formatDate(fund.created_at, "short")} · {fund.method}{fund.trx_id ? ` · ${fund.trx_id}` : ""}
                        </span>
                      </div>
                      <div className="stu-row-end">
                        <strong className="stu-amount">{money(fund.amount)}</strong>
                        <span className={`stu-status is-${fund.status === "verified" ? "good" : fund.status === "pending" ? "warn" : "bad"}`}>
                          {fundStatusText[fund.status] ?? fund.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>এখনো কোনো জমা নেই।</Empty>
              )}
            </section>
          </div>

          <aside className="stu-side">
            <section className="stu-card stu-pass" id="student-pass">
              <header className="stu-card-head">
                <h2>আমার QR পাস</h2>
                <span className={`stu-status ${pass?.status === "active" ? "is-good" : ""}`}>
                  {pass ? passStatusText[pass.status] ?? pass.status : "ইস্যু হয়নি"}
                </span>
              </header>
              {pass ? (
                <div className="stu-pass-body">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="stu-pass-qr"
                    src={`/api/qr?text=${encodeURIComponent(`/pass/${pass.token}`)}&size=520`}
                    alt="আমার QR পাস"
                    width={220}
                    height={220}
                  />
                  <p className="stu-pass-note">মেলার গেটে এই QR টি স্ক্যানারে দেখান।</p>
                  <div className="stu-pass-actions">
                    <a className="v2-btn v2-btn-ghost" href={`/pass/${pass.token}`} target="_blank" rel="noreferrer"><Eye size={15} /> পাস দেখুন</a>
                  </div>
                  {guestPasses.length ? (
                    <div className="stu-guests">
                      <span className="stu-guests-title">অতিথি পাস (স্কুল কর্তৃপক্ষ কর্তৃক ইস্যুকৃত)</span>
                      {guestPasses.map((guest) => (
                        <a key={guest.id} className="stu-guest" href={`/pass/${guest.token}`} target="_blank" rel="noreferrer">
                          <QrCode size={14} /> {guest.holder_name}
                          <span className="stu-muted">{passStatusText[guest.status] ?? guest.status}</span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="stu-pass-empty">
                  <QrCode size={28} aria-hidden="true" />
                  <p>আপনার QR পাস এখনো ইস্যু হয়নি। মেলা ফি নিশ্চিত হলে বিদ্যালয় কর্তৃপক্ষ স্বয়ংক্রিয়ভাবে এটি ইস্যু করবে।</p>
                </div>
              )}
            </section>

            {roster ? (
              <section className="stu-card">
                <header className="stu-card-head">
                  <h2>আমার টিকিট</h2>
                </header>
                <p className="stu-muted stu-small">{roster.name} · ID {roster.student_code}</p>
                <p className="stu-muted stu-small">এটি শুধু দেখার জন্য। ছাপার কাজ বিদ্যালয় কর্তৃপক্ষ করবে।</p>
                <Link className="v2-btn v2-btn-ghost" href={roster.ticket_url}><Ticket size={15} /> টিকিট দেখুন</Link>
              </section>
            ) : null}

            <section className="stu-card" id="student-fund">
              <header className="stu-card-head">
                <h2>ফান্ড জমা দিন</h2>
              </header>
              <FundForm
                fairSlug={fair?.slug ?? ""}
                onDone={async (text) => { setMessage(text); setProblem(""); await reload(); }}
                onError={(text) => { setProblem(text); setMessage(""); }}
              />
            </section>

            <details className="stu-card stu-security" open={Boolean(user.must_change_password)}>
              <summary>
                <span>নিরাপত্তা — পাসওয়ার্ড বদলান</span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <PasswordForm
                onDone={async (text) => { setMessage(text); setProblem(""); await reload(); }}
                onError={(text) => { setProblem(text); setMessage(""); }}
              />
            </details>
          </aside>
        </div>
      </main>

      <nav className="app-mobile-bar student-mobile-bar" aria-label="শিক্ষার্থী নেভিগেশন">
        <a href="#student-notices"><BellRing size={18} /><span>ঘোষণা</span></a>
        <a href="#student-dues"><Receipt size={18} /><span>পাওনা</span></a>
        <a href="#student-fund"><Wallet size={18} /><span>জমা</span></a>
        <a href="#student-pass"><QrCode size={18} /><span>QR পাস</span></a>
        <a href="#student-history"><Activity size={18} /><span>ইতিহাস</span></a>
      </nav>
    </div>
  );
}

async function logout() {
  await fetch("/api/portal/login", { method: "DELETE" });
  window.location.href = "/";
}

/** One due: totals, status and an inline payment form (no browser prompt). */
function DueItem({ due, onDone, onError }: { due: StudentDue; onDone: (text: string) => Promise<void>; onError: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(due.payable));
  const [method, setMethod] = useState(methods[0]);
  const [trx, setTrx] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = Number(due.pending_amount ?? 0);
  const status = due.balance <= 0 ? "paid" : due.paid_amount > 0 ? "partial" : "due";
  const label = status === "paid" ? "পরিশোধিত" : pending > 0 ? "যাচাই অপেক্ষায়" : status === "partial" ? "আংশিক" : "বাকি";
  const tone = status === "paid" ? "good" : pending > 0 || status === "partial" ? "warn" : "bad";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await postJson("/api/portal/me", { action: "pay-dues", due_id: due.id, amount: Number(amount) || 0, method, trx_id: trx, fair_slug: due.fair_slug });
      setOpen(false);
      setTrx("");
      await onDone("পেমেন্ট জমা হয়েছে — শিক্ষক যাচাই করলে ড্যাশবোর্ডে যুক্ত হবে।");
    } catch (issue) {
      onError(problemOf(issue, "জমা দেওয়া যায়নি।"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="stu-row stu-due">
      <div className="stu-row-main">
        <strong>{due.title}</strong>
        <span className="stu-row-meta">{due.due_date ? formatDate(due.due_date, "short") : "তারিখ নির্ধারিত নয়"}</span>
        <dl className="stu-due-figures">
          <div><dt>মোট</dt><dd>{money(due.amount)}</dd></div>
          <div><dt>জমা</dt><dd>{money(due.paid_amount)}</dd></div>
          <div className={due.balance > 0 ? "is-due" : ""}><dt>বাকি</dt><dd>{money(due.balance)}</dd></div>
        </dl>
        {pending > 0 ? <span className="stu-row-meta">যাচাই অপেক্ষায় {money(pending)}</span> : null}
      </div>
      <div className="stu-row-end">
        <span className={`stu-status is-${tone}`}>{label}</span>
        {due.payable > 0 ? (
          <button className="v2-btn v2-btn-sm" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            জমা দিন
          </button>
        ) : null}
      </div>
      {open ? (
        <form className="stu-inline-form" onSubmit={submit}>
          <label>
            <span className="v2-label">টাকার পরিমাণ (সর্বোচ্চ {money(due.payable)})</span>
            <input className="v2-input" type="number" min={1} max={due.payable} value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </label>
          <label>
            <span className="v2-label">মাধ্যম</span>
            <select className="v2-select" value={method} onChange={(event) => setMethod(event.target.value)}>
              {methods.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="v2-label">ট্রানজেকশন নম্বর</span>
            <input className="v2-input" value={trx} onChange={(event) => setTrx(event.target.value)} placeholder="TrxID" />
          </label>
          <div className="stu-inline-actions">
            <button className="v2-btn" type="submit" disabled={busy}><BadgeCheck size={16} /> {busy ? "পাঠানো হচ্ছে…" : "পেমেন্ট জানান"}</button>
            <button className="v2-btn v2-btn-ghost" type="button" onClick={() => setOpen(false)}>বাতিল</button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

function FundForm({ fairSlug, onDone, onError }: { fairSlug: string; onDone: (text: string) => Promise<void>; onError: (text: string) => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(methods[0]);
  const [trx, setTrx] = useState("");
  const [purpose, setPurpose] = useState(purposes[0]);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await postJson("/api/portal/me", { action: "fund", amount: Number(amount) || 0, method, trx_id: trx, purpose, fair_slug: fairSlug });
      setAmount("");
      setTrx("");
      await onDone("আপনার জমার তথ্য পাঠানো হয়েছে — শিক্ষক যাচাই করলে ড্যাশবোর্ডে যুক্ত হবে।");
    } catch (issue) {
      onError(problemOf(issue, "জমা দেওয়া যায়নি।"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stu-form">
      <label>
        <span className="v2-label">টাকার পরিমাণ</span>
        <input className="v2-input" type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} required />
      </label>
      <div className="stu-form-pair">
        <label>
          <span className="v2-label">মাধ্যম</span>
          <select className="v2-select" value={method} onChange={(event) => setMethod(event.target.value)}>
            {methods.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span className="v2-label">ট্রানজেকশন নম্বর</span>
          <input className="v2-input" value={trx} onChange={(event) => setTrx(event.target.value)} placeholder="TrxID" />
        </label>
      </div>
      <label>
        <span className="v2-label">কোন খাতে</span>
        <select className="v2-select" value={purpose} onChange={(event) => setPurpose(event.target.value)}>
          {purposes.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <button className="v2-btn" type="submit" disabled={busy}><BadgeCheck size={16} /> {busy ? "পাঠানো হচ্ছে…" : "জমা দিন"}</button>
      <p className="stu-muted stu-small">
        টাকা অনলাইনে সরাসরি কাটা হয় না — যে মাধ্যমে দিয়েছেন তার তথ্য লিখুন; শিক্ষক যাচাই করে ড্যাশবোর্ডে যোগ করবেন।
      </p>
    </form>
  );
}

function PasswordForm({ onDone, onError }: { onDone: (text: string) => Promise<void>; onError: (text: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await postJson("/api/portal/me", { action: "password", current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      await onDone("পাসওয়ার্ড বদলানো হয়েছে।");
    } catch (issue) {
      onError(problemOf(issue, "পাসওয়ার্ড বদলানো যায়নি।"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stu-form">
      <label>
        <span className="v2-label">বর্তমান পাসওয়ার্ড</span>
        <input className="v2-input" type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} required />
      </label>
      <label>
        <span className="v2-label">নতুন পাসওয়ার্ড (৮+ অক্ষর, অক্ষর ও সংখ্যা)</span>
        <input className="v2-input" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(event) => setNext(event.target.value)} required />
      </label>
      <button className="v2-btn v2-btn-ghost" disabled={busy} type="submit">পাসওয়ার্ড বদলান</button>
    </form>
  );
}
