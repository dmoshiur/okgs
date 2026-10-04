"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BadgeCheck,
  Boxes,
  CalendarDays,
  ClipboardList,
  Gauge,
  GraduationCap,
  LayoutGrid,
  LogOut,
  Megaphone,
  QrCode,
  Receipt,
  ScanLine,
  Settings2,
  Users,
  Wallet,
} from "lucide-react";
import type { Fair, SiteTheme } from "@/lib/types";
import type { DueRow, FundRow, PublicUser, ScanRow } from "@/lib/portal-db";
import { bn, formatDate } from "@/lib/format";
import { roleLabels, type PortalRole } from "@/lib/roles";
import { Bars, Empty, Metric, Notice, Panel, money, postJson, useApi } from "@/components/sf/console/ui";
import { DuesPanel, ExpensesPanel, FundsPanel } from "@/components/sf/console/MoneyPanels";
import { ClassesPanel, PassesPanel, UsersPanel } from "@/components/sf/console/PeoplePanels";
import { CollectionsPanel } from "@/components/sf/console/CollectionsPanel";
import { SettingsPanel } from "@/components/sf/console/SettingsPanel";
import { TickerPanel } from "@/components/sf/console/TickerPanel";

interface Stats {
  money: {
    collected: number;
    pending: number;
    today: number;
    entries: number;
    spent: number;
    balance: number;
    duesOutstanding: number;
    duesTotal: number;
    duesPaid: number;
  };
  fundsByClass: { class_level: string; section: string; total: number; students: number }[];
  fundsByMethod: { method: string; total: number }[];
  expensesByCategory: { category: string; total: number }[];
  dues: { amount: number; paid: number; outstanding: number; count: number; paidCount: number; dueCount: number };
  studentsByClass: { class_level: string; section: string; total: number }[];
  passes: Record<string, number>;
  scans: Record<string, number>;
  recentScans: ScanRow[];
  pendingFunds: FundRow[];
  roles: Record<string, number>;
  activity: { id: string; actor_name: string; action: string; detail: string; created_at: string }[];
}

const tabs = [
  { id: "dashboard", label: "ড্যাশবোর্ড", icon: Gauge },
  { id: "funds", label: "ফান্ড", icon: Wallet },
  { id: "dues", label: "পাওনা", icon: Receipt },
  { id: "expenses", label: "খরচ", icon: ClipboardList },
  { id: "collections", label: "সংগ্রহ", icon: Boxes },
  { id: "passes", label: "QR পাস", icon: QrCode },
  { id: "ticker", label: "টিকার", icon: Megaphone },
  { id: "users", label: "ইউজার", icon: Users },
  { id: "classes", label: "শ্রেণি", icon: GraduationCap },
  { id: "settings", label: "সেটিং", icon: Settings2 },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function FairConsole({
  user,
  role,
  fairs,
  themes,
  activeFairSlug,
  mode,
  bannerEnabled,
  registrationOpen,
  categories,
  clubs,
  schoolName,
  logo,
}: {
  user: PublicUser;
  role: PortalRole;
  fairs: Fair[];
  themes: SiteTheme[];
  activeFairSlug: string;
  mode: "school" | "fair";
  bannerEnabled: boolean;
  registrationOpen: boolean;
  categories: string[];
  clubs: { slug: string; name: string }[];
  schoolName: string;
  logo: string;
}) {
  const [tab, setTab] = useState<TabId>("dashboard");
  const [fairSlug, setFairSlug] = useState(activeFairSlug);
  const isAdmin = role === "admin";
  const { data, loading, error, reload } = useApi<Stats>(tab === "dashboard" ? `/api/staff/stats?fair=${encodeURIComponent(fairSlug)}` : null, [fairSlug, tab]);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");

  const fair = fairs.find((item) => item.slug === fairSlug) ?? fairs[0];
  const money_ = data?.money;
  const classRows = useMemo(
    () =>
      (data?.fundsByClass ?? []).map((row) => ({
        label: `${row.class_level}${row.section && row.section !== "—" ? ` · ${row.section}` : ""}`,
        value: row.total,
        note: row.students ? `(${bn(row.students)} জন)` : "",
      })),
    [data],
  );

  async function verifyFund(fund: FundRow) {
    try {
      await postJson("/api/staff/funds", { id: fund.id, status: "verified" }, "PATCH");
      setMessage(`${fund.payer_name} — ${money(fund.amount)} যাচাই করা হয়েছে।`);
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "যাচাই করা যায়নি।");
    }
  }

  async function logout() {
    await fetch("/api/portal/login", { method: "DELETE" });
    window.location.href = "/sf/login";
  }

  return (
    <div className="v2 app-shell">
      <header className="app-top">
        <div className="v2-wrap app-top-inner">
          <div className="brand">
            {logo ? <img className="official-logo" src={logo} alt={schoolName} /> : null}
            <div className="brand-copy">
              <strong>{fair?.name ?? "বিজ্ঞান মেলা"}</strong>
              <small>
                {schoolName} · {roleLabels[role]} · {user.name}
              </small>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select className="v2-select" style={{ width: "auto" }} value={fairSlug} onChange={(e) => setFairSlug(e.target.value)}>
              {fairs.map((item) => (
                <option key={item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
            <Link className="v2-btn v2-btn-sm" href="/sf/scan">
              <ScanLine size={15} /> স্ক্যান
            </Link>
            <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={logout}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
        <div className="v2-wrap app-tabs">
          {tabs.map((item) => (
            <button key={item.id} type="button" className={`app-tab ${tab === item.id ? "is-on" : ""}`} onClick={() => setTab(item.id)}>
              <item.icon size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
              {item.label}
            </button>
          ))}
          <a className="app-tab" href="/admin" target="_blank" rel="noreferrer">
            <LayoutGrid size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
            কনটেন্ট স্টুডিও
          </a>
        </div>
      </header>

      <main className="v2-wrap app-body">
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}

        {tab === "dashboard" ? (
          <div className="v2-grid" style={{ gap: 16 }}>
            <div className="metric-grid">
              <Metric
                accent
                label="মোট সংগৃহীত (যাচাইকৃত)"
                value={money(money_?.collected ?? 0)}
                note={`আজ ${money(money_?.today ?? 0)} · ${bn(money_?.entries ?? 0)} এন্ট্রি`}
                icon={<Wallet size={14} />}
              />
              <Metric label="অপেক্ষমাণ ফান্ড" value={money(money_?.pending ?? 0)} note={`${bn(data?.pendingFunds?.length ?? 0)} টি যাচাই বাকি`} icon={<Activity size={14} />} />
              <Metric label="খরচ" value={money(money_?.spent ?? 0)} note="মেলার সব খরচ" icon={<Receipt size={14} />} />
              <Metric
                label="বর্তমান ব্যালেন্স"
                value={money(money_?.balance ?? 0)}
                note={(money_?.balance ?? 0) >= 0 ? "উদ্বৃত্ত" : "ঘাটতি"}
                icon={<BadgeCheck size={14} />}
              />
              <Metric label="পাওনা বাকি" value={money(money_?.duesOutstanding ?? 0)} note={`${bn(data?.dues?.dueCount ?? 0)} জন বাকি`} icon={<ClipboardList size={14} />} />
              <Metric label="QR পাস" value={bn(data?.passes?.total ?? 0)} note={`স্ক্যান ${bn(data?.scans?.ok ?? 0)} সফল`} icon={<QrCode size={14} />} />
            </div>

            <div className="v2-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
              <Panel title="শ্রেণি অনুযায়ী জমা হওয়া ফান্ড">
                <Bars rows={classRows} />
              </Panel>
              <Panel title="শ্রেণি ও শাখায় শিক্ষার্থী">
                <Bars
                  unit=" জন"
                  rows={(data?.studentsByClass ?? []).map((row) => ({
                    label: `${row.class_level}${row.section && row.section !== "—" ? ` · ${row.section}` : ""}`,
                    value: row.total,
                  }))}
                />
              </Panel>
              <Panel title="খরচের খাত">
                <Bars rows={(data?.expensesByCategory ?? []).map((row) => ({ label: row.category, value: row.total }))} />
              </Panel>
              <Panel title="ফান্ডের মাধ্যম">
                <Bars rows={(data?.fundsByMethod ?? []).map((row) => ({ label: row.method, value: row.total }))} />
              </Panel>
            </div>

            <div className="v2-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              <Panel title="যাচাইয়ের অপেক্ষায়" action={<span className="badge-soft">{bn(data?.pendingFunds?.length ?? 0)} টি</span>}>
                {(data?.pendingFunds ?? []).map((fund) => (
                  <div key={fund.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--okgs-line)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: "block" }}>{fund.payer_name}</strong>
                      <span className="v2-muted" style={{ fontSize: 12.5 }}>
                        {fund.class_level || "—"}{fund.section ? ` · ${fund.section}` : ""} · {fund.method} · {formatDate(fund.created_at)}
                      </span>
                    </div>
                    <strong>{money(fund.amount)}</strong>
                    <button className="v2-btn v2-btn-sm" type="button" onClick={() => verifyFund(fund)}>
                      <BadgeCheck size={14} /> যাচাই
                    </button>
                  </div>
                ))}
                {!(data?.pendingFunds ?? []).length ? <Empty>সব ফান্ড যাচাই করা শেষ — অপেক্ষায় কিছু নেই।</Empty> : null}
              </Panel>

              <Panel title="সাম্প্রতিক স্ক্যান" action={<Link className="badge-soft" href="/sf/scan">স্ক্যানার খুলুন</Link>}>
                {(data?.recentScans ?? []).map((scan) => (
                  <div key={scan.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--okgs-line)", fontSize: 13.5 }}>
                    <span className={`badge-soft ${scan.result === "ok" ? "status-ok" : scan.result === "duplicate" ? "status-pending" : "status-bad"}`}>{scan.result}</span>
                    <span style={{ flex: 1 }}>{scan.scanned_by_name || "—"}</span>
                    <span className="v2-muted">{formatDate(scan.created_at)}</span>
                  </div>
                ))}
                {!(data?.recentScans ?? []).length ? <Empty>এখনো কোনো QR স্ক্যান হয়নি।</Empty> : null}
              </Panel>

              <Panel title="সাম্প্রতিক কার্যক্রম">
                {(data?.activity ?? []).map((item) => (
                  <div key={item.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--okgs-line)", fontSize: 13.5 }}>
                    <strong>{item.actor_name || "সিস্টেম"}</strong> <span className="v2-muted">{item.action}</span>
                    <div className="v2-muted" style={{ fontSize: 12 }}>{item.detail} · {formatDate(item.created_at)}</div>
                  </div>
                ))}
                {!(data?.activity ?? []).length ? <Empty>কোনো কার্যক্রম নেই।</Empty> : null}
              </Panel>

              <Panel title="দ্রুত কাজ">
                <div className="pill-row">
                  <button className="pill" type="button" onClick={() => setTab("funds")}>ফান্ড যোগ</button>
                  <button className="pill" type="button" onClick={() => setTab("dues")}>পুরো ক্লাসের পাওনা</button>
                  <button className="pill" type="button" onClick={() => setTab("expenses")}>খরচ যোগ</button>
                  <button className="pill" type="button" onClick={() => setTab("collections")}>সংগ্রহ যোগ</button>
                  <button className="pill" type="button" onClick={() => setTab("passes")}>QR পাস তৈরি</button>
                  <button className="pill" type="button" onClick={() => setTab("users")}>ইউজার যোগ</button>
                </div>
                <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                  <span className="badge-soft"><CalendarDays size={13} /> {fair?.starts_on ? `${formatDate(fair.starts_on)}${fair.ends_on && fair.ends_on !== fair.starts_on ? ` – ${formatDate(fair.ends_on)}` : ""}` : "তারিখ নির্ধারিত হয়নি"}</span>
                  <span className="badge-soft">পাওনা: {bn(data?.dues?.paidCount ?? 0)} পরিশোধ · {bn(data?.dues?.dueCount ?? 0)} বাকি</span>
                  <span className="badge-soft">শিক্ষার্থী {bn(data?.roles?.student ?? 0)} · শিক্ষক {bn(data?.roles?.teacher ?? 0)} · প্রাক্তন {bn(data?.roles?.alumni ?? 0)}</span>
                </div>
              </Panel>
            </div>
          </div>
        ) : null}

        {tab === "funds" ? <FundsPanel fairSlug={fairSlug} /> : null}
        {tab === "dues" ? <DuesPanel fairSlug={fairSlug} /> : null}
        {tab === "expenses" ? <ExpensesPanel fairSlug={fairSlug} /> : null}
        {tab === "collections" ? <CollectionsPanel fairSlug={fairSlug} categories={categories} clubs={clubs} /> : null}
        {tab === "passes" ? <PassesPanel fairSlug={fairSlug} fairName={fair?.name ?? ""} /> : null}
        {tab === "users" ? <UsersPanel canManageAdmins={isAdmin} /> : null}
        {tab === "classes" ? <ClassesPanel /> : null}
        {tab === "ticker" ? <TickerPanel fairSlug={fairSlug} /> : null}

        {tab === "settings" ? (
          <SettingsPanel
            fairs={fairs}
            themes={themes}
            activeFairSlug={activeFairSlug}
            mode={mode}
            bannerEnabled={bannerEnabled}
            registrationOpen={registrationOpen}
            isAdmin={isAdmin}
          />
        ) : null}

        {loading ? <Empty>লোড হচ্ছে…</Empty> : null}
        {error ? <Notice kind="bad">{error}</Notice> : null}
      </main>

      <nav className="app-mobile-bar">
        {tabs.slice(0, 4).map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? "is-on" : ""} onClick={() => setTab(item.id)}>
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
        <Link href="/sf/scan" className="is-on" style={{ background: "transparent" }}>
          <ScanLine size={18} />
          স্ক্যান
        </Link>
      </nav>
    </div>
  );
}
