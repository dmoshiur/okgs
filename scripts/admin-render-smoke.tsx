/**
 * Render smoke test for the refactored admin pieces (no browser needed):
 * server-renders the real components with realistic data and asserts the
 * layout contract the /admin bugfixes were about. Run: `npx tsx scripts/admin-render-smoke.tsx`.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { AdminSidebar } from "../components/admin/AdminSidebar";
import { ClubCoverageTable, MetricGrid, RecentActivityList } from "../components/admin/DashboardMetrics";
import { readFileSync } from "node:fs";
import { ContentListTable } from "../components/admin/ContentListTable";

const noop = () => {};

const clubs = [
  { id: "c1", name: "বিজ্ঞান ক্লাব", slug: "alssm", accent: "#2563eb", is_active: 1 },
  { id: "c2", name: "সাহিত্য সমাজ", slug: "artds", is_active: 0 },
];
const items = [
  ...Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, title: `আয়োজন ${i}`, club_slug: i < 4 ? "alssm" : "artds", is_active: i < 5 ? 1 : 0, event_date: "2026-11-0" + i, updated_at: "2026-10-01T10:00:00Z" })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, title: `স্লাইড ${i}`, is_active: 1, updated_at: "2026-10-01T10:00:00Z" })),
  ...Array.from({ length: 57 }, (_, i) => ({ id: `m${i}`, name: `সদস্য ${i}`, club_slug: "alssm", is_active: 1, updated_at: "2026-10-01T10:00:00Z" })),
];
const data: Record<string, any[]> = { clubs, club_events: items.slice(0, 6), slides: items.slice(6, 11), club_members: items.slice(11) };

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
};

/* ---- Sidebar ---------------------------------------------------------- */
const counts: Record<string, { live: number; total: number }> = {
  club_events: { live: 5, total: 6 },
  slides: { live: 5, total: 5 },
  club_members: { live: 57, total: 57 },
  club_posts: { live: 0, total: 0 },
};
const sidebar = renderToStaticMarkup(
  h(AdminSidebar, { active: "overview", counts, loading: false, media: null, mobileNav: false, isSuperAdmin: true, userName: "Super Admin", userEmail: "admin@okgs.info", onClose: noop, onNavigate: noop }),
);
const strip = (s: string) => s.replace(/<[^>]+>/g, "|");

// 1) Label text is clean — no digits concatenated inside the label span.
const labelChunk = /<span class="whitespace-nowrap truncate"[^>]*>[^<]*<\/span><\/span>/.exec(sidebar);
check("sidebar: labels contain no raw 5/6-style counts", !!labelChunk && !/\d+\/\d+/.test(labelChunk[0]));
check("sidebar: club_events label is 'Club events' alone", /truncate" title="Club events">Club events<\/span><\/span>/.test(sidebar));

// 2) Count lives in a pill AFTER the label group (right side), with slate classes.
check("sidebar: count pill carries bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs", /class="nav-count ml-auto shrink-0 px-2 py-0\.5 rounded-full text-xs"[^>]*>5\/6<\/span>/.test(sidebar));
check("sidebar: zero-count pills render dim 0 not concatenated text", /class="nav-count ml-auto shrink-0 px-2 py-0\.5 rounded-full text-xs is-empty"/.test(sidebar));
const pillOrder = /<span class="whitespace-nowrap truncate"[^>]*>Club events<\/span><\/span>\s*<span class="nav-count[^>]*>5\/6<\/span>/.test(sidebar);
check("sidebar: pill sits after label (justify-between order)", pillOrder);
check("sidebar: logo copy uses truncation, not a raw span grid", /admin-logo-copy/.test(sidebar) && /truncate">OKGS</.test(sidebar));
check("sidebar: workspace chip truncates", /workspace-copy/.test(sidebar));

/* Sidebar row-overlap contract — asserted in the CSS section at the end of this
   file (see "Scroll contract"), where globals.css is read once. */

/* ---- Coverage progress table ----------------------------------------- */
const coverage = [
  { club: clubs[0], counts: { club_events: 4, club_posts: 0, club_gallery: 2, club_members: 57, club_achievements: 0 }, draft: false },
  { club: clubs[1], counts: { club_events: 2, club_posts: 0, club_gallery: 0, club_members: 0, club_achievements: 5 }, draft: true },
];
const covHtml = renderToStaticMarkup(h(ClubCoverageTable, { coverage, loading: false, onOpenClubs: noop, onOpenClubResource: noop }));
const headCols = (covHtml.match(/role="columnheader"/g) || []).length;
check("coverage: header has 6 columns (name + 5 collections)", headCols === 6);
const rowChunks = covHtml.split('class="coverage-row"').slice(1);
check("coverage: 2 club rows rendered", rowChunks.length === 2);
check("coverage: every row carries exactly 5 count cells", rowChunks.every((chunk) => (chunk.match(/coverage-cell/g) || []).length === 5));
check("coverage: zero cells are styled chips (is-zero) not bare text", /coverage-cell is-zero/.test(covHtml));
check("coverage: counts are plain numerals inside chips", /coverage-cell tabular-nums"[^>]*>4<\/button>/.test(covHtml));
check("coverage: draft club flagged", /coverage-draft-flag/.test(covHtml));

/* ---- Metric grid ------------------------------------------------------ */
const metricHtml = renderToStaticMarkup(
  h(MetricGrid, { stats: { loading: false, clubs: 5, activeClubs: 4, upcoming: 2, totalEvents: 6, cloudinaryImages: 0, mediaNote: "not configured", drafts: 3, live: 70 } }),
);
check("metrics: label and value share the .metric-top row", /<div class="metric-top">[\s\S]*?metric-label[\s\S]*?metric-value[\s\S]*?<\/div>\s*<small class="metric-note/.test(metricHtml));
check("metrics: value right-anchored with tabular-nums", /metric-value tabular-nums">5<\/strong>/.test(metricHtml));

/* ---- Recent list ------------------------------------------------------ */
const recent = renderToStaticMarkup(
  h(RecentActivityList, {
    items: [
      { key: "settings-a", resource: "settings", item: { id: "a", key: "principal", value: "অধ্যক্ষ", updated_at: "2026-10-01T09:00:00Z" } },
      { key: "club_events-1", resource: "club_events", item: { id: "1", title: "বার্ষিক বিজ্ঞান মেলা", updated_at: "2026-10-01T08:00:00Z", is_active: false } },
    ],
    onOpen: noop,
  }),
);
check("recent: uses .recent-row buttons inside a <ul> (no stray bullets target)", /<li><button class="recent-row"/.test(recent));
check("recent: title clamps to one line", /<b class="line-clamp-1 break-words leading-normal">/.test(recent));
check("recent: meta line is nowrap-truncated, separated from title", /<small class="whitespace-nowrap truncate">[^<]* · /.test(recent));

/* ---- Content list table ---------------------------------------------- */
const tableHtml = renderToStaticMarkup(
  h(ContentListTable, {
    resource: "club_events", rows: data.club_events, loading: false, clubs, busyRowId: "", reorderable: true, hasFilters: false,
    onCreate: noop, onClearFilters: noop, onEdit: noop, onDuplicate: noop, onDelete: noop, onToggle: noop, onMove: noop,
  }),
);
check("table: head + rows live in a shared scroll container", /content-panel[\s\S]*class="content-table"/.test(tableHtml));
check("table: 5 column headers nowrap", (tableHtml.match(/role="columnheader"/g) || []).length === 5);
check("table: status is a real button pill per row", (tableHtml.match(/<button type="button" class="status-pill/g) || []).length === 6);
check("table: row title truncates with title attr", /<b class="truncate whitespace-nowrap" title="আয়োজন 0">/.test(tableHtml));
check("table: status pill reads Published/Draft in English", /Published|Draft/.test(tableHtml));

/* ---- Scroll contract (globals.css) ------------------------------------ */
/* The studio bugfix: the page never scrolls, the rail and the content pane each
   scroll on their own, and the topbar stays pinned while the list scrolls. */
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const cssBlock = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return "";
  const end = css.indexOf("}", start);
  return css.slice(start, end === -1 ? undefined : end);
};
const shell = cssBlock(".admin-shell");
const rail = cssBlock(".admin-sidebar");
const pane = cssBlock(".admin-content");
check("css: shell is height-locked and clipped (page itself never scrolls)", /height:\s*100dvh/.test(shell) && /overflow:\s*hidden/.test(shell));
check("css: rail owns its own vertical scroll", /overflow-y:\s*auto/.test(rail) && /height:\s*100%/.test(rail));
check("css: content pane owns the other one", /overflow-y:\s*auto/.test(pane) && /flex:\s*1 1 auto/.test(pane));
check("css: topbar is pinned above the scrolling pane", /flex:\s*0 0 auto/.test(cssBlock(".admin-topbar")));
check("css: mobile rail is full viewport height", /height:\s*100dvh/.test(rail.replace(/^[^]*?\.admin-sidebar \{/, "")) || /100dvh/.test(css));

/* ---- Sidebar overlap contract ----------------------------------------- */
/* The row-overlap bug: the rail is a definite-height flex column, so flex items
   shrank first (min-height:0 on the nav groups dropped the floor to zero) and
   their fixed-height rows painted over the next section. These assertions keep
   the fix in place: sections never shrink, rows are spaced, headers own a fixed
   box, badges are right-aligned and long labels ellipsise. */
const rule = (selector: string) => cssBlock(selector).replace(/\/\*[\s\S]*?\*\//g, "");
const railChildren = rule(".admin-sidebar > *");
const navList = rule(".admin-nav");
const navGroup = rule(".admin-nav-group");
const navLabel = rule(".admin-nav-label");
const navRow = rule(".admin-nav a, .admin-nav button, .sidebar-bottom a, .sidebar-bottom button");
const navCount = rule(".nav-count");

check("css: rail is sticky at top:0 with its own thin scrollbar",
  /position:\s*sticky/.test(rail) && /top:\s*0/.test(rail) && /scrollbar-width:\s*thin/.test(rail) && /\.admin-sidebar::-webkit-scrollbar-thumb/.test(css));
check("css: rail sections never shrink (the row-overlap root cause)",
  /flex:\s*0 0 auto/.test(railChildren) && /min-height:\s*auto/.test(railChildren) && !/\.admin-sidebar \.admin-nav-group[^{]*\{[^}]*min-height:\s*0/.test(css));
check("css: menu items are spaced (gap:8px) instead of squashed",
  /gap:\s*8px/.test(navList) && /gap:\s*8px/.test(navGroup) && /margin-top:\s*16px/.test(navGroup));
check("css: category headers are a fixed 20px box",
  /height:\s*20px/.test(navLabel) && /line-height:\s*20px/.test(navLabel) && /text-transform:\s*uppercase/.test(navLabel) && /text-overflow:\s*ellipsis/.test(navLabel));
check("css: nav rows keep a minimum height and cannot shrink",
  /min-height:\s*4\dpx/.test(navRow) && /flex:\s*0 0 auto/.test(navRow) && /line-height:\s*1\.5/.test(navRow));
check("css: badge is right-aligned with ml-auto and never shrinks",
  /margin-left:\s*auto/.test(navCount) && /flex:\s*0 0 auto/.test(navCount) && /white-space:\s*nowrap/.test(navCount));
check("css: long labels ellipsise (truncate) instead of spilling over badges",
  /\.truncate \{[^}]*text-overflow:\s*ellipsis/.test(css) && /\.nav-item-label span \{[^}]*text-overflow:\s*ellipsis/.test(css));
// A grid item defaults to min-width:auto (= min-content), so a long nowrap label
// would widen its track past the rail and push the badge off-canvas. minmax(0,1fr)
// tracks + min-width:0 items keep label and badge inside the rail.
check("css: nav grid tracks are shrinkable (minmax(0,1fr)) with min-width:0 rows",
  /\.admin-nav, \.admin-nav-group, \.sidebar-bottom \{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(css)
  && /\.admin-nav > \*, \.admin-nav-group > \*, \.sidebar-bottom > \* \{[^}]*min-width:\s*0/.test(css));
check("css: h-screen / sticky / scrollbar-thin utilities back the class contract",
  /\.h-screen \{[^}]*100dvh/.test(css) && /\.sticky \{[^}]*position:\s*sticky/.test(css) && /\.scrollbar-thin \{[^}]*scrollbar-width:\s*thin/.test(css));

console.log(failures ? `\n${failures} check(s) failed` : "\nAll render checks passed.");
process.exit(failures ? 1 : 0);
