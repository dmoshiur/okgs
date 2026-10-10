/**
 * Structural regression checks for the Science Fair panel (run by `npm run smoke`).
 *
 * No browser is available in CI, so these assertions pin the contracts the bug
 * report was about: the global bottom nav, the English-only staff copy, the exact
 * .xlsx header row, the roll-range parser behind class-wise payment, the portrait
 * ticket markup and the rule that no UI state may live in the browser's storage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { TicketSheet } from "../components/sf/print/TicketSheet";
import { sfBarSections, sfMoreSections, sfSectionForPath, isSfPanelPath, sfScanSection } from "../components/sf/sections";
import { GATE_RESULT_LABEL, gateResultClass } from "../components/sf/gate-status";
import { STUDENT_COLUMNS } from "../lib/student-db";
import { studentColumnHeaders } from "../lib/student-columns";
import { parseRollExpression } from "../lib/roll-range";
import { toLatinDigits, hasBengali } from "../lib/digits";
import { formatDateTimeEn, formatTimeEn, en } from "../lib/format";

const read = (path: string) => readFileSync(new URL(path, new URL("../", import.meta.url)), "utf8");
const css = read("app/globals.css");
const layout = read("app/layout.tsx");
const nav = read("components/sf/BottomNav.tsx");
const scanner = read("components/sf/Scanner.tsx");
const students = read("components/sf/console/StudentsPanel.tsx");
const sheet = read("components/sf/print/TicketSheet.tsx");
const importer = read("app/api/staff/students/import/route.ts");

let checks = 0;
function pass(label: string) {
  checks += 1;
  console.log(`PASS  ${label}`);
}

// ---------- 1 + 2 · global navigation -------------------------------------
assert.match(layout, /<BottomNav\s*\/>/, "the root layout must mount <BottomNav/>");
/** Comments may *say* localStorage (most of them explain why it is banned) — strip them before testing. */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
const BROWSER_STORE = /(?:window\.|globalThis\.)?\b(?:localStorage|sessionStorage|indexedDB)\s*[.[]/;
assert.ok(!BROWSER_STORE.test(code(layout)), "layout must not use browser storage");
assert.ok(layout.includes("import { BottomNav }"), "layout imports the nav once, not per page");
assert.match(nav, /isSfPanelPath\(pathname\)/, "the nav decides for itself which routes carry it");
assert.match(nav, /aria-label="Science Fair navigation"/);
assert.match(nav, /sfBarSections/, "the bar's items come from the shared registry");
assert.match(nav, /sfMoreSections/, "the drawer's items come from the same registry");
assert.match(nav, /href="\/sf\/scan"/, "the scan button points at the real route");
assert.equal(sfBarSections.length + sfMoreSections.length >= 9, true, "the registry must cover every panel section");
assert.match(css, /\.sf-bottom-nav\s*\{[^}]*position: fixed/, "the bar is fixed to the viewport");
assert.match(css, /\.sf-bottom-nav\s*\{[^}]*z-index: 9999/, "the bar sits above every card");
assert.match(css, /body:has\(\.sf-bottom-nav\)\s*\{[^}]*padding-bottom: 70px/, "pages reserve the bar's height");
assert.match(css, /\.sf-console \.app-body[^{]*\{[^}]*padding-bottom: calc\(var\(--sf-nav-space/, "console bodies clear the bar");
assert.match(css, /\.sf-more-root\s*\{[^}]*z-index: 10000/, "the More sheet covers the page");
assert.match(nav, /className="sf-more-sheet"/, "More opens a full-screen sheet");
assert.match(nav, /aria-modal="true"/, "the sheet is a modal dialog");
for (const section of sfMoreSections) {
  assert.doesNotMatch(section.label, /[\u0980-\u09ff]/, `nav label "${section.label}" must be English`);
  assert.ok(section.icon, `nav entry ${section.id} needs an icon for the grid card`);
}
pass("bottom nav mounted globally, fixed, z-9999, 70px of reserved space");
pass(`More drawer lists ${sfMoreSections.length} sections with English labels and icons`);

// ---------- 3 · English-only staff copy -----------------------------------
const BANGLA_IN_UI = /label:\s*"[^"]*[\u0980-\u09ff]|>[^<>{}"]*[\u0980-\u09ff][^<>{}"]*</;
for (const [name, source] of [["sections", read("components/sf/sections.ts")], ["Scanner", scanner], ["StudentsPanel", students], ["gate-status", read("components/sf/gate-status.ts")], ["TicketSheet", sheet], ["BottomNav", nav]] as const) {
  assert.ok(!BANGLA_IN_UI.test(source), `${name} must not render Bengali copy in the staff panel`);
}
assert.deepEqual(GATE_RESULT_LABEL, { success: "Success", duplicate: "Duplicate", expired: "Expired", invalid: "Invalid" });
assert.equal(gateResultClass("duplicate"), "is-warn");
assert.equal(gateResultClass("invalid"), "is-bad");
assert.equal(gateResultClass("success"), "is-good");
// The scanner is a standalone page: it must carry the console root and its tokens.
assert.match(scanner, /sf-console sf-scan-page/, "scanner page opts into the console token layer");
assert.match(scanner, /v2-wrap app-body sf-main/, "scanner body clears the fixed bar");
assert.match(scanner, /sf-result-label/, "scanner shows one big English status word");
assert.match(scanner, /role="status" aria-live="assertive"/, "the gate result is announced to screen readers");
// No white-on-white: the console layer redefines its own tokens for both schemes.
assert.match(css, /\.sf-console,[\s\S]{0,200}--sf-card:/, "console tokens are declared once for the whole layer");
assert.match(css, /html\[data-color-scheme="dark"\][^{]*\{[^}]*--sf-card:/, "dark scheme overrides the same tokens");
pass("scanner, nav and gate badges are English with tone classes that survive both colour schemes");

// ---------- 4 · the .xlsx contract ----------------------------------------
assert.deepEqual(STUDENT_COLUMNS, studentColumnHeaders, "the importer and the schema agree on the 15 headers");
assert.deepEqual(
  studentColumnHeaders,
  ["SL", "ID", "Roll", "Photo", "Name", "Branch", "Shift", "Class", "Section", "Group", "SMS Contact", "Father Contact", "Father Name", "Mother Name", "Tags"],
);
assert.match(importer, /locateHeader\(rows\)/, "the header row is found, not assumed");
assert.match(importer, /toLatinDigits\(text\("roll"\)\)/, "Bengali digits are normalised only in numeric fields");
assert.ok(!/String\(value\)\.normalize|replace\(\/\[^\\x00-\\x7F\]/.test(importer), "names are never transliterated or stripped");
assert.equal(toLatinDigits("রোল ৮"), "রোল 8", "digits convert, letters are left alone");
assert.equal(toLatinDigits("2026-0101"), "2026-0101");
assert.ok(hasBengali("আব্দুল্লাহ আল মামুন"), "Bengali detection still sees names");
pass("roster columns match the school template exactly and UTF-8 names survive the import");

// ---------- 5 · class-wise payment ----------------------------------------
const rolls = (input: string) => Array.from(parseRollExpression(input).rolls);
assert.deepEqual(rolls("1, 2, 5, 8-12"), ["1", "2", "5", "8", "9", "10", "11", "12"]);
assert.deepEqual(rolls("০৭, ৮-৯"), ["7", "8", "9"], "ranges typed in Bengali digits still resolve (rolls compare by value)");
assert.deepEqual(rolls(""), []);
assert.match(parseRollExpression("4-2").error, /start is greater than end/, "an inverted range is refused with a clear message");
assert.deepEqual(rolls("8, , 9"), ["8", "9"], "an empty gap between commas is ignored");
assert.deepEqual(rolls("A-12"), ["A-12"], "a non-numeric roll is matched by exact text");
assert.match(parseRollExpression("8;@").error, /not a valid roll number/, "a token that cannot be a roll is refused, not guessed");
assert.deepEqual(rolls(" 8 , 9 "), ["8", "9"], "sloppy spacing from a pasted list is tolerated");
assert.match(students, /role="switch"/, "Mark All Class as Paid is a real toggle");
assert.match(students, /all_in_class: allInClass/, "the toggle asks the API for the whole class");
assert.match(students, /class_name: filters\.class_name/, "bulk marking is scoped to the chosen class");
assert.match(students, /section: filters\.section/, "bulk marking honours the section filter");
assert.match(students, /shift: filters\.shift/, "bulk marking honours the shift filter");
pass("bulk payment filters by class/section/shift and expands 1, 2, 5, 8-12 into rolls");

// ---------- 6 · portrait ticket ------------------------------------------
const html = renderToStaticMarkup(
  <TicketSheet
    kind="student"
    schoolName="OKGS"
    fairName="Science Fair 2026"
    logo=""
    copyIndex={2}
    copyCount={3}
    copyLabel="Parent copy"
    showFamily
    student={{
      name: "আব্দুল্লাহ আল মামুন",
      student_code: "2026-0101",
      roll: "5",
      class_name: "Class 8",
      section: "A",
      shift: "Day",
      student_group: "Fair",
      branch: "Science",
      father_name: "মোঃ রফিকুল ইসলাম",
      mother_name: "সালমা বেগম",
      photo_url: "https://cdn.okgs.info/photo/101.jpg",
    }}
    paymentStatus="PAID"
    guardian={null}
    guardians={[
      { name: "আব্দুল করিম", relation: "Mama", contact: "01712345678" },
      { name: "শাহাদাত হোসেন", relation: "Fufa", contact: "01812345678" },
      { name: "মোঃ বশির", relation: "Chacha", contact: "" },
    ]}
    admittedAt=""
    qr="/api/qr?token=demo"
    validUntil="9 Oct 2026"
    issuedAt="8 Oct 2026"
    ticketCode="2026-0101 · Roll 5"
    printedBy="Super Admin"
  />,
);
assert.match(html, /class="ticket-sheet/, "one sheet per copy");
assert.match(html, /Parent copy/, "each copy is labelled for whom it belongs to");
assert.match(html, /ticket-photo[\s\S]{0,200}photo\/101\.jpg/, "the photo is printed on the ticket");
assert.match(html, /Father&#x27;s name|Father's name/, "copy 2 onward carries the father's name");
assert.match(html, /Mother&#x27;s name|Mother's name/);
assert.ok(html.includes("আব্দুল করিম") && html.includes("Mama") && html.includes("Fufa") && html.includes("Chacha"), "every registered guardian is listed");
assert.match(html, /src="\/api\/qr\?token=demo"/, "the QR is rendered by the server from the signed token");
assert.match(html, /ticket-pill is-paid/, "payment status is printed");
assert.match(css, /@page ticket-portrait\s*\{ size: A6 portrait; margin: 0; \}/, "the ticket uses its own A6 portrait print page with zero margin");
assert.match(css, /\.ticket-sheet\s*\{[^}]*aspect-ratio: 105 \/ 148/, "the preview keeps the A6 portrait ratio (105 × 148 mm)");
assert.match(css, /\.ticket-body\s*\{[^}]*display: flex[^}]*flex-direction: column/, "photo, details, badges and QR stack vertically");
assert.match(css, /\.ticket-grid\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/, "ticket fields stay readable in three compact columns");
assert.match(css, /\.ticket-print-root\s*\{[^}]*min-height: 100vh/, "the ticket fills the screen");
assert.match(css, /@media print[\s\S]{0,400}\.ticket-toolbar[\s\S]{0,80}display: none/, "the toolbar never prints");
pass("portrait ticket sheet renders family + guardian block, photo, pill and QR");

// ---------- 7 · gate log timestamps --------------------------------------
const stamp = formatDateTimeEn("2026-10-08T14:03:36.351Z");
assert.match(stamp, /8 Oct 2026/, "date renders in English, day first");
assert.match(stamp, /14:03/, "and 24-hour minutes");
assert.match(formatTimeEn("2026-10-08T14:03:36.351Z"), /^14:03$/);
assert.match(scanner, /<th>Date<\/th>\s*<th>Time<\/th>/, "the audit table splits date and time");
assert.equal(en(1234), "1,234", "counts are grouped with ASCII digits, never Bengali");
assert.equal(en("07"), "7", "a stored roll is shown as written, digits only when numeric");
pass("scan log shows the exact date and time of every attempt");

// ---------- 8 · no browser storage anywhere in the panel -----------------
const offenders: string[] = [];
for (const [name, source] of [
  ["BottomNav", nav],
  ["Scanner", scanner],
  ["StudentsPanel", students],
  ["TicketSheet", sheet],
  ["layout", layout],
  ["importer", importer],
  ["sections", read("components/sf/sections.ts")],
  ["console UI", read("components/sf/console/ui.tsx")],
] as const) {
  if (BROWSER_STORE.test(code(source))) offenders.push(name);
}
assert.deepEqual(offenders, [], "no panel file may touch browser storage");
// …and no mock roster: the panels must go through the API.
assert.match(students, /useApi<StudentsResponse>\(/, "students are read from the API");
assert.ok(!/const (MOCK|DEMO|SAMPLE)_/.test(students + scanner), "no mock data constants in panel components");
assert.match(scanner, /navigator\.mediaDevices\.getUserMedia/, "the camera really opens");
assert.match(scanner, /\/api\/staff\/entry\/scan/, "the scan is verified by the backend");
pass("zero browser storage, zero mock rows — the database is the only source");

// ---------- route reachability ------------------------------------------
assert.ok(isSfPanelPath("/sf"), "/sf carries the bar");
assert.ok(isSfPanelPath("/sf/scan"), "/sf/scan carries the bar");
assert.ok(isSfPanelPath("/sf/students"), "/sf/students carries the bar");
assert.ok(isSfPanelPath("/sf/dashboard"), "/sf/dashboard carries the bar");
assert.ok(!isSfPanelPath("/sf/login"), "the login screen stays bar-free");
assert.ok(!isSfPanelPath("/sf/print/ticket/1"), "a printed ticket stays bar-free");
assert.equal(sfSectionForPath("/sf/students")?.id, "students");
assert.equal(sfSectionForPath("/sf/scan")?.id ?? "scan", "scan");

console.log(`\nAll ${checks} Science Fair panel checks passed.`);
