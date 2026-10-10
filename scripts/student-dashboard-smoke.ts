/**
 * Student dashboard regression checks — isolated database, never the deployment DB.
 *
 *   - money: "মোট জমা" and "বাকি পাওনা" come from verified receipts, live
 *   - pending receipts are never counted as paid, and one receipt is never counted twice
 *   - QR passes are issued by the system on PAID, once, and only to students with an account
 *   - the notices feed: categories, urgency, read state, and safe rich text
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "okgs-student-"));
  process.env.TURSO_DATABASE_URL = `file:${join(directory, "test.db")}`;
  delete process.env.TURSO_AUTH_TOKEN;
  process.env.SESSION_SECRET = "student-dashboard-test-secret-not-for-production";
  process.env.NEXT_PUBLIC_SITE_URL = "https://school.example";

  const { db } = await import("../lib/db");
  const { ensurePortal, createUser, createDue, createFund, listStudentDues, listStudentFunds, studentVerifiedTotal, listPasses, markAnnouncementsRead, listReadAnnouncementKeys } = await import("../lib/portal-db");
  const { upsertStudents, getStudentByCode, setPaymentStatus } = await import("../lib/student-db");
  const { issuePassesForStudentIds, ensureMainPass, paidStudentCodes } = await import("../lib/student-pass");
  const { announcementCategory, announcementKey } = await import("../lib/announcement-category");
  const { makePassToken } = await import("../lib/qr");
  const { RichText, plainPreview } = await import("../components/portal/RichText");
  const fair = "science-fair-test";

  try {
    await ensurePortal();

    /* ---------- roster + two accounts ---------- */
    const roster = (code: string, name: string, roll: string) => ({
      student_code: code, name, serial_no: Number(roll), roll, photo_url: "", branch: "Main", shift: "Morning",
      class_name: "Class 8", section: "A", student_group: "Science", sms_contact: "", father_contact: "", father_name: "",
      mother_name: "", father_photo_url: "", mother_photo_url: "", tags: "",
    });
    await upsertStudents([roster("2024001", "Rahim Uddin", "1"), roster("2024002", "Karim Hossain", "2")], "test");
    const rahim = await createUser({ name: "Rahim Uddin", role: "student", student_id: "2024001", email: "rahim@example.com", phone: "01711111111", password_hash: "x", password_salt: "y" });
    const noAccountCode = "2024002"; // roster row exists, portal account does not

    /* ---------- money ---------- */
    const fee = await createDue({ fair_slug: fair, user_id: rahim.id, student_name: rahim.name, student_id: "2024001", title: "মেলা ফি", amount: 1000, status: "due" });
    const classFee = await createDue({ fair_slug: fair, user_id: "", student_name: rahim.name, student_id: "2024001", title: "ক্লাস ফি", amount: 200, status: "due" });
    // A verified receipt linked to the due AND the account (the usual online path).
    await createFund({ fair_slug: fair, user_id: rahim.id, due_id: fee, payer_name: rahim.name, student_id: "2024001", amount: 400, status: "verified", purpose: "মেলা ফি" });
    // Office cash recorded only against the school ID (no account link) — must still count.
    await createFund({ fair_slug: fair, user_id: "", payer_name: rahim.name, student_id: "2024001", amount: 150, status: "verified", purpose: "ক্লাস ফান্ড" });
    // Still waiting for the teacher — must not count as paid.
    await createFund({ fair_slug: fair, user_id: rahim.id, due_id: fee, payer_name: rahim.name, student_id: "2024001", amount: 300, status: "pending", purpose: "মেলা ফি" });
    // Rejected — counts for nothing.
    await createFund({ fair_slug: fair, user_id: rahim.id, payer_name: rahim.name, student_id: "2024001", amount: 90, status: "rejected", purpose: "অনুদান" });

    const dues = await listStudentDues(rahim.id, "2024001");
    const feeRow = dues.find((row) => row.id === fee)!;
    const classRow = dues.find((row) => row.id === classFee)!;
    assert.equal(Number(feeRow.paid_amount), 400, "the due's paid amount is the live sum of verified receipts, not the stale cache");
    assert.equal(Number(feeRow.pending_amount), 300, "pending receipts are reported as awaiting verification");
    assert.equal(feeRow.status, "partial");
    assert.equal(Number(classRow.paid_amount), 0);
    assert.equal(classRow.status, "due", "a due linked only by school ID is still the student's");

    const contributed = await studentVerifiedTotal(rahim.id, "2024001");
    assert.equal(contributed, 550, "verified money only: 400 (linked) + 150 (ID only); pending and rejected excluded");
    const outstanding = dues.reduce((sum, due) => sum + Math.max(0, Number(due.amount) - Number(due.paid_amount)), 0);
    assert.equal(outstanding, 800, "due balance: 1000−400 + 200−0");
    assert.equal(await studentVerifiedTotal("someone-else", "2099999"), 0, "a different student sees none of these receipts");
    assert.equal((await listStudentFunds(rahim.id, "2024001")).length, 4, "history lists every receipt, whatever its status");
    console.log("PASS live dues and totals: verified receipts only, no double count, pending excluded, ID-only receipts included");

    // Verifying the pending receipt changes the balance right away, with no manual re-sync.
    const pendingRow = (await listStudentFunds(rahim.id, "2024001")).find((row) => row.status === "pending")!;
    await db.execute({ sql: `UPDATE funds SET status = 'verified' WHERE id = ?`, args: [pendingRow.id] });
    const after = (await listStudentDues(rahim.id, "2024001")).find((row) => row.id === fee)!;
    assert.equal(Number(after.paid_amount), 700);
    assert.equal(Number(after.pending_amount), 0);
    assert.equal(await studentVerifiedTotal(rahim.id, "2024001"), 850);
    console.log("PASS a verified receipt is reflected in the student's totals immediately");

    /* ---------- passes issued by the system on PAID ---------- */
    const rahimRoster = await getStudentByCode("2024001");
    const karimRoster = await getStudentByCode(noAccountCode);
    assert.ok(rahimRoster && karimRoster);
    assert.deepEqual(await listPasses({ user_id: rahim.id }), [], "a student holds no pass before payment");

    await setPaymentStatus({ fair_slug: fair, student_ids: [rahimRoster.id, karimRoster.id], status: "PAID", actor_id: "office", actor_name: "Office" });
    const first = await issuePassesForStudentIds([rahimRoster.id, karimRoster.id], fair);
    assert.deepEqual(first, { issued: 1, skipped: 1 }, "one pass for the student with an account; the account-less student is skipped");
    const passes = await listPasses({ user_id: rahim.id });
    assert.equal(passes.length, 1);
    assert.equal(passes[0].status, "active");
    assert.equal(passes[0].token, makePassToken(passes[0].id), "the token is the signed token of this pass");
    assert.equal(passes[0].holder_name, rahim.name);

    const second = await issuePassesForStudentIds([rahimRoster.id, karimRoster.id], fair);
    assert.equal(second.issued, 0, "re-running issuance never creates a second pass");
    assert.equal((await listPasses({ user_id: rahim.id })).length, 1);
    const again = await ensureMainPass({ ...rahim }, fair);
    assert.equal(again.created, false);
    assert.equal(again.pass.id, passes[0].id);
    assert.ok((await paidStudentCodes(fair)).includes("2024001"));
    console.log("PASS QR pass is issued automatically on PAID, once, and only for students with an account");

    /* ---------- notices: read state, categories, rich text ---------- */
    const key = announcementKey("notice", "n-123");
    assert.equal(await markAnnouncementsRead(rahim.id, [key, "bad key!", "javascript:alert(1)"]), 1, "malformed keys are ignored");
    await markAnnouncementsRead(rahim.id, [key]);
    assert.ok((await listReadAnnouncementKeys(rahim.id)).has(key));
    assert.ok(!(await listReadAnnouncementKeys("other-user")).has(key), "read state belongs to one person");
    console.log("PASS read state is stored per person and idempotent");

    assert.deepEqual(
      [announcementCategory("notice", { type: "জরুরি" }).urgent, announcementCategory("notice", { type: "জরুরি" }).category],
      [true, "notice"],
    );
    assert.equal(announcementCategory("news", { category: "বিজ্ঞান মেলা" }).category, "science_fair");
    assert.equal(announcementCategory("news", { category: "ক্যাম্পাস" }).category, "update");
    assert.equal(announcementCategory("update", { kind: "বিজ্ঞান" }).category, "science_fair");
    assert.equal(announcementCategory("ticker", { kind: "notice", fair_slug: "x" }).category, "notice");
    assert.equal(announcementCategory("ticker", { kind: "result", fair_slug: "x" }).category, "science_fair");
    assert.equal(announcementCategory("ticker", { kind: "urgent" }).urgent, true);
    console.log("PASS notices are categorised as Science Fair, Notice or Update, with urgency");

    const html = renderToStaticMarkup(
      createElement(RichText, {
        source: "**গুরুত্বপূর্ণ** তথ্য\n- প্রথম বিষয়\n- দ্বিতীয় *বিষয়*\n\n[ফর্ম](https://school.example/form) দেখুন https://school.example/x.\n\n[ক্ষতিকর](javascript:alert(1)) <img src=x onerror=alert(1)>",
      }),
    );
    assert.match(html, /<strong>গুরুত্বপূর্ণ<\/strong>/);
    assert.match(html, /<ul>/);
    assert.match(html, /<em>বিষয়<\/em>/);
    assert.match(html, /href="https:\/\/school\.example\/form"/);
    assert.match(html, /href="https:\/\/school\.example\/x"/, "trailing punctuation is not part of the link");
    assert.ok(!/href="javascript:/i.test(html), "javascript: links are never rendered as links");
    assert.ok(!/<img/i.test(html), "raw HTML in a notice is shown as text, never as markup");
    assert.match(html, /&lt;img/, "raw HTML is escaped");
    assert.equal(plainPreview("**বোল্ড** [লিংক](https://a.example) ক"), "বোল্ড লিংক ক");
    console.log("PASS rich text: formatting and safe links; raw HTML is escaped");

    console.log("\nAll student dashboard checks passed.");
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
