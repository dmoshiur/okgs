/**
 * Regression checks for the redesigned student ticket module (run by `npm run smoke`).
 *
 * Covers the four things the ticket work is allowed to break silently:
 *   1. language uniformity — a sheet is all-English, all-Bangla or consistently
 *      bilingual, never a mix, and the components hold no copy of their own;
 *   2. the printed artefacts — the single ticket pinned to one A6 portrait
 *      page (105 × 148 mm, QR contained inside the frame), the 3:4 photo
 *      crop, Cloudinary delivery transforms, the A4 portrait 2 × 2 bulk grid
 *      with a break after every four tickets, and the rule that only PAID
 *      students are ever printed;
 *   3. the photo-mapping importer — key matching, error rows, dry runs, and the
 *      real batch write against a throwaway libSQL database;
 *   4. the performance contract — paginated roster, cached client reads, lazy
 *      images and the indexes the roster query depends on.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { TicketSheet } from "../components/sf/print/TicketSheet";
import { TicketCard } from "../components/sf/print/TicketCard";
import { DEFAULT_TICKET_SCHOOL_NAME, parseTicketLang, ticketNumber, ticketSchoolName, ticketText } from "../lib/ticket-locale";
import { parsePhotoCsv, parsePhotoSheet, photoTemplateCsv, isCloudinaryPhoto } from "../lib/photo-import";
import { toBanglaDigits, toLatinDigits } from "../lib/digits";
import { optimizedImage } from "../lib/cloudinary";
import { studentSchema } from "../lib/student-schema";

const read = (path: string) => readFileSync(new URL(path, new URL("../", import.meta.url)), "utf8");
const css = read("app/globals.css");
const bulkCss = read("components/sf/print/ticket-bulk.css");
const sheet = read("components/sf/print/TicketSheet.tsx");
const card = read("components/sf/print/TicketCard.tsx");
const toolbar = read("components/sf/print/TicketToolbar.tsx");
const bulkToolbar = read("components/sf/print/BulkTicketToolbar.tsx");
const bulkPage = read("app/sf/print/tickets/page.tsx");
const bulkApi = read("app/api/staff/students/bulk-print/route.ts");
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
  branch: "Science",
  father_name: "Rafiqul Islam",
  mother_name: "Salma Begum",
  photo_url: "https://res.cloudinary.com/okgs/image/upload/v1730000000/okgs/students/2026-0101.jpg",
};

function renderSheet(lang: "en" | "bn" | "both", studentCode = student.student_code) {
  return renderToStaticMarkup(
    <TicketSheet
      kind="student"
      lang={lang}
      schoolName="Omar Kindergarten School"
      fairName="Science Fair 2026"
      logo="https://res.cloudinary.com/okgs/image/upload/v1/okgs/logo.png"
      copyIndex={1}
      copyCount={1}
      showFamily={false}
      student={{ ...student, student_code: studentCode }}
      paymentStatus="PAID"
      guardian={null}
      guardians={[]}
      admittedAt=""
      qr="data:image/png;base64,QR"
      validUntil={lang === "en" ? "9 October 2026" : "৯ অক্টোবর ২০২৬"}
      issuedAt={lang === "en" ? "9 October 2026" : "৯ অক্টোবর ২০২৬"}
      ticketCode="2026-0101"
      printedBy="Super Admin"
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
assert.match(english, /<dd>5<\/dd>/, "Latin digits on an English sheet");

const numericIdEnglish = renderSheet("en", "202405102");
assert.match(numericIdEnglish, /<dt>Student ID<\/dt><dd>202405102<\/dd>/, "student IDs render as plain text, without thousands separators");
assert.doesNotMatch(numericIdEnglish, /202,405,102/, "an ID is never formatted as a number");
const numericIdBangla = renderSheet("bn", "202405102");
assert.match(numericIdBangla, /<dd>২০২৪০৫১০২<\/dd>/, "Bangla IDs localize digits without adding grouping commas");

const bangla = renderSheet("bn");
for (const label of ["রোল", "শ্রেণি", "শিফট", "শিক্ষার্থী আইডি", "শাখা", "গ্রুপ"]) {
  assert.ok(bangla.includes(label), `Bangla sheet prints the label ${label}`);
}
assert.ok(!/<dt>Roll<\/dt>/.test(bangla) && !/<dt>Class<\/dt>/.test(bangla), "a Bangla sheet has no English label left over");
assert.ok(bangla.includes("<dd>৫</dd>"), "the roll is written in Bangla digits on a Bangla sheet");
assert.match(bangla, /গেটে স্ক্যান করুন/, "even the QR caption is Bangla");
assert.match(bangla, /পরিশোধিত/, "the payment badge is Bangla");

const bilingual = renderSheet("both");
assert.ok(bilingual.includes("রোল") && /<dt>রোল<em>Roll<\/em><\/dt>/.test(bilingual), "bilingual mode prints both words on every field");
assert.ok(bilingual.includes("শ্রেণি") && bilingual.includes("Class"), "…including the class label");

// No hard-coded copy in the components: everything must come from the dictionary.
for (const [name, source] of [
  ["TicketSheet", sheet],
  ["TicketCard", card],
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
  "three copies are student copy, parent copy and another parent copy — never school copy",
);
assert.deepEqual(
  ticketText("bn").titles.copies.map((copy) => copy.primary),
  ["শিক্ষার্থী কপি", "অভিভাবক কপি", "অভিভাবক কপি"],
  "Bangla copy labels match: student copy + two parent copies",
);
assert.equal(
  ticketSchoolName("ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি"),
  DEFAULT_TICKET_SCHOOL_NAME,
  "a Bangla site_name from the database is converted to the English school name on tickets",
);
assert.ok(!BANGLA.test(ticketSchoolName("ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি")), "ticket school name never contains Bangla characters");
const englishWithBanglaDbName = renderToStaticMarkup(
  <TicketSheet
    kind="student"
    lang="en"
    schoolName="ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি"
    fairName="Science Fair 2026"
    logo=""
    copyIndex={3}
    copyCount={3}
    showFamily={false}
    student={student}
    paymentStatus="PAID"
    guardian={null}
    guardians={[]}
    admittedAt=""
    qr="data:image/png;base64,QR"
    validUntil="9 October 2026"
    issuedAt="9 October 2026"
    ticketCode="2026-0101"
    printedBy="Super Admin"
  />,
);
assert.ok(!BANGLA.test(englishWithBanglaDbName), "even when given a Bangla site_name, the rendered English ticket contains zero Bangla characters");
assert.match(englishWithBanglaDbName, /Omar Kindergarten School &amp; Omar Garten Academy/, "the English school name prints on the ticket");
assert.match(englishWithBanglaDbName, /<b>Parent copy<\/b>/, "copy 3 prints as Parent copy, not School copy");
assert.doesNotMatch(englishWithBanglaDbName, /School copy/i, "no School copy label is printed");
pass("a ticket is entirely English, entirely Bangla or consistently bilingual — never mixed");

/* ---------- 2 · the A6 portrait entry-ticket sheet (105 × 148 mm) -------- */
assert.match(css, /@page ticket-portrait\s*\{\s*size: A6 portrait; margin: 0; \}/, "the single ticket prints on its own A6 portrait page with zero page margin");
assert.match(css, /\.ticket-sheet\s*\{[^}]*aspect-ratio: 105 \/ 148/, "the single-ticket preview is a true A6 portrait card");
assert.match(css, /\.ticket-sheet\s*\{[^}]*width: min\(105mm, 100%\)/, "…105mm wide, never wider than its container");
assert.match(css, /\.ticket-sheet\s*\{[^}]*overflow: hidden/, "the sheet clips overflow, so nothing escapes the card border");
assert.match(css, /\.ticket-frame\s*\{[^}]*display: flex[^}]*flex-direction: column/, "the frame stacks head, body and foot in one column");
assert.match(css, /\.ticket-body\s*\{[^}]*display: flex[^}]*flex-direction: column/, "photo, details, badges and QR stack vertically");
assert.match(css, /\.ticket-grid\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/, "the student details sit in a clean 3-column grid");
assert.match(css, /\.ticket-qr\s*\{[^}]*flex: 1 1 auto/, "the QR block absorbs whatever height remains inside the frame");
assert.match(css, /\.ticket-qr img[^{]*\{[^}]*max-width: min\(100%, 32mm\)/, "the QR stays contained inside the card, capped at 32mm");
assert.match(css, /\.ticket-qr-fit\s*\{[^}]*min-height: 6mm/, "…and never collapses below a scannable size");
assert.match(css, /@media print[\s\S]{0,1200}\.ticket-sheet\s*\{[^}]*width: 105mm; height: 148mm/, "print pins every copy to exactly one A6 page — no second page, no spill");
assert.match(css, /\.ticket-photo\s*\{[^}]*aspect-ratio: 3 \/ 4/, "the printed photo is a true 3:4 frame");
assert.match(css, /\.ticket-photo img\s*\{[^}]*object-fit: cover/, "…cropped, never squashed");
assert.match(css, /\.ticket-photo img\s*\{[^}]*object-position: center/, "…and centred on the face");
assert.match(css, /\.ticket-photo\s*\{[^}]*border-radius: 10px/, "…in a rounded frame");
assert.match(css, /\.ticket-sheet\[data-lang="bn"\][^{]*\{[^}]*--font-hind-siliguri/, "Bangla sheets use the Bangla typefaces");
assert.match(english, /ticket-logo/, "the school logo prints");
assert.match(english, /Omar Kindergarten School/, "the school name prints");
assert.match(english, /Science Fair 2026/, "the event title prints");
assert.match(english, /src="data:image\/png;base64,QR"/, "the signed QR prints");
assert.match(english, /ticket-pill is-paid/, "the payment badge prints");
// Cloudinary delivery transform: the sheet asks for a 3:4 600×800 auto-format crop.
assert.ok(
  english.includes("f_auto,q_auto,w_600,h_800,c_fill"),
  "the sheet requests an auto-format 600×800 Cloudinary crop, not the original upload",
);
assert.equal(
  optimizedImage("https://res.cloudinary.com/okgs/image/upload/v1/a.jpg", { width: 300, height: 400, fit: "cover" }),
  "https://res.cloudinary.com/okgs/image/upload/f_auto,q_auto,w_300,h_400,c_fill/v1/a.jpg",
);
pass("photo, crest, event, QR and fee badge all print, and the photo is a Cloudinary 3:4 crop");

/* ---------- 3 · bulk A4 sheet: four tickets per page, PAID only ----------- */
assert.match(bulkCss, /@page ticket-compact\s*\{\s*size: A4 portrait/, "the bulk sheet prints A4 portrait");
assert.match(bulkCss, /\.ticket-bulk-page\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, "two tickets across");
assert.match(bulkCss, /\.ticket-bulk-page\s*\{[^}]*grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)/, "two tickets down");
assert.match(bulkCss, /\.ticket-bulk-page\s*\{[^}]*width: 210mm/, "the page box is real A4");
assert.match(bulkCss, /\.ticket-bulk-page\s*\{[^}]*break-after: page/, "a page break after every page box");
assert.match(bulkCss, /\.ticket-bulk-page\s*\{[^}]*page: ticket-compact/, "…on the named A4 portrait page");
assert.match(bulkCss, /@media print[\s\S]{0,900}\.ticket-bulk-toolbar[\s\S]{0,200}display: none !important/, "the toolbar never reaches the paper");
assert.match(bulkCss, /\.sf-desktop-sidebar[\s\S]{0,120}display: none !important/, "neither does the console sidebar");
assert.match(bulkCss, /\.ticket-card-body\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/, "bulk card photo, details and QR are stacked vertically");
assert.match(bulkCss, /\.ticket-card-photo\s*\{[^}]*height: 29\.33mm/, "the portrait bulk card keeps a 3:4 photo crop");
assert.match(bulkPage, /TICKETS_PER_PAGE = 4/, "the page groups four tickets per sheet");
assert.match(bulkPage, /index \+= TICKETS_PER_PAGE/, "…by chunking the signed list");
assert.match(bulkPage, /paidStudentsForPrint/, "the sheet is built from the PAID-only query");
assert.match(bulkPage, /printableStudentCounts/, "…and reports how many were excluded");
assert.match(studentDb, /studentFilterSql\(\{ \.\.\.filter, payment: "PAID" \}\)/, "the PAID rule is applied in SQL, not in the markup");
assert.match(bulkApi, /if \(!counts\.paid\)/, "the bulk print API refuses a scope with no paid student");
assert.match(bulkApi, /recordTicketPrints/, "a bulk job is written to the print audit log");

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
  photo_url: student.photo_url,
}));
const pages: (typeof cards)[] = [];
for (let index = 0; index < cards.length; index += 4) pages.push(cards.slice(index, index + 4));
assert.equal(pages.length, 2, "five tickets need two A4 pages");
assert.deepEqual(pages.map((page) => page.length), [4, 1], "the first page holds exactly four");
const renderedPages = pages.map(
  (page) =>
    renderToStaticMarkup(
      <>
        {page.map((item, slot) => (
          <TicketCard
            key={item.id}
            schoolName="Omar Kindergarten School"
            fairName="Science Fair 2026"
            logo=""
            lang="en"
            student={item}
            qr="data:image/png;base64,QR"
            ticketCode={item.student_code}
            validUntil="9 Oct 2026"
            slot={`${slot + 1} / 4`}
          />
        ))}
        {Array.from({ length: 4 - page.length }, (_, index) => (
          <div className="ticket-bulk-slot-empty" key={`empty-${index}`} />
        ))}
      </>,
    ),
);
assert.equal((renderedPages[0].match(/ticket-card"/g) ?? []).length, 4, "page one renders four cards");
assert.equal((renderedPages[1].match(/ticket-bulk-slot-empty/g) ?? []).length, 3, "page two keeps its 2 × 2 grid with three empty slots");
assert.match(renderedPages[0], /<dt>Student ID<\/dt><dd>202405102<\/dd>/, "bulk ticket IDs stay plain text");
assert.doesNotMatch(renderedPages[0], /202,405,102/, "bulk ticket IDs never get thousands separators");
assert.ok(renderedPages[0].includes("f_auto,q_auto,w_300,h_400,c_fill"), "card photos use the 300×400 Cloudinary crop");
assert.ok(renderedPages[0].includes("Fee: Paid"), "every card carries the PAID badge");
pass("bulk printing lays out exactly four tickets per A4 page and only prints PAID students");

/* ---------- 4 · photo-mapping spreadsheet --------------------------------- */
const goodSheet = parsePhotoCsv(
  ["student_id,roll,photo_url", "2026-0101,1,https://res.cloudinary.com/okgs/image/upload/v1/okgs/a.jpg", "2026-0102,2,https://res.cloudinary.com/okgs/image/upload/v1/okgs/b.jpg"].join("\n"),
);
assert.equal(goodSheet.entries.length, 2);
assert.deepEqual(goodSheet.entries[0], { key: "2026-0101", match: "code", photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/a.jpg", row: 2 });
assert.equal(goodSheet.nonCloudinary, 0);

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
assert.match(photoTemplateCsv(), /^student_id,roll,photo_url\n2026-0101,1,https:\/\/res\.cloudinary\.com\//, "the template the office downloads has the three columns");
assert.match(photoApi, /dry_run/, "the importer can validate without writing");
assert.match(photoApi, /updateStudentPhotos/, "…and writes through the batch updater");
assert.match(editApi, /photo_url/, "the edit endpoint stores the uploaded Cloudinary URL");
assert.match(editApi, /isPhotoUrl/, "…and refuses anything that is not an http(s) URL");
const editModal = read("components/sf/console/StudentEditModal.tsx");
assert.match(editModal, /uploadToCloudinary/, "the edit modal uploads straight to Cloudinary");
assert.match(editModal, /URL\.createObjectURL\(file\)/, "…and previews the file before the upload finishes");
assert.match(editModal, /payment_status/, "…and can change the payment status that gates bulk printing");
assert.match(studentsPanel, /PhotoImportPanel/, "the roster panel exposes the photo sheet importer");
assert.match(studentsPanel, /bulk-print/, "…and the bulk ticket print job");
pass("the photo sheet is parsed by ID or roll, bad rows are reported, and dry runs write nothing");

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
  const { ensurePortal } = await import("../lib/portal-db");
  const roster = await import("../lib/student-db");
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

  const applied = await roster.updateStudentPhotos([{ key: "2026-0102", match: "code", photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/2.jpg", row: 2 }]);
  assert.deepEqual(applied, { matched: 1, updated: 1, unchanged: 0, missing: [] }, "the photo write reports what it changed");
  assert.equal((await roster.getStudentById(ids[1]))?.photo_url, "https://res.cloudinary.com/okgs/image/upload/v1/okgs/2.jpg");

  const dry = await roster.updateStudentPhotos([{ key: "3", match: "roll", photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/okgs/3.jpg", row: 3 }], { dryRun: true });
  assert.equal(dry.matched, 1, "a dry run still resolves the student…");
  assert.equal((await roster.getStudentById(ids[2]))?.photo_url, "", "…but writes nothing");

  const unmatched = await roster.updateStudentPhotos([{ key: "9999-9999", match: "code", photo_url: "https://res.cloudinary.com/okgs/image/upload/v1/x.jpg", row: 9 }]);
  assert.deepEqual(unmatched.missing, [{ key: "9999-9999", row: 9 }], "an unknown ID is reported, never guessed");

  const edited = await roster.updateStudent(ids[0], { name: "Edited Name", class_name: "Class 8", section: "A" });
  assert.equal(edited?.name, "Edited Name");
  assert.equal(edited?.student_code, "2026-0101", "fields that were not sent are left alone");

  assert.equal(await roster.recordTicketPrints({ fair_slug: "smoke-fair", student_ids: [ids[0], ids[1]], printed_by: "smoke", printed_by_name: "Smoke" }), 2);
  const prints = await roster.ticketPrintSummary("smoke-fair");
  assert.equal(prints.students, 2, "the bulk job lands in the print audit");

  rmSync(dir, { recursive: true, force: true });
  pass("paid-only printing, paging, photo batch writes and the audit log verified against a live database");
}

void (async () => {
  await databaseChecks();
  console.log(`\nAll ${checks} student ticket module checks passed.`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
