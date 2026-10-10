/**
 * The Science Fair panel's navigation map — one list for the desktop tab strip,
 * the fixed mobile bottom bar and the "More" drawer.
 *
 * Every entry is a real route under `/sf`, so `usePathname()` in the browser and
 * the server pages under `app/sf/[section]` agree on what is open, and a link can
 * be pasted or bookmarked. Nothing here is stored client-side.
 *
 * `kind: "console"` sections are rendered by `<FairConsole>` through
 * `/sf/[section]`; `kind: "page"` sections (the gate scanner) own their route.
 */
import {
  Boxes,
  ClipboardList,
  FileBarChart,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Megaphone,
  QrCode,
  Receipt,
  ScanLine,
  Settings,
  Upload,
  Utensils,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

export type SfSectionId =
  | "dashboard"
  | "students"
  | "scan"
  | "canteen"
  | "ticker"
  | "funds"
  | "dues"
  | "expenses"
  | "memos"
  | "collections"
  | "passes"
  | "import"
  | "users"
  | "classes"
  | "reports"
  | "settings";

export interface SfSection {
  id: SfSectionId;
  /** English label, kept short so the bottom bar never truncates mid-word. */
  label: string;
  /** One-line English description used on the "More" grid cards. */
  hint: string;
  icon: typeof Users;
  /** Route of the section. */
  href: string;
  /** `console` renders inside the console shell, `page` owns its own route. */
  kind: "console" | "page";
  /** Shown directly in the mobile bottom bar (max 4 around the scan button). */
  primary?: boolean;
}

export const sfSections: SfSection[] = [
  { id: "dashboard", label: "Dashboard", hint: "Money, gate and roster totals", icon: LayoutDashboard, href: "/sf", kind: "console", primary: true },
  { id: "students", label: "Students", hint: "Roster, class payments, tickets", icon: Users, href: "/sf/students", kind: "console", primary: true },
  { id: "scan", label: "Scan", hint: "Gate scanner and scan audit log", icon: ScanLine, href: "/sf/scan", kind: "page", primary: true },
  { id: "canteen", label: "Canteen", hint: "Lunch claims and daily audit", icon: Utensils, href: "/sf/canteen", kind: "page" },
  { id: "funds", label: "Funds", hint: "Collections and verification", icon: Wallet, href: "/sf/funds", kind: "console", primary: true },
  { id: "dues", label: "Dues", hint: "Class fees and balances", icon: Receipt, href: "/sf/dues", kind: "console" },
  { id: "expenses", label: "Expenses", hint: "Spending and settlements", icon: ClipboardList, href: "/sf/expenses", kind: "console" },
  { id: "memos", label: "Memos", hint: "Vouchers and memo ledger", icon: FileBarChart, href: "/sf/memos", kind: "console" },
  { id: "collections", label: "Collections", hint: "Projects and fair entries", icon: Boxes, href: "/sf/collections", kind: "console" },
  { id: "passes", label: "QR Passes", hint: "Family and guest passes", icon: QrCode, href: "/sf/passes", kind: "console" },
  { id: "ticker", label: "Ticker", hint: "Scrolling fair notices", icon: Megaphone, href: "/sf/ticker", kind: "console" },
  { id: "import", label: "Excel Import", hint: "Roster and account file import", icon: Upload, href: "/sf/import", kind: "console" },
  { id: "users", label: "Users", hint: "Accounts, roles and passwords", icon: UserCog, href: "/sf/users", kind: "console" },
  { id: "classes", label: "Classes", hint: "Class management, sections, fees", icon: GraduationCap, href: "/sf/classes", kind: "console" },
  { id: "reports", label: "Reports", hint: "Class payments, tickets and gate", icon: FileSpreadsheet, href: "/sf/reports", kind: "console" },
  { id: "settings", label: "Settings", hint: "Fair, mode, theme and printing", icon: Settings, href: "/sf/settings", kind: "console" },
];

/** Segments that belong to a real route and can never be a console section. */
export const sfReservedSegments = ["login", "forgot-password", "reset-password", "print"];

export const sfContentStudio = { id: "studio", label: "Content Studio", hint: "Website pages, news and clubs", icon: LayoutGrid, href: "/admin" } as const;
export const sfSignOut = { id: "signout", label: "Sign out", hint: "End this session on this device", icon: LogOut, href: "/sf/login" } as const;

/** Sections the console shell can render through `/sf/[section]`. */
export const sfConsoleSections = sfSections.filter((section) => section.kind === "console");

/** The items the mobile bar shows on either side of the scan button. */
export const sfBarSections = sfSections.filter((section) => section.primary && section.id !== "scan");

/** The scan button of the mobile bar. */
export const sfScanSection = sfSections.find((section) => section.id === "scan")!;

/** Everything the bottom bar cannot show — the "More" grid drawer. */
export const sfMoreSections = sfSections.filter((section) => !section.primary);

export function sfSectionById(id: string | null | undefined): SfSection | undefined {
  return sfSections.find((section) => section.id === id);
}

/**
 * Route segment (`students`, `settings`, …) → console section.
 *
 * `/sf/dashboard` is an alias of `/sf`, and reserved segments (the sign-in doors,
 * the print sheets) can never resolve to a section — they have their own routes.
 */
export function sfSectionBySlug(slug: string | null | undefined): SfSection | undefined {
  const clean = String(slug ?? "").trim().toLowerCase();
  if (!clean || sfReservedSegments.includes(clean)) return undefined;
  const match = sfSections.find((section) => section.href === `/sf/${clean}`) ?? (clean === "dashboard" ? sfSectionById("dashboard") : undefined);
  return match && match.kind === "console" ? match : undefined;
}

/** Route → section. `/sf` is the dashboard; unknown paths resolve to nothing. */
export function sfSectionForPath(pathname: string | null | undefined): SfSection | undefined {
  const clean = String(pathname ?? "").split("?")[0].replace(/\/+$/, "");
  if (clean === "/sf" || clean === "/sf/dashboard") return sfSectionById("dashboard");
  if (!clean.startsWith("/sf/")) return undefined;
  const segment = clean.slice(4).split("/")[0];
  return sfSections.find((section) => section.href === `/sf/${segment}`);
}

/**
 * Should the fixed bottom bar be painted for this path?
 *
 * Yes for the whole staff panel (`/sf`, `/sf/*`). No for the sign-in doors (a
 * signed-out visitor has nothing to navigate) and no for the print surfaces,
 * where a bar would sit on top of the ticket being printed.
 */
export function isSfPanelPath(pathname: string | null | undefined) {
  const path = String(pathname ?? "").split("?")[0];
  if (path !== "/sf" && !path.startsWith("/sf/")) return false;
  if (/^\/sf\/(login|forgot-password|reset-password)(\/|$)/.test(path)) return false;
  if (/^\/sf\/print(\/|$)/.test(path)) return false;
  return true;
}
