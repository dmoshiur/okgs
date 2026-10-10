"use client";

/**
 * FairConsole — the shell of the Science Fair admin panel.
 *
 * The section shown here comes from the URL (`/sf`, `/sf/students`, …), so the
 * fixed mobile bottom bar, the desktop tab strip and a pasted link can never
 * disagree. Only the fair selector keeps state: the choice is written to a
 * preference cookie (never localStorage) and the router is refreshed, which is
 * also why the selection survives a trip to the gate scanner.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  QrCode,
  Receipt,
  ScanLine,
  Users,
  Wallet,
  LayoutGrid,
  LogOut,
} from "lucide-react";
import type { Fair, SiteTheme } from "@/lib/types";
import type { FundRow, PublicUser } from "@/lib/portal-db";
import type { PortalRole } from "@/lib/roles";
import { en, formatDateEn } from "@/lib/format";
import { isAdminRole, roleLabelsEn } from "@/lib/roles";
import { sfConsoleSections, sfContentStudio, sfScanSection, type SfSectionId } from "@/components/sf/sections";
import { GATE_RESULT_LABEL, gateResultClass } from "@/components/sf/gate-status";
import { ThumbImage } from "@/components/public/Media";
import { Bars, Empty, Metric, Notice, Panel, money, postJson, useApi } from "@/components/sf/console/ui";
import { PortalAnnouncements } from "@/components/portal/PortalAnnouncements";

/* -------------------------------------------------------------------------
   Every console section is code-split and loaded on demand.

   The console used to ship all fourteen panels in one bundle, so opening the
   panel meant downloading the roster table, the memo ledger, the SMTP form and
   the report charts before the first tab could paint. `next/dynamic` with
   `ssr: false` keeps each section in its own chunk (the data is fetched on the
   client anyway), and the shared skeleton means a section switch shows structure
   immediately instead of a blank area.
   ------------------------------------------------------------------------- */
const panelLoading = (label: string) => () => <Empty>Loading {label}…</Empty>;

const FundsPanel = dynamic(() => import("@/components/sf/console/MoneyPanels").then((module) => module.FundsPanel), { ssr: false, loading: panelLoading("funds") });
const DuesPanel = dynamic(() => import("@/components/sf/console/MoneyPanels").then((module) => module.DuesPanel), { ssr: false, loading: panelLoading("dues") });
const ExpensesPanel = dynamic(() => import("@/components/sf/console/MoneyPanels").then((module) => module.ExpensesPanel), { ssr: false, loading: panelLoading("expenses") });
const ClassesPanel = dynamic(() => import("@/components/sf/console/PeoplePanels").then((module) => module.ClassesPanel), { ssr: false, loading: panelLoading("classes") });
const PassesPanel = dynamic(() => import("@/components/sf/console/PeoplePanels").then((module) => module.PassesPanel), { ssr: false, loading: panelLoading("passes") });
const UsersPanel = dynamic(() => import("@/components/sf/console/PeoplePanels").then((module) => module.UsersPanel), { ssr: false, loading: panelLoading("users") });
const CollectionsPanel = dynamic(() => import("@/components/sf/console/CollectionsPanel").then((module) => module.CollectionsPanel), { ssr: false, loading: panelLoading("collections") });
const SettingsPanel = dynamic(() => import("@/components/sf/console/SettingsPanel").then((module) => module.SettingsPanel), { ssr: false, loading: panelLoading("settings") });
const SettlementsPanel = dynamic(() => import("@/components/sf/console/SettlementsPanel").then((module) => module.SettlementsPanel), { ssr: false, loading: panelLoading("settlements") });
const TickerPanel = dynamic(() => import("@/components/sf/console/TickerPanel").then((module) => module.TickerPanel), { ssr: false, loading: panelLoading("ticker") });
const MemoPanel = dynamic(() => import("@/components/sf/console/MemoPanel").then((module) => module.MemoPanel), { ssr: false, loading: panelLoading("memos") });
const CSVImportPanel = dynamic(() => import("@/components/sf/console/CSVImportPanel").then((module) => module.CSVImportPanel), { ssr: false, loading: panelLoading("imports") });
const StudentsPanel = dynamic(() => import("@/components/sf/console/StudentsPanel").then((module) => module.StudentsPanel), { ssr: false, loading: panelLoading("students") });
const ReportsPanel = dynamic(() => import("@/components/sf/console/ReportsPanel").then((module) => module.ReportsPanel), { ssr: false, loading: panelLoading("reports") });

interface TicketScanRow {
  id: string;
  subject_type: string;
  subject_name: string;
  subject_code: string;
  method: string;
  result: string;
  entry_time: string;
  scanned_at: string;
  scanned_by_name: string;
  note: string;
}

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
  ticketScans: TicketScanRow[];
  gate: { success: number; duplicate: number; expired: number; invalid: number; admitted: number };
  roster: { total: number; paid: number; unpaid: number; printed: number; entered: number; guests: number };
  budget: {
    rows: { class_name: string; fee_amount: number; budget_amount: number; students: number; paid: number; collected: number; remaining: number }[];
    studentCollected: number;
    guestEntry: { fee: number; count: number; total: number };
    guestLunch: { fee: number; count: number; total: number };
    guestRegistered: number;
    totalCollected: number;
    totalBudget: number;
    remainingBudget: number;
  };
  pendingFunds: FundRow[];
  roles: Record<string, number>;
  activity: { id: string; actor_name: string; action: string; detail: string; created_at: string }[];
}

export function FairConsole({
  tab,
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
  fairName,
}: {
  tab: SfSectionId;
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
  fairName: string;
}) {
  const router = useRouter();
  // The route owns the section, so no tab state is kept here — that is what keeps
  // the mobile bottom bar in sync with what is on screen.
  const [fairSlug, setFairSlug] = useState(activeFairSlug);
  useEffect(() => { setFairSlug(activeFairSlug); }, [activeFairSlug]);
  const isAdmin = isAdminRole(role);
  const wantsStats = tab === "dashboard";
  const { data, loading, error, reload } = useApi<Stats>(wantsStats ? `/api/staff/stats?fair=${encodeURIComponent(fairSlug)}` : null, [fairSlug]);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");

  const fair = fairs.find((item) => item.slug === fairSlug) ?? fairs[0];
  const totals = data?.money;
  const gate = data?.gate ?? { success: 0, duplicate: 0, expired: 0, invalid: 0, admitted: 0 };
  const roster = data?.roster ?? { total: 0, paid: 0, unpaid: 0, printed: 0, entered: 0, guests: 0 };
  const activeLabel = sfConsoleSections.find((item) => item.id === tab)?.label ?? "Dashboard";

  async function chooseFair(slug: string) {
    setProblem("");
    try {
      // Written to a cookie the server reads back, so every section (and the
      // scanner) opens the same fair after a reload or a route change.
      await postJson("/api/staff/fair-preference", { slug });
      setFairSlug(slug);
      router.refresh();
    } catch (issue) {
      setProblem(issue instanceof Error ? issue.message : "The fair selection could not be saved.");
    }
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
    router.push("/sf/login");
    router.refresh();
  }

  return (
    <div className="v2 app-shell sf-console">
      <header className="app-top">
        <div className="v2-wrap app-top-inner">
          <div className="brand">
            <ThumbImage src={logo} alt="" className="official-logo" />
            <div className="brand-copy">
              <strong>{fair?.name ?? fairName}</strong>
              <small>
                {schoolName} · {roleLabelsEn[role]} · {user.name}
              </small>
            </div>
          </div>
          <div className="app-top-actions">
            <select className="v2-select sf-fair-select" aria-label="Active fair" value={fairSlug} onChange={(event) => void chooseFair(event.target.value)}>
              {fairs.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
              {!fairs.length ? <option value="">No fair configured</option> : null}
            </select>
            <Link className="v2-btn v2-btn-sm" href={sfScanSection.href}>
              <ScanLine size={15} /> <span className="sf-hide-sm">Gate scanner</span>
            </Link>
            <Link className="v2-btn v2-btn-sm v2-btn-ghost" href={sfContentStudio.href}>
              <LayoutGrid size={15} /> <span className="sf-hide-sm">Content Studio</span>
            </Link>
            <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={logout} aria-label="Sign out">
              <LogOut size={15} /> <span className="sf-hide-sm">Sign out</span>
            </button>
          </div>
        </div>

        <nav className="v2-wrap app-tabs" aria-label="Console sections">
          {sfConsoleSections.map((item) => (
            <Link key={item.id} href={item.href} prefetch className={`app-tab${tab === item.id ? " is-on" : ""}`} aria-current={tab === item.id ? "page" : undefined}>
              <item.icon size={15} />
              {item.label}
            </Link>
          ))}
          <Link className="app-tab" href={sfScanSection.href}>
            <ScanLine size={15} />
            {sfScanSection.label}
          </Link>
        </nav>
      </header>

      <main className="v2-wrap app-body sf-main">
        <div className="sf-page-head">
          <h1 className="sf-page-title">{activeLabel}</h1>
          <span className="sf-page-fair">{fair?.name ?? fairName}</span>
        </div>

        {message ? <Notice>{message}</Notice> : null}
        {problem ? <Notice kind="bad">{problem}</Notice> : null}

        {tab === "dashboard" ? (
          <div className="sf-stack">
            <div className="metric-grid">
              <Metric accent label="Collected (verified)" value={money(totals?.collected ?? 0)} note={`Today ${money(totals?.today ?? 0)} · ${en(totals?.entries ?? 0)} entries`} icon={<Wallet size={14} />} />
              <Metric label="Pending funds" value={money(totals?.pending ?? 0)} note={`${en(data?.pendingFunds?.length ?? 0)} waiting for verification`} icon={<Activity size={14} />} />
              <Metric label="Expenses" value={money(totals?.spent ?? 0)} note="All fair expenses" icon={<Receipt size={14} />} />
              <Metric label="Current balance" value={money(totals?.balance ?? 0)} note={(totals?.balance ?? 0) >= 0 ? "Surplus" : "Deficit"} icon={<BadgeCheck size={14} />} />
              <Metric label="Students paid" value={en(roster.paid)} note={`${en(roster.unpaid)} unpaid of ${en(roster.total)} in the roster`} icon={<Users size={14} />} />
              <Metric label="Admitted at the gate" value={en(gate.admitted)} note={`${en(gate.duplicate)} duplicate · ${en(gate.invalid)} invalid`} icon={<QrCode size={14} />} />
              <Metric
                accent
                label="Fair collections"
                value={money(data?.budget?.totalCollected ?? 0)}
                note={
                  data?.budget?.totalBudget
                    ? `${Math.min(100, Math.round(((data.budget.totalCollected || 0) / data.budget.totalBudget) * 100))}% of the ${money(data.budget.totalBudget)} class budgets`
                    : "No class budgets set yet — set them in Classes"
                }
                icon={<Wallet size={14} />}
              />
            </div>

            <PortalAnnouncements lang="en" />

            <Panel
              title="Class-wise budget & collections"
              action={
                data?.budget ? (
                  <span className="badge-soft">
                    Collected {money(data.budget.totalCollected)} · Target {money(data.budget.totalBudget)} · Remaining {money(data.budget.remainingBudget)}
                  </span>
                ) : undefined
              }
            >
              {data?.budget ? (
                <div className="sf-stack" style={{ gap: 12 }}>
                  {data.budget.totalBudget > 0 ? (
                    <div style={{ height: 10, borderRadius: 999, background: "var(--line-2, #e2e8f0)", overflow: "hidden" }} aria-hidden="true">
                      <div
                        style={{
                          width: `${Math.min(100, Math.round((data.budget.totalCollected / Math.max(1, data.budget.totalBudget)) * 100))}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: "linear-gradient(90deg, #1d4f91, #2e7d5b)",
                        }}
                      />
                    </div>
                  ) : null}
                  <div className="sf-table-wrap">
                    <table className="sf-table">
                      <thead>
                        <tr>
                          <th>Class</th>
                          <th>Paid students</th>
                          <th>Student collections</th>
                          <th>Target budget</th>
                          <th>Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.budget.rows ?? []).map((row) => (
                          <tr key={row.class_name}>
                            <td><strong>{row.class_name}</strong></td>
                            <td>{en(row.paid)} / {en(row.students)}</td>
                            <td>{money(row.collected)}</td>
                            <td>{row.budget_amount ? money(row.budget_amount) : "—"}</td>
                            <td>{row.budget_amount ? money(row.remaining) : "—"}</td>
                          </tr>
                        ))}
                        {!(data.budget.rows ?? []).length ? (
                          <tr><td colSpan={5}><Empty>No classes yet — add them in the Classes section.</Empty></td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="sf-chip-stack">
                    <span className="badge-soft">
                      <Users size={13} /> Student collections {money(data.budget.studentCollected)} ({en((data.budget.rows ?? []).reduce((sum, row) => sum + row.paid, 0))} paid students)
                    </span>
                    <span className="badge-soft">
                      <QrCode size={13} /> Guest entry fees {money(data.budget.guestEntry.total)} — {en(data.budget.guestEntry.count)} × {money(data.budget.guestEntry.fee)}
                    </span>
                    <span className="badge-soft">
                      <Receipt size={13} /> Lunch box sales {money(data.budget.guestLunch.total)} — {en(data.budget.guestLunch.count)} × {money(data.budget.guestLunch.fee)}
                    </span>
                  </div>
                </div>
              ) : (
                <Empty>Loading…</Empty>
              )}
            </Panel>

            <div className="sf-grid-2">
              <Panel title="Funds collected by class">
                <Bars
                  rows={(data?.fundsByClass ?? []).map((row) => ({
                    label: `${row.class_level}${row.section && row.section !== "—" ? ` · ${row.section}` : ""}`,
                    value: row.total,
                    note: row.students ? `(${en(row.students)} students)` : "",
                  }))}
                />
              </Panel>
              <Panel title="Students by class and section">
                <Bars
                  unit=" students"
                  rows={(data?.studentsByClass ?? []).map((row) => ({
                    label: `${row.class_level}${row.section && row.section !== "—" ? ` · ${row.section}` : ""}`,
                    value: row.total,
                  }))}
                />
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

              <Panel title="Gate scan audit" action={<Link className="badge-soft" href={sfScanSection.href}>Open scanner <ArrowRight size={12} /></Link>}>
                <div className="sf-list">
                  {(data?.ticketScans ?? []).map((scan) => (
                    <div key={scan.id} className="sf-list-row">
                      <span className={`sf-badge ${gateResultClass(scan.result)}`}>{GATE_RESULT_LABEL[scan.result] ?? "Recorded"}</span>
                      <span className="sf-list-main">
                        <strong>{scan.subject_name || "Unknown ticket"}</strong>
                        <small className="v2-muted">
                          {scan.subject_type === "guest" ? "Guest" : "Student"} · {scan.method === "manual" ? "Manual entry" : "QR scan"} · {scan.scanned_by_name || "—"} ·{" "}
                          {formatDateEn(scan.scanned_at, "short")}
                        </small>
                      </span>
                    </div>
                  ))}
                  {!(data?.ticketScans ?? []).length ? <Empty>No tickets have been scanned yet.</Empty> : null}
                </div>
              </Panel>

              <Panel title="Recent activity">
                <div className="sf-list">
                  {(data?.activity ?? []).map((item) => (
                    <div key={item.id} className="sf-list-row sf-list-stack">
                      <span>
                        <strong>{item.actor_name || "System"}</strong> <span className="v2-muted">{item.action}</span>
                      </span>
                      <span className="v2-muted sf-help">
                        {item.detail} · {formatDateEn(item.created_at, "short")}
                      </span>
                    </div>
                  ))}
                  {!(data?.activity ?? []).length ? <Empty>No activity yet.</Empty> : null}
                </div>
              </Panel>

              <Panel title="Quick actions">
                <div className="pill-row">
                  <Link className="pill" href="/sf/students">Class payments</Link>
                  <Link className="pill" href="/sf/students">Import Excel roster</Link>
                  <Link className="pill" href="/sf/reports">Reports</Link>
                  <Link className="pill" href="/sf/funds">Add fund</Link>
                  <Link className="pill" href="/sf/dues">Class dues</Link>
                  <Link className="pill" href="/sf/expenses">Add expense</Link>
                  <Link className="pill" href="/sf/users">Add user</Link>
                </div>
                <div className="sf-chip-stack">
                  <span className="badge-soft">
                    <Receipt size={13} /> Dues: {en(data?.dues?.paidCount ?? 0)} paid · {en(data?.dues?.dueCount ?? 0)} due
                  </span>
                  <span className="badge-soft">
                    <QrCode size={13} /> {en(data?.passes?.total ?? 0)} passes · {en(roster.printed)} tickets printed · {en(roster.entered)} entered
                  </span>
                  <span className="badge-soft">
                    <Users size={13} /> Students {en(data?.roles?.student ?? 0)} · Teachers {en(data?.roles?.teacher ?? 0)} · Alumni {en(data?.roles?.alumni ?? 0)}
                  </span>
                </div>
              </Panel>
            </div>
          </div>
        ) : null}

        {tab === "students" ? <StudentsPanel fairSlug={fairSlug} fairName={fair?.name ?? fairName} canProvision={isAdmin} /> : null}
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
        {tab === "passes" ? <PassesPanel fairSlug={fairSlug} fairName={fair?.name ?? fairName} /> : null}
        {tab === "import" ? <CSVImportPanel fairSlug={fairSlug} /> : null}
        {tab === "users" ? <UsersPanel canManageAdmins={isAdmin} canManageSuperAdmins={role === "superadmin"} fairSlug={fairSlug} /> : null}
        {tab === "classes" ? <ClassesPanel fairSlug={fairSlug} /> : null}
        {tab === "ticker" ? <TickerPanel fairSlug={fairSlug} /> : null}
        {tab === "reports" ? <ReportsPanel fairSlug={fairSlug} fairName={fair?.name ?? fairName} /> : null}
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

        {loading && wantsStats ? <Empty>Loading…</Empty> : null}
        {error && wantsStats ? <Notice kind="bad">{error}</Notice> : null}
      </main>
    </div>
  );
}
