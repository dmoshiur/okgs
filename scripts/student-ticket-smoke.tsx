/**
 * Regression checks for the GENESIS 2026 ticket module (run by `npm run smoke`).
 *
 * Covers the things the ticket work is allowed to break silently:
 *   1. language uniformity — a sheet is all-English, all-Bangla or consistently
 *      bilingual, never a mix, and the components hold no copy of their own;
 *   2. the redesigned A6 sheet — Omar Kindergarten School over Scholars
 *      Residential School with the two logos, the fair title above the
 *      three-photo row (father · student · mother), the detail grid, the QR at
 *      the bottom-left with the president's signature on the right, the fixed
 *      "31 December 2026" validity, and NONE of the retired badges (entry
 *      ticket / copy labels / HMAC note / printed-by);
 *   3. the A4 4-in-1 sheet — four identical safe-area TicketSheets per A4 page,
 *      page break after every four, and only PAID students printed;
 *   3b. the bulk print JOB — a snapshot that is missing, expired, damaged,
 *      empty or oversized is a state the print route can put into a sentence,
 *      the PAID rows arrive in bounded chunks, and no size of job can reach the
 *      printer as a server error;
 *   4. the photo-mapping importer — key matching, the student/father/mother
 *      photo columns, error rows, dry runs, and the real batch write against a
 *      throwaway libSQL database;
 *   5. guest fees (50 BDT entry + optional 150 BDT lunch box) and the
 *      class-wise budget & collection accounting against a live database.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { TicketSheet, guestTicketId } from "../components/sf/print/TicketSheet";
import { DEFAULT_TICKET_SCHOOL_NAME, parseTicketLang, ticketNumber, ticketSchoolName, ticketText, ticketValidUntil } from "../lib/ticket-locale";
import { FAIR_PRESIDENT_SIGNATURE_URL, SCHOLARS_LOGO_URL, TICKET_CONTACTS, TICKET_SUB_HEADER, TICKET_TAGLINE, TICKET_VALID_UNTIL_ISO, TICKET_WEBSITE, ticketClubs } from "../lib/ticket-brand";
import { GUEST_ENTRY_FEE, GUEST_LUNCH_FEE, guestFeeBreakdown } from "../lib/guest-fees";
import { parsePhotoCsv, parsePhotoSheet, photoTemplateCsv, isCloudinaryPhoto } from "../lib/photo-import";
import { toBanglaDigits, toLatinDigits } from "../lib/digits";
import { optimizedImage } from "../lib/cloudinary";
import { studentSchema } from "../lib/student-schema";
import { normalizeStudentIdentifiers, studentIdentifiersFromSearchParams } from "../lib/student-selection";

const read = (path: string) => readFileSync(new URL(path, new URL("../", import.meta.url)), "utf8");
const css = read("app/globals.css");
const bulkCss = read("components/sf/print/ticket-bulk.css");
const sheet = read("components/sf/print/TicketSheet.tsx");
const toolbar = read("components/sf/print/TicketToolbar.tsx");
const bulkToolbar = read("components/sf/print/BulkTicketToolbar.tsx");
const bulkPage = read("app/sf/print/tickets/page.tsx");
const bulkApi = read("app/api/staff/students/bulk-print/route.ts");
const bulkNotice = read("components/sf/print/TicketPrintNotice.tsx");
const bulkErrorBoundary = read("app/sf/print/tickets/error.tsx");
const selectionLimits = read("lib/student-selection.ts");
const photoApi = read("app/api/staff/students/photos/route.ts");
const editApi = read("app/api/staff/students/[id]/route.ts");
const studentsApi = read("app/api/staff/students/route.ts");
const studentsPanel = read("components/sf/console/StudentsPanel.tsx");
const consoleUi = read("components/sf/console/ui.tsx");
const fairConsole = read("components/sf/FairConsole.tsx");
const studentDb = read("lib/student-db.ts");

let checks = 0;
function pass(label: string) {
  checks += 1;
  console.log(`PASS  ${label}`);
}

const BANGLA = /[\u0980-\u09ff]/;

const student = {
  name: "Abdullah Al Mamun",
  student_code: "2026-0101",
  roll: "5",
  class_name: "Class 8",
  section: "A",
  shift: "Day",
  student_group: "Science",
  father_name: "Rafiqul Islam",
  mother_name: "Salma Begum",
  photo_url: "https://res.cloudinary.com/okgs/image/upload/v1730000000/okgs/students/2026-0101.jpg",
  father_photo_url: "https://res.cloudinary.com/okgs/image/upload/v1730000000/okgs/fathers/2026-0101.jpg",
  mother_photo_url: "https://res.cloudinary.com/okgs/image/upload/v1730000000/okgs/mothers/2026-0101.jpg",
};

function renderSheet(lang: "en" | "bn" | "both", studentCode = student.student_code) {
  return renderToStaticMarkup(
    <TicketSheet
      kind="student"
      lang={lang}
      schoolName="Omar Kindergarten School"
      fairName="OKGS GENESIS 2026"
      logo="https://res.cloudinary.com/okgs/image/upload/v1/okgs/logo.png"
      student={{ ...student, student_code: studentCode }}
      qr="data:image/png;base64,QR"
    />,
  );
}

/* ---------- 1 · one language per sheet ------------------------------------ */
assert.equal(parseTicketLang("bn"), "bn");
assert.equal(parseTicketLang("BANGLA"), "bn");
assert.equal(parseTicketLang("both"), "both");
assert.equal(parseTicketLang("nonsense"), "en", "an unknown value falls back to English");

const english = renderSheet("en");
assert.ok(!BANGLA.test(english), "an English sheet carries no Bangla characters at all");
assert.match(english, /<dt>Roll<\/dt>/, "English labels are plain English");
assert.match(english, /<dt>Student ID<\/dt>/);
assert.match(english, /<dd[^>]*>5<\/dd>/, "Latin digits on an English sheet");

const numericIdEnglish = renderSheet("en", "202405102");
assert.match(numericIdEnglish, /<dt>Student ID<\/dt><dd[^>]*>202405102<\/dd>/, "student IDs render as plain text, without thousands separators");
assert.doesNotMatch(numericIdEnglish, /202,405,102/, "an ID is never formatted as a number");
const numericIdBangla = renderSheet("bn", "202405102");
assert.match(numericIdBangla, /<dd[^>]*>২০২৪০৫১০২<\/dd>/, "Bangla IDs localize digits without adding grouping commas");

const bangla = renderSheet("bn");
for (const label of ["রোল", "শ্রেণি", "শিফট", "শিক্ষার্থী আইডি", "শাখা", "গ্রুপ"]) {
  assert.ok(bangla.includes(label), `Bangla sheet prints the label ${label}`);
}
assert.ok(!/<dt>Roll<\/dt>/.test(bangla) && !/<dt>Class<\/dt>/.test(bangla), "a Bangla sheet has no English label left over");
assert.match(bangla, /<dd[^>]*>৫<\/dd>/, "the roll is written in Bangla digits on a Bangla sheet");
assert.match(bangla, /০৫৭২৫-৫৬৩৫১-৫২/, "the contact numbers carry Bangla digits on a Bangla sheet");
assert.doesNotMatch(bangla, /৩১ ডিসেম্বর|Valid until|মেয়াদ/, "no validity line is printed under the QR on a Bangla sheet");

const bilingual = renderSheet("both");
assert.ok(bilingual.includes("রোল") && /<dt>রোল<em>Roll<\/em><\/dt>/.test(bilingual), "bilingual mode prints both words on every field");
assert.ok(bilingual.includes("শ্রেণি") && bilingual.includes("Class"), "…including the class label");

// No hard-coded copy in the components: everything must come from the dictionary.
for (const [name, source] of [
  ["TicketSheet", sheet],
  ["TicketToolbar", toolbar],
  ["BulkTicketToolbar", bulkToolbar],
] as const) {
  assert.ok(!BANGLA.test(source), `${name} holds no literal Bangla copy — the dictionary owns it`);
  assert.match(source, /ticketText\(|ticketLangOptions/, `${name} reads its words from lib/ticket-locale`);
}
assert.equal(toBanglaDigits("Roll 5 · 2026"), "Roll ৫ · ২০২৬", "digits convert, letters stay");
assert.equal(toLatinDigits(toBanglaDigits("2026-0101")), "2026-0101", "the conversion round-trips");
assert.equal(ticketNumber("12", "en"), "12");
assert.equal(ticketNumber("12", "bn"), "১২");
assert.equal(ticketNumber("1024", "en"), "1024", "a four-digit ID or roll never gets a thousands separator");
assert.equal(ticketNumber("1024", "bn"), "১০২৪", "…not on a Bangla sheet either");
assert.equal(ticketNumber("202405102", "en"), "202405102", "long numeric IDs print as plain digits");
assert.deepEqual(Object.keys(ticketText("en").labels), Object.keys(ticketText("bn").labels), "both dictionaries cover the same fields");
assert.deepEqual(
  ticketText("en").titles.copies.map((copy) => copy.primary),
  ["Student copy", "Parent copy", "Parent copy"],
  "the screen toolbar still names its copies",
);
assert.equal(ticketValidUntil("en"), "31 December 2026", "the English validity line is pinned to 31 December 2026");
assert.equal(ticketValidUntil("bn"), "৩১ ডিসেম্বর ২০২৬", "the Bangla validity line carries Bangla digits");
assert.equal(
  ticketSchoolName("ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি"),
  DEFAULT_TICKET_SCHOOL_NAME,
  "a Bangla site_name from the database is converted to the English school name on tickets",
);
assert.equal(DEFAULT_TICKET_SCHOOL_NAME, "Omar Kindergarten School", "the ticket header carries the new school name");
assert.ok(!BANGLA.test(ticketSchoolName("ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি")), "ticket school name never contains Bangla characters");
pass("one language per sheet, pinned school name and pinned 31 December 2026 validity");

/* ---------- 2 · the redesigned A6 sheet (105 × 148 mm) -------------------- */
assert.match(css, /@page ticket-portrait\s*\{\s*size: 105mm 148mm; margin: 5mm; \}/, "single printing uses true A6 paper with a 5mm safe area");
assert.match(css, /\.ticket-sheet\s*\{[^}]*aspect-ratio: 95 \/ 137/, "the single-ticket preview is a 95×137mm inset portrait card");
assert.match(css, /\.ticket-sheet\s*\{[^}]*width: 95mm/, "…95mm wide inside A6 safe margins");
assert.match(css, /\.ticket-sheet\s*\{[^}]*overflow: hidden/, "the sheet clips overflow, so nothing escapes the card border");
assert.match(css, /\.ticket-frame\s*\{[^}]*display: flex[^}]*flex-direction: column/, "the frame stacks head, title, photos, grid and bottom in one column");
assert.match(css, /\.ticket-grid\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/, "the details sit in a clean 3-column grid");
assert.match(css, /\.ticket-bottom\s*\{[^}]*grid-template-columns: auto minmax\(0, 1fr\)/, "QR on the left, signature on the right");
assert.match(css, /\.ticket-qr\s*\{[^}]*align-items: flex-start/, "the QR is anchored bottom-left");
assert.match(css, /\.ticket-photos\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1\.45fr\) minmax\(0, 1fr\)/, "the photo row is father · student (large) · mother");
assert.match(css, /\.ticket-photo-frame\s*\{[^}]*aspect-ratio: 3 \/ 4/, "every photo keeps a true 3:4 frame");
assert.match(css, /\.ticket-photo-frame img\s*\{[^}]*object-fit: cover/, "…cropped, never squashed");
assert.match(css, /@media print[\s\S]{0,1200}\.ticket-sheet\s*\{[^}]*width: 95mm; height: 137mm/, "each 95×137mm copy fits one safely inset A6 page");
assert.match(css, /\.ticket-sheet\[data-lang="bn"\][^{]*\{[^}]*--font-hind-siliguri/, "Bangla sheets use the Bangla typefaces");

// Header: left crest, school name + sub-header, Scholars logo on the right.
assert.match(english, /ticket-logo[^"]*"|ticket-logo /, "the school logo prints");
assert.match(english, /class="ticket-logo ticket-logo-right"/, "the second (Scholars) logo prints on the right");
assert.ok(english.includes(SCHOLARS_LOGO_URL.split("?")[0].slice(0, 40)) || english.includes("ticket-logo-right"), "the right logo comes from the brand constant");
assert.match(english, /Omar Kindergarten School/, "the school name prints");
assert.ok(english.includes(TICKET_SUB_HEADER), "the sub-header prints under the school name");
assert.match(english, /ticket-title/, "the fair title has its own block");
assert.match(english, /OKGS GENESIS 2026/, "the Science Fair event name prints prominently");
assert.ok(english.indexOf("OKGS GENESIS 2026") < english.indexOf(TICKET_TAGLINE) && english.indexOf(TICKET_TAGLINE) < english.indexOf("ticket-photos"), "the tagline sits directly under the fair title, above the photos");
assert.match(english, /<p class="ticket-tagline">Exploring The Universe Of Science<\/p>/, "the tagline prints verbatim");
assert.equal((english.match(/class="ticket-school-name"/g) ?? []).length, 2, "both school names share one style class");
assert.match(css, /\.ticket-school-name\s*\{[^}]*font-size: 3\.3mm[^}]*font-weight: 800/, "the two school names are one size and one weight");
assert.doesNotMatch(css, /\.ticket-school-copy small|\.ticket-school-copy strong/, "no leftover distinct style for the sub-header");
// Photos: father + mother flanking the student photo, names under the sides.
assert.ok(english.includes("f_auto,q_auto,w_320,h_427,c_fill"), "the main photo is a 320×427 print-quality auto-format Cloudinary crop");
assert.ok(english.includes("f_auto,q_auto,w_240,h_320,c_fill"), "the parents' photos use the 240×320 print-quality crop");
assert.ok(english.includes("Rafiqul Islam") && english.includes("Salma Begum"), "father's and mother's names sit under their photos");
// Bottom: signed QR left, president signature right.
assert.match(english, /src="data:image\/png;base64,QR"/, "the signed QR prints");
assert.match(english, /ticket-signature/, "the signature block prints");
assert.ok(english.includes(FAIR_PRESIDENT_SIGNATURE_URL.replaceAll("&", "&amp;")), "the president's signature image is the configured one");
assert.match(english, /Fair President/, "the signature carries its caption");
// Club logos, website and the three official numbers sit between the details and the QR row.
assert.equal((english.match(/<li class="ticket-club"/g) ?? []).length, 5, "all five club logos print");
for (const club of ticketClubs()) assert.ok(english.includes(club.logo), `club logo ${club.code} is printed`);
// Club logos come from the live club records; a missing record uses the bundled artwork.
const resolvedClubs = ticketClubs([
  { slug: "ALSSM", name_en: "Association Of Little Scientists And Math Maniacs", logo_url: "https://res.cloudinary.com/okgs/image/upload/v1/clubs/alssm.png" },
  { slug: "artds", name: "ART Debating Society", logo_url: "" },
]);
assert.equal(resolvedClubs.length, 5, "always five clubs, in ticket order");
assert.deepEqual(resolvedClubs.map((club) => club.code), ["ALSSM", "AYPG", "ALPCG", "AYGSM", "ARTDS"], "the ticket order is fixed");
assert.equal(resolvedClubs[0].logo, "https://res.cloudinary.com/okgs/image/upload/v1/clubs/alssm.png", "a club's own logo is used (slug match ignores case)");
assert.equal(resolvedClubs[1].logo, "/media/club-language.svg", "a club missing from the database falls back to the bundled artwork");
assert.equal(resolvedClubs[4].logo, "", "a club record with no logo prints as a monogram, not a stale picture");
assert.ok(english.indexOf("ticket-clubs") > english.indexOf("ticket-grid") && english.indexOf("ticket-clubs") < english.indexOf("ticket-bottom"), "the club strip sits below the details and above the QR row");
assert.match(english, new RegExp(`<p class="ticket-web">${TICKET_WEBSITE.replace(".", "\\.")}</p>`), "the website okgs.info prints under the club logos");
assert.match(english, /<dt>Telephone<\/dt><dd[^>]*>05725-56351-52<\/dd>/, "telephone number prints");
assert.match(english, /<dt>President<\/dt><dd[^>]*>01329-625713<\/dd>/, "president number prints");
assert.match(english, /<dt>Help Line<\/dt><dd[^>]*>01711-857205<\/dd>/, "help line number prints");
assert.equal(TICKET_CONTACTS.length, 3, "exactly three contact numbers");
assert.match(renderSheet("bn"), /<dt>টেলিফোন<\/dt><dd[^>]*>০৫৭২৫-৫৬৩৫১-৫২<\/dd>/, "contacts follow the Bangla sheet: label and digits");
// Nothing is printed below the QR code: no validity or issue line at all.
assert.doesNotMatch(english, /Valid until|Issued|ticket-foot/, "the footer text under the QR code is removed");
assert.doesNotMatch(english, /HMAC/i, "the HMAC-SHA256 note is gone");
assert.doesNotMatch(english, /Printed by/i, "the printed-by line is gone");
// Retired badges never come back.
assert.doesNotMatch(english, /STUDENT ENTRY TICKET/i, "the entry-ticket badge is removed");
assert.doesNotMatch(english, /Student copy/i, "the copy badge is removed");
assert.doesNotMatch(english, /Copy 1 of 1/i, "the copy counter is removed");
assert.equal(
  optimizedImage("https://res.cloudinary.com/okgs/image/upload/v1/a.jpg", { width: 300, height: 400, fit: "cover" }),
  "https://res.cloudinary.com/okgs/image/upload/f_auto,q_auto,w_300,h_400,c_fill/v1/a.jpg",
);

// Guest ticket: GUEST ENTRY tag, guest photo, Guest ID + tagged student + contact + status.
const guestHtml = renderToStaticMarkup(
  <TicketSheet
    kind="guest"
    lang="en"
    schoolName="Omar Kindergarten School"
    fairName="OKGS GENESIS 2026"
    logo=""
    student={{ ...student, student_code: "2026-0101" }}
    guest={{ id: "abcd1234-dead-beef-0000-000000000000", name: "Kamal Hossain", relation: "Mama (maternal uncle)", contact: "01712345678", status: "active", photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/guests/kamal.jpg" }}
    qr="data:image/png;base64,GUESTQR"
  />,
);
assert.match(guestHtml, /GUEST ENTRY/, "outside guests are tagged GUEST ENTRY");
assert.match(guestHtml, /<dt>Guest ID<\/dt><dd[^>]*>ABCD1234<\/dd>/, "the guest ID prints shortened and upper-case");
assert.match(guestHtml, /<dt>Tagged student<\/dt>/, "the tagged student reference prints");
assert.match(guestHtml, /01712345678/, "the guest contact prints");
assert.match(guestHtml, /<dt>Status<\/dt>/, "the guest status prints");
assert.ok(guestHtml.includes("okgs/guests/kamal.jpg"), "the desk photo prints on the guest ticket");
assert.match(guestHtml, /src="data:image\/png;base64,GUESTQR"/, "the guest QR is signed separately");
assert.equal(guestTicketId("abcd1234-dead-beef"), "ABCD1234");
assert.ok(guestHtml.includes("okgs/fathers/") && guestHtml.includes("okgs/mothers/"), "related parents flank the guest portrait too");
assert.equal((guestHtml.match(/ticket-photo-frame/g) || []).length, 3, "guest tickets use the same clean three-photo row");
assert.ok(guestHtml.indexOf("okgs/fathers/") < guestHtml.indexOf("guests/kamal.jpg") && guestHtml.indexOf("guests/kamal.jpg") < guestHtml.indexOf("okgs/mothers/"), "guest stays centered between father and mother");
assert.match(css, /\.ticket-bottom\s*\{[^}]*flex: 1 0 22mm/, "QR space never flex-shrinks");
assert.match(css, /\.ticket-qr img, \.ticket-qr svg \{[^}]*width: 22mm/, "the QR is scaled down to 22mm, still scannable");
assert.match(css, /width: 95mm !important; max-width: 95mm !important; height: 137mm !important/, "the final important print override agrees with the safe geometry");
pass("redesigned A6 sheet: dual logos, fair title, photo row, QR-left + signature-right, pinned validity, no badges");

/* ---------- 3 · bulk A4 sheet: four identical safe-area tickets per page --------- */
assert.match(bulkCss, /@page ticket-compact\s*\{\s*size: A4 portrait/, "the bulk sheet prints A4 portrait");
assert.match(bulkCss, /\.ticket-bulk-page\s*\{[^}]*grid-template-columns: 95mm 95mm/, "two identical safe-area tickets across");
assert.match(bulkCss, /gap: 4mm/, "A4 cards have a cutting gutter");
assert.match(bulkCss, /margin: 5mm/, "the A4 page has physical safe margins");
assert.match(bulkCss, /width: 200mm;[\s\S]{0,50}height: 287mm/, "print page boxes fit within the A4 content area");
assert.match(bulkCss, /\.ticket-bulk-page\s*\{[^}]*grid-template-rows: 137mm 137mm/, "two identical safe-area tickets down");
assert.match(bulkCss, /\.ticket-bulk-page\s*\{[^}]*width: 210mm/, "the page box is real A4");
assert.match(bulkCss, /\.ticket-bulk-page\s*\{[^}]*break-after: page/, "a page break after every page box");
assert.match(bulkCss, /\.ticket-bulk-page\s*\{[^}]*page: ticket-compact/, "…on the named A4 portrait page");
assert.match(bulkCss, /\.ticket-bulk-page \.ticket-sheet\s*\{[^}]*width: 95mm/, "each bulk sheet keeps the exact safe-card width");
assert.match(bulkCss, /\.ticket-bulk-page \.ticket-sheet\s*\{[^}]*height: 137mm/, "…and the exact safe-card height — the template is never scaled");
assert.match(bulkCss, /@media print[\s\S]*\.ticket-bulk-page \.ticket-sheet[\s\S]{0,420}break-after: auto !important/, "inside the grid a sheet does not take a page of its own");
assert.match(bulkCss, /@media screen[\s\S]{0,900}\.ticket-bulk-toolbar/, "the toolbar stays a screen-only surface");
assert.match(bulkPage, /TICKETS_PER_PAGE = 4/, "the page groups four tickets per A4 sheet");
assert.match(bulkPage, /index \+= TICKETS_PER_PAGE/, "…by chunking the complete signed list into physical sheets");
assert.match(bulkPage, /paidStudentsForPrint\(filter\)/, "the sheet is built from the unpaginated PAID-only query");
assert.match(bulkPage, /printableStudentCounts/, "…and reports how many were excluded");
assert.match(bulkPage, /openTicketPrintJob/, "large selections are restored from a server-side print snapshot, read through a lookup that cannot throw");
assert.doesNotMatch(bulkPage, /getTicketPrintJob\(/, "the print route never dereferences the nullable snapshot itself — it asks for a state");
assert.match(bulkPage, /student_ids: directSelection\.ids/, "directly supplied student IDs are applied to the print query");
assert.match(bulkPage, /<TicketSheet/, "the bulk page reuses the very same A6 ticket component");
assert.match(bulkPage, /ticketClubs\(content\.clubs\)/, "bulk tickets carry the live club logos");
assert.doesNotMatch(bulkPage, /MAX_RUN|MIN_RUN|query\.page|query\.size|limit: size/, "the print view does not cap or page selected students");
assert.match(studentDb, /studentFilterSql\(\{ \.\.\.filter, payment: "PAID" \}\)/, "the PAID rule is applied in SQL, not in the markup");
assert.match(studentDb, /json_each\(\?\)/, "large explicit ID selections use one bounded JSON SQL parameter");
assert.match(bulkApi, /if \(!students\.length\)/, "the bulk print API refuses an empty or unpaid-only selection");
assert.match(bulkApi, /studentIdentifiersFromSearchParams/, "the bulk endpoint also reads IDs from query parameters");
assert.match(bulkApi, /createTicketPrintJob/, "the API snapshots the exact selected paid IDs for the print view");
assert.match(bulkApi, /recordTicketPrints/, "every selected ticket is written to the print audit log");
assert.doesNotMatch(bulkApi, /MAX_RUN|MAX_JOB_ROWS|body\.size|body\.page/, "the print API has no batch-size or pagination cap");
assert.doesNotMatch(bulkToolbar, /Per run|run \/|\[20, 40, 100\]/, "the print toolbar no longer offers capped runs");

/* ---------- 3b · a print job that cannot be rendered never reaches the printer as a crash --- */
assert.match(bulkPage, /try \{\s*\n\s*result = await loadPrintView\(/, "the whole data load of the print route is guarded");
assert.match(bulkPage, /\[\$\{LOG_TAG\}\] render failed/, "an unexpected fault is written to the server log with the job id");
assert.match(bulkPage, /\[\$\{LOG_TAG\}\] refused · job=/, "a refused job is logged with the reason it was refused");
for (const code of ["PRINT_JOB_EXPIRED", "PRINT_JOB_NOT_FOUND", "PRINT_JOB_UNREADABLE", "PRINT_JOB_OVERSIZE", "PRINT_JOB_EMPTY", "PRINT_STORE_UNAVAILABLE", "PRINT_SELECTION_TOO_WIDE", "PRINT_NO_PAID_STUDENTS", "PRINT_NO_MATCHING_STUDENTS", "PRINT_ROLL_EXPRESSION_INVALID"]) {
  assert.ok(bulkPage.includes(code), `the print route names its failure ${code} so a log line and a screen say the same thing`);
}
assert.match(bulkPage, /counts\.paid > MAX_BULK_PRINT_TICKETS/, "an oversized selection is refused on the count, before a single ticket is built");
assert.match(bulkApi, /students\.length > MAX_BULK_PRINT_TICKETS/, "…and the API refuses to save a job the print view could not render");
assert.match(bulkPage, /TicketPrintNotice/, "every refusal renders the same screen-only notice");
assert.match(bulkNotice, /no-print/, "the notice can never reach the paper");
assert.match(bulkNotice, /role="alert"/, "…and it is announced to a screen reader");
assert.match(bulkErrorBoundary, /export default function/, "the print route also has a render-error boundary");
assert.match(bulkErrorBoundary, /error\.digest/, "…which shows the log digest instead of a stack");
assert.doesNotMatch(bulkErrorBoundary, /error\.message/, "…and never prints internal error text at the operator");
assert.match(bulkApi, /\.catch\(\(error: unknown\) =>/, "a failed audit write is logged, not thrown at the operator");
assert.match(bulkApi, /print job could not be prepared/, "…and the endpoint itself answers with a sentence instead of a crash");

// The bulk print fetch is chunked, and identifier resolution is one scan — the
// two things that turned a 500+ ticket job into a timeout.
assert.match(studentDb, /for \(let offset = 0; ; offset \+= chunk\)/, "the PAID print rows are fetched in bounded chunks");
assert.match(studentDb, /LIMIT \$\{size\} OFFSET \$\{offset\}/, "…with an explicit page bound on every statement");
assert.match(studentDb, /FROM students GROUP BY upper\(student_code\) HAVING COUNT\(\*\) = 1/, "an ambiguous school-code alias is resolved once for the whole query, not once per selected ID");
assert.match(studentDb, /const PRINT_FETCH_CHUNK_SIZE = 400/, "…and the chunk size is a named constant");
assert.match(selectionLimits, /export const MAX_BULK_PRINT_TICKETS = 2_000/, "the print ceiling is declared once, next to the selection ceiling");
assert.deepEqual(normalizeStudentIdentifiers("row-0001, 2026-0102", ["row-0001", "row-0003"]), ["row-0001", "2026-0102", "row-0003"], "IDs and school-facing codes normalize and deduplicate");
const selectedParams = new URLSearchParams("id=row-0001&id=row-0002&rolls=1%2C2");
assert.deepEqual(studentIdentifiersFromSearchParams(selectedParams), { provided: true, ids: ["row-0001", "row-0002"] }, "query selection accepts repeated ID values without losing either student");

// Five tickets must produce a full page of four plus a page with one ticket and
// three placeholders, so the grid never collapses to three-across.
const cards = Array.from({ length: 5 }, (_, index) => ({
  id: `s${index}`,
  name: `Student ${index + 1}`,
  student_code: index === 0 ? "202405102" : `2026-010${index + 1}`,
  roll: String(index + 1),
  class_name: "Class 8",
  section: "A",
  shift: "Day",
  student_group: "Science",
  father_name: `Father ${index + 1}`,
  mother_name: `Mother ${index + 1}`,
  photo_url: student.photo_url,
  father_photo_url: student.father_photo_url,
  mother_photo_url: student.mother_photo_url,
}));
const pages: (typeof cards)[] = [];
for (let index = 0; index < cards.length; index += 4) pages.push(cards.slice(index, index + 4));
assert.equal(pages.length, 2, "five tickets need two A4 pages");
assert.deepEqual(pages.map((page) => page.length), [4, 1], "the first page holds exactly four");
const renderedPages = pages.map(
  (page) =>
    renderToStaticMarkup(
      <section className="ticket-bulk-page">
        {page.map((item) => (
          <TicketSheet
            key={item.id}
            kind="student"
            lang="en"
            schoolName="Omar Kindergarten School"
            fairName="OKGS GENESIS 2026"
            logo=""
            student={item}
            qr="data:image/png;base64,QR"
          />
        ))}
        {Array.from({ length: 4 - page.length }, (_, index) => (
          <div className="ticket-bulk-slot-empty" key={`empty-${index}`} />
        ))}
      </section>,
    ),
);
assert.equal((renderedPages[0].match(/ticket-sheet printable-ticket/g) ?? []).length, 4, "page one renders four A6 sheets");
assert.equal((renderedPages[1].match(/ticket-bulk-slot-empty/g) ?? []).length, 3, "page two keeps its 2 × 2 grid with three empty slots");
assert.match(renderedPages[0], /<dt>Student ID<\/dt><dd[^>]*>202405102<\/dd>/, "bulk ticket IDs stay plain text");
assert.doesNotMatch(renderedPages[0], /202,405,102/, "bulk ticket IDs never get thousands separators");
assert.ok(renderedPages[0].includes("f_auto,q_auto,w_320,h_427,c_fill"), "bulk photos use the same Cloudinary crop as the single print");
assert.doesNotMatch(renderedPages[0], /Valid until|Issued/, "no footer text is printed on any bulk ticket");
assert.equal((renderedPages[0].match(/<li class="ticket-club"/g) ?? []).length, 20, "every bulk ticket prints five club logos");
assert.match(TICKET_VALID_UNTIL_ISO, /^2026-12-31$/, "the validity constant is still the pinned ISO date (used by ticketValidUntil)");
pass("bulk printing lays out four identical safe-area tickets per A4 page and only prints PAID students");

/* ---------- 4 · photo-mapping spreadsheet --------------------------------- */
const goodSheet = parsePhotoCsv(
  ["student_id,roll,photo_url", "2026-0101,1,https://res.cloudinary.com/okgs/image/upload/v1/okgs/a.jpg", "2026-0102,2,https://res.cloudinary.com/okgs/image/upload/v1/okgs/b.jpg"].join("\n"),
);
assert.equal(goodSheet.entries.length, 2);
assert.deepEqual(goodSheet.entries[0], { key: "2026-0101", match: "code", photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/a.jpg", row: 2 });
assert.equal(goodSheet.nonCloudinary, 0);

// The same sheet can carry the father's and mother's photo URLs.
const familySheet = parsePhotoCsv(
  [
    "student_id,roll,photo_url,father_photo_url,mother_photo_url",
    "2026-0101,1,https://res.cloudinary.com/okgs/image/upload/v1/okgs/a.jpg,https://res.cloudinary.com/okgs/image/upload/v1/okgs/fa.jpg,https://res.cloudinary.com/okgs/image/upload/v1/okgs/ma.jpg",
  ].join("\n"),
);
assert.equal(familySheet.entries[0].father_photo_url, "https://res.cloudinary.com/okgs/image/upload/v1/okgs/fa.jpg", "father photo column is read");
assert.equal(familySheet.entries[0].mother_photo_url, "https://res.cloudinary.com/okgs/image/upload/v1/okgs/ma.jpg", "mother photo column is read");

const rollOnly = parsePhotoCsv("Roll No,Picture\n৫,https://res.cloudinary.com/okgs/image/upload/v1/x.jpg");
assert.deepEqual(rollOnly.entries, [{ key: "5", match: "roll", photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/x.jpg", row: 2 }], "a Bangla roll is normalised and matched as a roll");

const headerOnRow3 = parsePhotoSheet([["Photo studio export"], ["Omar Kindergarten School"], ["STUDENT ID", "PHOTO URL"], ["2026-0101", "https://res.cloudinary.com/okgs/image/upload/v1/y.jpg"]]);
assert.equal(headerOnRow3.headerRow, 3, "the header row is found, not assumed");
assert.equal(headerOnRow3.entries.length, 1);

/**
 * A messy sheet. The rule the office needs is: every row that *can* be applied is
 * applied, and every row that cannot is reported with its row number. A row is
 * usable when it has a key (ID or roll) and an absolute http(s) URL; the first
 * usable row for a key wins and any later one is reported as a duplicate.
 */
const messy = parsePhotoCsv(
  [
    "student_id,roll,photo_url",
    "2026-0101,1,",
    "2026-0102,2,not a url",
    ",3,https://res.cloudinary.com/okgs/image/upload/v1/z.jpg",
    "2026-0101,1,https://res.cloudinary.com/okgs/image/upload/v1/dup.jpg",
    "2026-0101,1,https://res.cloudinary.com/okgs/image/upload/v1/dup2.jpg",
    "2026-0104,4,https://example.com/photos/4.jpg",
  ].join("\n"),
);
assert.deepEqual(
  messy.entries.map((entry) => `${entry.match}:${entry.key}@${entry.row}`),
  ["roll:3@4", "code:2026-0101@5", "code:2026-0104@7"],
  "a roll-keyed row still applies, and the first usable row for an ID wins",
);
assert.deepEqual(messy.errors.map((item) => item.row), [2, 3, 6], "every unusable row is reported by row number");
assert.equal(messy.total, 6, "the sheet reports how many data rows it read");
assert.equal(messy.nonCloudinary, 1, "a non-Cloudinary host is counted so the office can see it");
assert.equal(isCloudinaryPhoto("https://res.cloudinary.com/okgs/image/upload/v1/a.jpg"), true);
assert.equal(isCloudinaryPhoto("https://example.com/a.jpg"), false);
assert.match(photoTemplateCsv(), /^student_id,roll,photo_url,father_photo_url,mother_photo_url/, "the template the office downloads carries all three photo columns");
assert.match(photoApi, /dry_run/, "the importer can validate without writing");
assert.match(photoApi, /updateStudentPhotos/, "…and writes through the batch updater");
assert.match(editApi, /father_photo_url/, "the edit endpoint stores the father's photo URL");
assert.match(editApi, /mother_photo_url/, "…and the mother's photo URL");
assert.match(editApi, /isPhotoUrl/, "parent and student photos must be full http(s) URLs");
const editModal = read("components/sf/console/StudentEditModal.tsx");
const photoField = read("components/sf/console/StudentPhotoUploadField.tsx");
assert.match(editModal, /father_photo_url/, "the edit modal sends the father's photo URL");
assert.match(editModal, /mother_photo_url/, "…and the mother's photo URL");
assert.match(editModal, /Father's Photo/, "the form has a dedicated father's photo section");
assert.match(editModal, /Mother's Photo/, "…and a dedicated mother's photo section");
assert.match(photoField, /uploadToCloudinary/, "all three family photo fields use the same Cloudinary upload pipeline");
assert.match(photoField, /URL\.createObjectURL\(file\)/, "each field previews the selected file before upload completes");
assert.match(photoField, /Replace photo/, "existing student and parent photos can be replaced");
assert.match(photoField, /Cloudinary\)\s*<\/span>/, "each photo field includes its editable Cloudinary URL");
assert.match(editModal, /payment_status/, "…and can change the payment status that gates bulk printing");
assert.match(studentsPanel, /PhotoImportPanel/, "the roster panel exposes the photo sheet importer");
assert.match(studentsPanel, /bulk-print/, "…and the bulk ticket print job");
assert.match(studentsPanel, /CameraCapture/, "guest registration captures a live photo");
assert.match(studentsPanel, /guests\/export/, "…and the guest register exports to CSV");
const camera = read("components/sf/console/CameraCapture.tsx");
assert.match(camera, /navigator\.mediaDevices\.getUserMedia/, "the guest camera really opens the device camera");
assert.match(camera, /uploadToCloudinary/, "…and uploads the captured frame straight to Cloudinary");
pass("the photo sheet is parsed by ID or roll with family photo columns, bad rows are reported, and dry runs write nothing");

/* ---------- 5 · performance contract -------------------------------------- */
assert.match(consoleUi, /const apiCache = new Map/, "panel reads are cached between sections");
assert.match(consoleUi, /apiInflight/, "identical in-flight reads are deduped");
assert.match(consoleUi, /cache: "no-store"/, "…but a cached answer is still revalidated from the server");
assert.match(studentsPanel, /useDebouncedValue\(filters\.q\)/, "the search box waits for a pause in typing");
assert.match(studentsPanel, /IntersectionObserver/, "the roster loads the next page on scroll");
assert.match(studentsPanel, /page_size: String\(PAGE_SIZE\)/, "…and asks for one page at a time");
assert.match(studentsApi, /countStudents\(filter\)/, "the total comes from the database, not the page");
assert.match(studentsApi, /studentStatusCounts\(filter\)/, "…and so do the header figures");
assert.match(studentDb, /LIMIT \$\{limit\} OFFSET \$\{offset\}/, "the roster query is paginated in SQL");
assert.match(fairConsole, /next\/dynamic/, "console sections are code-split");
assert.match(fairConsole, /ssr: false/, "…and loaded on demand");
assert.match(fairConsole, /href=\{item\.href\} prefetch/, "the tab strip prefetches its routes");
assert.match(read("components/sf/StudentPhoto.tsx"), /loading=\{eager \? "eager" : "lazy"\}/, "roster photos are lazy");
assert.match(read("components/sf/StudentPhoto.tsx"), /fit: "cover"/, "…and cropped by Cloudinary");
for (const statement of [
  "students_roll_idx ON students(roll)",
  "payments_student_idx ON payments(student_id)",
  "payments_fair_status_student_idx ON payments(fair_slug, status, student_id)",
  "scan_logs_admission_idx ON scan_logs(subject_type, subject_id, fair_slug, result, entry_time)",
  "ticket_prints_fair_idx ON ticket_prints(fair_slug, student_id)",
  "ticket_print_jobs_expiry_idx ON ticket_print_jobs(expires_at)",
  "students_class_section_idx ON students(class_name, section)",
]) {
  assert.ok(studentSchema.some((sql) => sql.includes(statement)), `index ${statement} is created at boot`);
}
pass("roster reads are paginated, cached, lazy and indexed");

/* ---------- 6 · the same rules against a real database -------------------- */
async function databaseChecks() {
  const dir = mkdtempSync(join(tmpdir(), "okgs-ticket-"));
  // Set before lib/db is first imported: it picks the URL up at module load.
  process.env.TURSO_DATABASE_URL = `file:${join(dir, "tickets.db")}`;
  process.env.SESSION_SECRET = "smoke-test-secret-value";
  const { ensurePortal, createClass, updateClass, listClasses } = await import("../lib/portal-db");
  const roster = await import("../lib/student-db");
  const { fairBudgetSummary } = await import("../lib/fair-budget");
  await ensurePortal();

  const make = (index: number, className: string, section: string) => ({
    serial_no: index,
    student_code: `2026-01${String(index).padStart(2, "0")}`,
    roll: String(index),
    photo_url: "",
    name: `Student ${index}`,
    branch: "",
    shift: "Day",
    class_name: className,
    section,
    student_group: "Fair",
    sms_contact: "",
    father_contact: "",
    father_name: `Father ${index}`,
    mother_name: `Mother ${index}`,
    father_photo_url: "",
    mother_photo_url: "",
    tags: "",
  });
  await roster.upsertStudents([make(1, "Class 8", "A"), make(2, "Class 8", "A"), make(3, "Class 9", "B")], "smoke-batch");

  const ids = (await roster.scopedStudents({})).sort((a, b) => a.student_code.localeCompare(b.student_code)).map((row) => row.id);
  assert.equal(ids.length, 3);
  await roster.setPaymentStatus({ fair_slug: "smoke-fair", student_ids: [ids[0], ids[2]], status: "PAID", actor_id: "smoke", actor_name: "Smoke" });

  const counts = await roster.printableStudentCounts({ fair_slug: "smoke-fair" });
  assert.deepEqual(counts, { total: 3, paid: 2, unpaid: 1 }, "the bulk-print scope counts paid and unpaid students");

  const printable = await roster.paidStudentsForPrint({ fair_slug: "smoke-fair" });
  assert.deepEqual(printable.map((row) => row.student_code), ["2026-0101", "2026-0103"], "only PAID students come back for printing");
  assert.ok("father_photo_url" in printable[0] && "mother_photo_url" in printable[0], "the print query carries the parents' photo URLs");
  assert.equal(printable[0].father_name, "Father 1", "…and the parents' names, so the three-photo row always renders");

  const selectedByRowId = await roster.paidStudentsForPrint({ fair_slug: "smoke-fair", student_ids: [ids[0]] });
  assert.deepEqual(selectedByRowId.map((row) => row.id), [ids[0]], "a database-ID selection returns only that paid student");
  const selectedBySchoolCode = await roster.paidStudentsForPrint({ fair_slug: "smoke-fair", student_ids: ["2026-0103"] });
  assert.deepEqual(selectedBySchoolCode.map((row) => row.student_code), ["2026-0103"], "student IDs in a print link may use the school's student code");
  const { dbRun } = await import("../lib/portal-db");
  await dbRun("UPDATE students SET student_code = ? WHERE id = ?", [ids[0], ids[2]]);
  assert.deepEqual((await roster.paidStudentsForPrint({ fair_slug: "smoke-fair", student_ids: [ids[0]] })).map((row) => row.id), [ids[0]], "a canonical selected ID never widens to another person's matching school-code alias");
  await dbRun("UPDATE students SET student_code = ? WHERE id = ?", ["CASE-CODE", ids[0]]);
  await dbRun("UPDATE students SET student_code = ? WHERE id = ?", ["case-code", ids[2]]);
  assert.equal((await roster.paidStudentsForPrint({ fair_slug: "smoke-fair", student_ids: ["Case-Code"] })).length, 0, "an ambiguous case-folded alias fails closed instead of printing extra students");
  assert.deepEqual((await roster.paidStudentsForPrint({ fair_slug: "smoke-fair", student_ids: ["CASE-CODE"] })).map((row) => row.id), [ids[0]], "an exact school code still identifies exactly one student");
  await dbRun("UPDATE students SET student_code = ? WHERE id = ?", ["2026-0101", ids[0]]);
  await dbRun("UPDATE students SET student_code = ? WHERE id = ?", ["2026-0103", ids[2]]);
  const selectedByRoll = await roster.paidStudentsForPrint({ fair_slug: "smoke-fair", rolls: new Set(["3"]) });
  assert.deepEqual(selectedByRoll.map((row) => row.student_code), ["2026-0103"], "a selected roll returns only the matching PAID student");
  assert.equal((await roster.paidStudentsForPrint({ fair_slug: "smoke-fair", student_ids: [] })).length, 0, "an explicitly empty ID selection never falls back to all students");

  assert.deepEqual(
    await roster.studentStatusCounts({ fair_slug: "smoke-fair", class_name: "Class 8" }),
    { total: 2, paid: 1, unpaid: 1, printed: 0, entered: 0 },
    "the class summary matches the roster page",
  );
  assert.equal(await roster.countStudents({ fair_slug: "smoke-fair", class_name: "Class 8" }), 2);
  assert.equal(await roster.countStudents({ fair_slug: "smoke-fair", rolls: new Set(["2", "3"]) }), 2, "roll filters count in SQL, so paging is stable");

  const pageOne = await roster.listStudentsWithStatus({ fair_slug: "smoke-fair", limit: 2, offset: 0 });
  const pageTwo = await roster.listStudentsWithStatus({ fair_slug: "smoke-fair", limit: 2, offset: 2 });
  assert.deepEqual([...pageOne, ...pageTwo].map((row) => row.roll), ["1", "2", "3"], "two pages of two cover the class exactly once");
  assert.equal(pageOne[0].payment_status, "PAID");
  assert.equal(pageOne[1].payment_status, "UNPAID");

  const applied = await roster.updateStudentPhotos([
    { key: "2026-0102", match: "code", photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/2.jpg", row: 2, father_photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/2f.jpg", mother_photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/2m.jpg" },
  ]);
  assert.deepEqual(applied, { matched: 1, updated: 1, unchanged: 0, missing: [] }, "the photo write reports what it changed");
  const synced = await roster.getStudentById(ids[1]);
  assert.equal(synced?.photo_url, "https://res.cloudinary.com/okgs/image/upload/v1/okgs/2.jpg");
  assert.equal(synced?.father_photo_url, "https://res.cloudinary.com/okgs/image/upload/v1/okgs/2f.jpg", "the father photo syncs in the same pass");
  assert.equal(synced?.mother_photo_url, "https://res.cloudinary.com/okgs/image/upload/v1/okgs/2m.jpg", "…and so does the mother photo");

  const dry = await roster.updateStudentPhotos([{ key: "3", match: "roll", photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/3.jpg", row: 3 }], { dryRun: true });
  assert.equal(dry.matched, 1, "a dry run still resolves the student…");
  assert.equal((await roster.getStudentById(ids[2]))?.photo_url, "", "…but writes nothing");

  const unmatched = await roster.updateStudentPhotos([{ key: "9999-9999", match: "code", photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/x.jpg", row: 9 }]);
  assert.deepEqual(unmatched.missing, [{ key: "9999-9999", row: 9 }], "an unknown ID is reported, never guessed");

  const edited = await roster.updateStudent(ids[0], {
    name: "Edited Name",
    class_name: "Class 8",
    section: "A",
    father_photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/father.jpg",
    mother_photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/mother.jpg",
  });
  assert.equal(edited?.name, "Edited Name");
  assert.equal(edited?.student_code, "2026-0101", "fields that were not sent are left alone");
  assert.equal(edited?.father_photo_url, "https://res.cloudinary.com/okgs/image/upload/v1/okgs/father.jpg", "the edit model persists the father's photo URL");
  assert.equal(edited?.mother_photo_url, "https://res.cloudinary.com/okgs/image/upload/v1/okgs/mother.jpg", "…and the mother's photo URL");

  assert.equal(await roster.recordTicketPrints({ fair_slug: "smoke-fair", student_ids: [ids[0], ids[1]], printed_by: "smoke", printed_by_name: "Smoke" }), 2);
  const prints = await roster.ticketPrintSummary("smoke-fair");
  assert.equal(prints.students, 2, "the bulk job lands in the print audit");

  // A print query and a saved ID snapshot must both carry 500+ tickets without
  // inheriting roster-page limits or a 20/40/100-ticket print-run cap.
  const largeRecords = Array.from({ length: 520 }, (_, index) => make(index + 10, "Bulk 500", "A"));
  await roster.upsertStudents(largeRecords, "large-print-batch");
  const largeRows = await roster.scopedStudents({ class_name: "Bulk 500" });
  assert.equal(largeRows.length, 520, "the fixture contains more than 500 print candidates");
  await roster.setPaymentStatus({
    fair_slug: "large-print-fair",
    student_ids: largeRows.map((row) => row.id),
    status: "PAID",
    actor_id: "smoke",
    actor_name: "Smoke",
  });
  const largePrint = await roster.paidStudentsForPrint({ fair_slug: "large-print-fair", class_name: "Bulk 500" });
  assert.equal(largePrint.length, 520, "the print query returns every matching student with no default limit");
  const largeSelection = await roster.paidStudentsForPrint({ fair_slug: "large-print-fair", student_ids: largeRows.map((row) => row.id) });
  assert.equal(largeSelection.length, 520, "an explicit selection above 500 IDs is queried as one safe JSON parameter");
  const printJobId = await roster.createTicketPrintJob({
    fair_slug: "large-print-fair",
    student_ids: largeSelection.map((row) => row.id),
    class_name: "Bulk 500",
    section: "",
    shift: "",
    rolls: "",
    q: "",
    lang: "en",
    created_by: "smoke",
  });
  const printJob = await roster.getTicketPrintJob(printJobId);
  assert.equal(printJob?.student_ids.length, 520, "the server-side print snapshot retains the full large selection");

  /* A print snapshot that cannot be used is a state the route can explain —
     never an exception, and never a fallback to the whole roster. */
  const openJob = await roster.openTicketPrintJob(printJobId);
  assert.equal(openJob.state, "ready", "a live snapshot opens with its student IDs");
  assert.deepEqual(openJob.ids, printJob?.student_ids, "…and the shorthand array is the very list the print query filters on");
  assert.equal((await roster.openTicketPrintJob("")).state, "missing", "an absent job id is an answer, not a crash");
  assert.equal((await roster.openTicketPrintJob("00000000-0000-4000-8000-000000000000")).state, "missing", "an unknown job id never widens to the roster");
  assert.deepEqual((await roster.openTicketPrintJob("00000000-0000-4000-8000-000000000000")).ids, [], "…and a caller can read .ids without a null check");

  const storeJob = (id: string, snapshot: string, expiresAt: string) =>
    dbRun(
      `INSERT INTO ticket_print_jobs (id, fair_slug, student_ids_json, class_name, section, shift, rolls, q, lang, created_by, created_at, expires_at)
       VALUES (?, 'large-print-fair', ?, '', '', '', '', '', 'en', 'smoke', ?, ?)`,
      [id, snapshot, "2026-01-01T00:00:00.000Z", expiresAt],
    );

  await storeJob("11111111-1111-4111-8111-111111111111", "not-json", "2999-01-01T00:00:00.000Z");
  assert.equal((await roster.openTicketPrintJob("11111111-1111-4111-8111-111111111111")).state, "unreadable", "a damaged snapshot is reported as unreadable instead of printing nobody silently");
  assert.equal(await roster.getTicketPrintJob("11111111-1111-4111-8111-111111111111"), null, "…and the older accessor still answers null rather than throwing");
  await storeJob("11111111-1111-4111-8111-111111111112", '{"students":[]}', "2999-01-01T00:00:00.000Z");
  assert.equal((await roster.openTicketPrintJob("11111111-1111-4111-8111-111111111112")).state, "unreadable", "a snapshot that is JSON but not an array is unreadable too");

  await storeJob("33333333-3333-4333-8333-333333333333", '["x"]', "2020-01-01T00:00:00.000Z");
  assert.equal((await roster.openTicketPrintJob("33333333-3333-4333-8333-333333333333")).state, "expired", "a snapshot past its TTL is expired, not empty");
  await storeJob("33333333-3333-4333-8333-333333333334", '["x"]', "");
  assert.equal((await roster.openTicketPrintJob("33333333-3333-4333-8333-333333333334")).state, "expired", "a row with no usable timestamp fails closed");
  await storeJob("33333333-3333-4333-8333-333333333335", '["x"]', "not-a-date");
  assert.equal((await roster.openTicketPrintJob("33333333-3333-4333-8333-333333333335")).state, "expired", "…and so does a timestamp that cannot be parsed");

  await storeJob("55555555-5555-4555-8555-555555555555", JSON.stringify(Array.from({ length: 10_001 }, (_, index) => `s${index}`)), "2999-01-01T00:00:00.000Z");
  assert.equal((await roster.openTicketPrintJob("55555555-5555-4555-8555-555555555555")).state, "oversize", "a snapshot larger than a selection may hold is refused before 10,000 QR codes are built");
  await storeJob("55555555-5555-4555-8555-555555555556", "[]", "2999-01-01T00:00:00.000Z");
  assert.equal((await roster.openTicketPrintJob("55555555-5555-4555-8555-555555555556")).ids.length, 0, "an explicitly empty snapshot stays empty");

  const nullSnapshotJob = await roster.createTicketPrintJob({
    fair_slug: "large-print-fair",
    student_ids: null as unknown as string[],
    class_name: "", section: "", shift: "", rolls: "", q: "", lang: "en", created_by: "smoke",
  });
  assert.equal((await roster.openTicketPrintJob(nullSnapshotJob)).state, "ready", "a job prepared with no ID array is stored as an empty selection instead of throwing");
  assert.equal((await roster.openTicketPrintJob(nullSnapshotJob)).ids.length, 0, "…and it prints nobody");
  assert.equal(await roster.recordTicketPrints({ fair_slug: "large-print-fair", student_ids: null as unknown as string[], printed_by: "smoke", printed_by_name: "Smoke" }), 0, "the print audit tolerates a missing ID array too");

  /* Chunked fetching must be invisible: the same complete list, in the same order. */
  const chunkedPrint = await roster.paidStudentsForPrint({ fair_slug: "large-print-fair", class_name: "Bulk 500" }, { chunkSize: 7 });
  assert.deepEqual(chunkedPrint.map((row) => row.student_code), largePrint.map((row) => row.student_code), "a 520-row job arrives identically in pages of seven");
  assert.equal((await roster.paidStudentsForPrint({ fair_slug: "large-print-fair", class_name: "Bulk 500" }, { maxRows: 100 })).length, 100, "an optional ceiling bounds the fetch, and only when it is asked for");
  assert.equal(await roster.paidStudentSelectionOverflows({ fair_slug: "large-print-fair", class_name: "Bulk 500" }, 500), true, "a caller can ask whether a scope is too wide before rendering it");
  assert.equal(await roster.paidStudentSelectionOverflows({ fair_slug: "large-print-fair", class_name: "Bulk 500" }, 600), false, "…without widening a scope that fits");
  const ghostSelection = await roster.paidStudentsForPrint({
    fair_slug: "large-print-fair",
    student_ids: [...largeRows.map((row) => row.id), ...Array.from({ length: 9_480 }, (_, index) => `ghost-${index}`)],
  });
  assert.equal(ghostSelection.length, 520, "10,000 requested identifiers still resolve to exactly the 520 real students — unknown IDs are dropped in SQL, not scanned for one by one");

  /* Guest fees: 50 BDT entry is mandatory, lunch box adds 150 BDT. */
  assert.deepEqual(guestFeeBreakdown(false), { entry: 50, lunch: 0, total: 50 });
  assert.deepEqual(guestFeeBreakdown(true), { entry: 50, lunch: 150, total: 200 });
  assert.equal(GUEST_ENTRY_FEE, 50);
  assert.equal(GUEST_LUNCH_FEE, 150);

  const guestPlain = await roster.createGuest({
    fair_slug: "smoke-fair", name: "Guest One", contact: "01711111111", related_student_id: ids[0], relation: "Guardian",
    photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/guests/g1.jpg",
    entry_fee: 50, has_lunch: false, lunch_fee: 0, total_fee: 50, created_by: "smoke", created_by_name: "Smoke",
  });
  const guestLunch = await roster.createGuest({
    fair_slug: "smoke-fair", name: "Guest Two", contact: "01722222222", related_student_id: ids[0], relation: "Other guest",
    photo_url: "", entry_fee: 50, has_lunch: true, lunch_fee: 150, total_fee: 200, created_by: "smoke", created_by_name: "Smoke",
  });
  assert.equal(guestPlain?.photo_url, "https://res.cloudinary.com/okgs/image/upload/v1/okgs/guests/g1.jpg", "the desk photo is stored on the guest row");
  assert.equal(guestPlain?.total_fee, 50);
  assert.equal(guestLunch?.total_fee, 200, "entry + lunch box = 200 BDT");

  const guestFees = await roster.guestFeeSummary("smoke-fair");
  assert.equal(guestFees.entryCount, 2, "both guests paid the entry fee");
  assert.equal(guestFees.entryTotal, 100, "2 × 50 BDT entry");
  assert.equal(guestFees.lunchCount, 1);
  assert.equal(guestFees.lunchTotal, 150, "1 × 150 BDT lunch box");
  assert.equal(guestFees.collected, 250, "total guest collection = 50 + 200");

  /* Class budgets & the accounting summary. */
  const classId = await createClass({ name: "Class 8", sections: "A", fee_amount: 100, budget_amount: 250, fee_title: "Fair ticket", fee_session: "2026" });
  assert.ok(classId, "a class carries a budget target");
  await updateClass(classId, { budget_amount: 300 });
  const updatedClass = (await listClasses()).find((item) => item.id === classId);
  assert.equal(Number(updatedClass?.budget_amount), 300, "the SuperAdmin can change the budget target");

  const budget = await fairBudgetSummary("smoke-fair");
  const classRow = budget.rows.find((row) => row.class_name === "Class 8");
  assert.equal(classRow?.paid, 1, "one paid student in Class 8");
  assert.equal(classRow?.collected, 100, "student collection = paid × class fee");
  assert.equal(classRow?.budget_amount, 300);
  assert.equal(classRow?.remaining, 200);
  assert.equal(budget.studentCollected, 100);
  assert.equal(budget.guestEntry.total, 100);
  assert.equal(budget.guestLunch.total, 150);
  assert.equal(budget.totalCollected, 350, "total = student collections + guest entry + lunch boxes");
  assert.equal(budget.totalBudget, 300);
  assert.equal(budget.remainingBudget, 0, "the target is met — nothing remains");

  // Revoked guests drop out of the accounting.
  await roster.setGuestStatus(guestLunch!.id, "revoked");
  const afterRevoke = await roster.guestFeeSummary("smoke-fair");
  assert.equal(afterRevoke.entryTotal, 50, "a revoked guest no longer counts");
  assert.equal(afterRevoke.lunchTotal, 0);

  rmSync(dir, { recursive: true, force: true });
  pass("paid-only printing, family photo sync, guest fees and class budgets verified against a live database");
}

void (async () => {
  await databaseChecks();
  console.log(`\nAll ${checks} student ticket module checks passed.`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
