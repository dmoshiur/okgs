"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BadgeCheck,
  Boxes,
  CalendarDays,
  ClipboardList,
  FileText,
  Gauge,
  GraduationCap,
  LayoutGrid,
  LogOut,
  Megaphone,
  MoreHorizontal,
  QrCode,
  Receipt,
  ScanLine,
  Settings2,
  Upload,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { Fair, SiteTheme } from "@/lib/types";
import type { DueRow, FundRow, PublicUser, ScanRow } from "@/lib/portal-db";
import { en, formatDateEn } from "@/lib/format";
import { isAdminRole, roleLabelsEn, type PortalRole } from "@/lib/roles";
import { Bars, Empty, Metric, Notice, Panel, money, postJson, useApi } from "@/components/sf/console/ui";
import { DuesPanel, ExpensesPanel, FundsPanel } from "@/components/sf/console/MoneyPanels";
import { ClassesPanel, PassesPanel, UsersPanel } from "@/components/sf/console/PeoplePanels";
import { CollectionsPanel } from "@/components/sf/console/CollectionsPanel";
import { SettingsPanel } from "@/components/sf/console/SettingsPanel";
import { SettlementsPanel } from "@/components/sf/console/SettlementsPanel";
import { TickerPanel } from "@/components/sf/console/TickerPanel";
import { MemoPanel } from "@/components/sf/console/MemoPanel";
import { CSVImportPanel } from "@/components/sf/console/CSVImportPanel";
import { StudentsPanel } from "@/components/sf/console/StudentsPanel";
import { PortalAnnouncements } from "@/components/portal/PortalAnnouncements";

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

type TabId =
  | "dashboard"
  | "students"
  | "funds"
  | "dues"
  | "expenses"
  | "memos"
  | "collections"
  | "passes"
  | "ticker"
  | "users"
  | "import"
  | "classes"
  | "settings";

const tabs: { id: TabId; label: string; hint: string; icon: typeof Gauge }[] = [
  { id: "dashboard", label: "Dashboard", hint: "Totals, alerts and activity", icon: Gauge },
  { id: "students", label: "Students & Payments", hint: "Roster, payments, tickets, guests", icon: Users },
  { id: "funds", label: "Funds", hint: "Fund collections and verification", icon: Wallet },
  { id: "dues", label: "Dues", hint: "Class fees and balances", icon: Receipt },
  { id: "expenses", label: "Expenses", hint: "Spending and monthly settlements", icon: ClipboardList },
  { id: "memos", label: "Memos", hint: "Vouchers and memo ledger", icon: FileText },
  { id: "collections", label: "Collections", hint: "Projects and entries", icon: Boxes },
  { id: "passes", label: "QR Passes", hint: "Family and guest passes", icon: QrCode },
  { id: "ticker", label: "Ticker", hint: "Scrolling fair notices", icon: Megaphone },
  { id: "users", label: "Users", hint: "Accounts and roles", icon: UserCog },
  { id: "import", label: "User Import", hint: "CSV import of accounts", icon: Upload },
  { id: "classes", label: "Classes", hint: "Class structure and fees", icon: GraduationCap },
  { id: "settings", label: "Settings", hint: "Fair and site settings", icon: Settings2 },
];

const mobilePrimary: TabId[] = ["dashboard", "students", "funds"];

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
  const [moreOpen, setMoreOpen] = useState(false);
  const [fairSlug, setFairSlug] = useState(activeFairSlug);
  const isAdmin = isAdminRole(role);
  const { data, loading, error, reload } = useApi<Stats>(tab === "dashboard" ? `/api/staff/stats?fair=${encodeURIComponent(fairSlug)}` : null, [fairSlug, tab]);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");

  const fair = fairs.find((item) => item.slug === fairSlug) ?? fairs[0];
  const moneyTotals = data?.money;
  const classRows = useMemo(
    () =>
      (data?.fundsByClass ?? []).map((row) => ({
        label: `${row.class_level}${row.section && row.section !== "—" ? ` · ${row.section}` : ""}`,
        value: row.total,
        note: row.students ? `(${en(row.students)} students)` : "",
      })),
    [data],
  );
  const activeLabel = tabs.find((item) => item.id === tab)?.label ?? "Dashboard";

  function openTab(next: TabId) {
    setTab(next);
    setMoreOpen(false);
    setProblem("");
  }

  async function verifyFund(fund: FundRow) {
    try {
      await postJson("/api/staff/funds", { id: fund.id, status: "verified" }, "PATCH");
      setMessage(`${fund.payer_name} — ${money(fund.amount)} verified.`);
      await reload();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "Could not verify this fund.");
    }
  }

  async function logout() {
    await fetch("/api/portal/login", { method: "DELETE" });
    window.location.href = "/sf/login";
  }

  return (
    <div className="v2 app-shell sf-console">
      <header className="app-top">
        <div className="v2-wrap app-top-inner">
          <div className="brand">
            {logo ? <img className="official-logo" src={logo} alt={schoolName} /> : null}
            <div className="brand-copy">
              <strong>{fair?.name ?? "Science Fair"}</strong>
              <small>
                {schoolName} · {roleLabelsEn[role]} · {user.name}
              </small>
            </div>
          </div>
          <div className="app-top-actions">
            <select className="v2-select sf-fair-select" aria-label="Active fair" value={fairSlug} onChange={(event) => setFairSlug(event.target.value)}>
              {fairs.map((item) => (
                <option key={item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
            <Link className="v2-btn v2-btn-sm" href="/sf/scan">
              <ScanLine size={15} /> <span className="sf-hide-sm">Gate scanner</span>
            </Link>
            <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={logout} aria-label="Sign out">
              <LogOut size={15} /> <span className="sf-hide-sm">Sign out</span>
            </button>
          </div>
        </div>
        <nav className="v2-wrap app-tabs" aria-label="Console sections">
          {tabs.map((item) => (
            <button key={item.id} type="button" className={`app-tab ${tab === item.id ? "is-on" : ""}`} onClick={() => openTab(item.id)} aria-current={tab === item.id ? "page" : undefined}>
              <item.icon size={15} />
              {item.label}
            </button>
          ))}
          <a className="app-tab" href="/admin" target="_blank" rel="noreferrer">
            <LayoutGrid size={15} />
            Content Studio
          </a>
        </nav>
      </header>

      <main className="v2-wrap app-body sf-main">
        <h1 className="sf-page-title">{activeLabel}</h1>
        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}

        {tab === "dashboard" ? (
          <div className="sf-stack">
            <div className="metric-grid">
              <Metric accent label="Collected (verified)" value={money(moneyTotals?.collected ?? 0)} note={`Today ${money(moneyTotals?.today ?? 0)} · ${en(moneyTotals?.entries ?? 0)} entries`} icon={<Wallet size={14} />} />
              <Metric label="Pending funds" value={money(moneyTotals?.pending ?? 0)} note={`${en(data?.pendingFunds?.length ?? 0)} waiting for verification`} icon={<Activity size={14} />} />
              <Metric label="Expenses" value={money(moneyTotals?.spent ?? 0)} note="All fair expenses" icon={<Receipt size={14} />} />
              <Metric label="Current balance" value={money(moneyTotals?.balance ?? 0)} note={(moneyTotals?.balance ?? 0) >= 0 ? "Surplus" : "Deficit"} icon={<BadgeCheck size={14} />} />
              <Metric label="Dues outstanding" value={money(moneyTotals?.duesOutstanding ?? 0)} note={`${en(data?.dues?.dueCount ?? 0)} students due`} icon={<ClipboardList size={14} />} />
              <Metric label="QR passes" value={en(data?.passes?.total ?? 0)} note={`${en(data?.scans?.ok ?? 0)} successful scans`} icon={<QrCode size={14} />} />
            </div>

            <PortalAnnouncements />

            <div className="sf-grid-2">
              <Panel title="Funds collected by class">
                <Bars rows={classRows} />
              </Panel>
              <Panel title="Students by class and section">
                <Bars unit=" students" rows={(data?.studentsByClass ?? []).map((row) => ({ label: `${row.class_level}${row.section && row.section !== "—" ? ` · ${row.section}` : ""}`, value: row.total }))} />
              </Panel>
              <Panel title="Expense categories">
                <Bars rows={(data?.expensesByCategory ?? []).map((row) => ({ label: row.category, value: row.total }))} />
              </Panel>
              <Panel title="Funds by payment method">
                <Bars rows={(data?.fundsByMethod ?? []).map((row) => ({ label: row.method, value: row.total }))} />
              </Panel>
            </div>

            <div className="sf-grid-2 sf-grid-2-wide">
              <Panel title="Awaiting verification" action={<span className="badge-soft">{en(data?.pendingFunds?.length ?? 0)}</span>}>
                <div className="sf-list">
                  {(data?.pendingFunds ?? []).map((fund) => (
                    <div key={fund.id} className="sf-list-row">
                      <div className="sf-list-main">
                        <strong>{fund.payer_name}</strong>
                        <span className="v2-muted">{[fund.class_level, fund.section, fund.method, formatDateEn(fund.created_at, "short")].filter(Boolean).join(" · ")}</span>
                      </div>
                      <strong className="sf-nowrap">{money(fund.amount)}</strong>
                      <button className="v2-btn v2-btn-sm" type="button" onClick={() => verifyFund(fund)}>
                        <BadgeCheck size={14} /> Verify
                      </button>
                    </div>
                  ))}
                  {!(data?.pendingFunds ?? []).length ? <Empty>All funds are verified — nothing is waiting.</Empty> : null}
                </div>
              </Panel>

              <Panel title="Recent scans" action={<Link className="badge-soft" href="/sf/scan">Open scanner</Link>}>
                <div className="sf-list">
                  {(data?.recentScans ?? []).map((scan) => (
                    <div key={scan.id} className="sf-list-row">
                      <span className={`sf-badge ${scan.result === "ok" ? "is-good" : scan.result === "duplicate" ? "is-warn" : "is-bad"}`}>{scan.result}</span>
                      <span className="sf-list-main">{scan.scanned_by_name || "—"}</span>
                      <span className="v2-muted sf-nowrap">{formatDateEn(scan.created_at, "short")}</span>
                    </div>
                  ))}
                  {!(data?.recentScans ?? []).length ? <Empty>No QR scans yet.</Empty> : null}
                </div>
              </Panel>

              <Panel title="Recent activity">
                <div className="sf-list">
                  {(data?.activity ?? []).map((item) => (
                    <div key={item.id} className="sf-list-row sf-list-stack">
                      <span><strong>{item.actor_name || "System"}</strong> <span className="v2-muted">{item.action}</span></span>
                      <span className="v2-muted sf-help">{item.detail} · {formatDateEn(item.created_at, "short")}</span>
                    </div>
                  ))}
                  {!(data?.activity ?? []).length ? <Empty>No activity yet.</Empty> : null}
                </div>
              </Panel>

              <Panel title="Quick actions">
                <div className="pill-row">
                  <button className="pill" type="button" onClick={() => openTab("students")}>Mark payments</button>
                  <button className="pill" type="button" onClick={() => openTab("students")}>Import Excel roster</button>
                  <button className="pill" type="button" onClick={() => openTab("funds")}>Add fund</button>
                  <button className="pill" type="button" onClick={() => openTab("dues")}>Class dues</button>
                  <button className="pill" type="button" onClick={() => openTab("expenses")}>Add expense</button>
                  <button className="pill" type="button" onClick={() => openTab("users")}>Add user</button>
                </div>
                <div className="sf-chip-stack">
                  <span className="badge-soft"><CalendarDays size={13} /> {fair?.starts_on ? `${formatDateEn(fair.starts_on)}${fair.ends_on && fair.ends_on !== fair.starts_on ? ` – ${formatDateEn(fair.ends_on)}` : ""}` : "Dates not set"}</span>
                  <span className="badge-soft">Dues: {en(data?.dues?.paidCount ?? 0)} paid · {en(data?.dues?.dueCount ?? 0)} due</span>
                  <span className="badge-soft">Students {en(data?.roles?.student ?? 0)} · Teachers {en(data?.roles?.teacher ?? 0)} · Alumni {en(data?.roles?.alumni ?? 0)}</span>
                </div>
              </Panel>
            </div>
          </div>
        ) : null}

        {tab === "students" ? <StudentsPanel fairSlug={fairSlug} fairName={fair?.name ?? ""} /> : null}
        {tab === "funds" ? <FundsPanel fairSlug={fairSlug} /> : null}
        {tab === "dues" ? <DuesPanel fairSlug={fairSlug} /> : null}
        {tab === "expenses" ? (
          <div className="sf-stack">
            <ExpensesPanel fairSlug={fairSlug} />
            <SettlementsPanel fairSlug={fairSlug} canDelete={isAdmin} />
          </div>
        ) : null}
        {tab === "memos" ? <MemoPanel fairSlug={fairSlug} /> : null}
        {tab === "collections" ? <CollectionsPanel fairSlug={fairSlug} categories={categories} clubs={clubs} /> : null}
        {tab === "passes" ? <PassesPanel fairSlug={fairSlug} fairName={fair?.name ?? ""} /> : null}
        {tab === "import" ? <CSVImportPanel fairSlug={fairSlug} /> : null}
        {tab === "users" ? <UsersPanel canManageAdmins={isAdmin} canManageSuperAdmins={role === "superadmin"} fairSlug={fairSlug} /> : null}
        {tab === "classes" ? <ClassesPanel fairSlug={fairSlug} /> : null}
        {tab === "ticker" ? <TickerPanel fairSlug={fairSlug} /> : null}
        {tab === "settings" ? (
          <SettingsPanel fairs={fairs} themes={themes} activeFairSlug={activeFairSlug} mode={mode} bannerEnabled={bannerEnabled} registrationOpen={registrationOpen} isAdmin={isAdmin} />
        ) : null}

        {loading && tab === "dashboard" ? <Empty>Loading…</Empty> : null}
        {error && tab === "dashboard" ? <Notice kind="bad">{error}</Notice> : null}
      </main>

      {/* Mobile bottom navigation (under 768px). */}
      <nav className="sf-bottom-nav" aria-label="Primary">
        {tabs.filter((item) => mobilePrimary.includes(item.id)).map((item) => (
          <button key={item.id} type="button" className={tab === item.id && !moreOpen ? "is-active" : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => openTab(item.id)}>
            <item.icon size={20} />
            <span>{item.label === "Students & Payments" ? "Students" : item.label}</span>
          </button>
        ))}
        <Link href="/sf/scan" className="sf-bottom-scan">
          <ScanLine size={20} />
          <span>Scan</span>
        </Link>
        <button type="button" className={moreOpen || !mobilePrimary.includes(tab) ? "is-active" : ""} aria-expanded={moreOpen} aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>

      {moreOpen ? (
        <div className="sf-more" role="dialog" aria-modal="true" aria-labelledby="sf-more-title">
          <header className="sf-more-head">
            <div>
              <h2 id="sf-more-title">All tools</h2>
              <span className="v2-muted">{fair?.name ?? "Science Fair"} · {roleLabelsEn[role]}</span>
            </div>
            <button type="button" className="v2-btn v2-btn-ghost" onClick={() => setMoreOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
          </header>
          <div className="sf-more-grid">
            {tabs.map((item) => (
              <button key={item.id} type="button" className={`sf-tool-card ${tab === item.id ? "is-on" : ""}`} onClick={() => openTab(item.id)}>
                <span className="sf-tool-icon"><item.icon size={22} /></span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </button>
            ))}
            <Link href="/sf/scan" className="sf-tool-card" onClick={() => setMoreOpen(false)}>
              <span className="sf-tool-icon"><ScanLine size={22} /></span>
              <strong>Gate scanner</strong>
              <small>Camera scan and scan audit log</small>
            </Link>
            <a href="/admin" target="_blank" rel="noreferrer" className="sf-tool-card">
              <span className="sf-tool-icon"><LayoutGrid size={22} /></span>
              <strong>Content Studio</strong>
              <small>Website pages, news and clubs</small>
            </a>
            <button type="button" className="sf-tool-card" onClick={logout}>
              <span className="sf-tool-icon"><LogOut size={22} /></span>
              <strong>Sign out</strong>
              <small>End this session</small>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
