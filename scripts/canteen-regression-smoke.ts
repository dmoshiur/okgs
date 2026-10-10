/** Real-database canteen regressions. Isolated legacy DB; no deployment data or external services. */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { studentSchema } from "../lib/student-schema";
import { extractScanValue, isScanQr, isTicketQr } from "../lib/scan-input";
import { dhakaDayStartIso, formatSchoolTime, nextSchoolDayIso, schoolDayKey } from "../lib/school-time";
import { LUNCH_ALREADY_CLAIMED, LUNCH_NO_PURCHASE } from "../lib/scan-types";
import type { StudentImportRecord } from "../lib/student-db";

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "okgs-canteen-"));
  const url = `file:${join(directory, "legacy.db")}`;
  process.env.TURSO_DATABASE_URL = url;
  delete process.env.TURSO_AUTH_TOKEN;
  process.env.SESSION_SECRET = "canteen-regression-secret-not-for-production";
  const legacy = createClient({ url });
  await legacy.execute(studentSchema[0]
    .replace("    father_photo_url TEXT NOT NULL DEFAULT '',\n", "")
    .replace("    mother_photo_url TEXT NOT NULL DEFAULT '',\n", ""));
  await legacy.execute("INSERT INTO students (id, student_code, name) VALUES ('legacy-student', 'LEGACY-1', 'Existing student')");
  legacy.close();

  const { db, insertRow } = await import("../lib/db");
  const portal = await import("../lib/portal-db");
  const roster = await import("../lib/student-db");
  const { processLunchScan } = await import("../lib/lunch-scan");
  const { getLunchState, lunchScanSummary, listLunchScans } = await import("../lib/lunch-db");
  const { processEntry } = await import("../lib/entry-scan");
  const { makeTicketToken, parseTicketToken } = await import("../lib/ticket-token");
  const { makePassToken, makeEntryToken } = await import("../lib/qr");
  const { readScanRequest, ScanRequestError } = await import("../lib/scan-request");
  const beforeMidnight = new Date("2026-10-10T17:59:59.000Z");
  const afterMidnight = new Date("2026-10-10T18:00:00.000Z");
  const fair = "canteen-regression";
  const otherFair = "canteen-other-fair";
  const actor = { actor_id: "canteen-operator", actor_name: "Canteen operator" };
  const expires = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  const tokenFor = (id: string, kind: "s" | "g" = "s", slug = fair, expiry = expires) => makeTicketToken({ k: kind, i: id, f: slug, e: expiry });
  const scan = (token: string, action: "check" | "claim" = "claim", now = beforeMidnight, slug = fair) =>
    processLunchScan({ ...actor, token, fair_slug: slug, method: "qr", action }, now);
  const countClaims = async () => Number((await db.execute("SELECT COUNT(*) AS n FROM lunch_claims")).rows[0].n);
  try {
    await portal.ensurePortal();
    const columns = (await db.execute("PRAGMA table_info(students)")).rows.map((row) => row.name);
    assert.ok(columns.includes("father_photo_url") && columns.includes("mother_photo_url"));
    assert.equal((await roster.getStudentByCode("LEGACY-1"))?.name, "Existing student");
    assert.equal(await countClaims(), 0, "migration must not invent claims or seed entitlements");
    console.log("PASS additive migration preserves legacy students, adds parent photo columns and creates empty claim/audit tables");

    for (const slug of [fair, otherFair]) await insertRow("fairs", { slug, name: slug, starts_on: "2026-10-10", ends_on: "2026-10-18", is_active: 1 });
    const records: StudentImportRecord[] = Array.from({ length: 5 }, (_, i) => ({
      serial_no: i + 1, student_code: `LUNCH-${i + 1}`, name: `Student ${i + 1}`, roll: String(i + 1),
      class_name: "Class 8", section: "A", shift: "Day", branch: "Main", student_group: "Science",
      photo_url: "", father_name: "Father", mother_name: "Mother", father_photo_url: "", mother_photo_url: "",
      sms_contact: "", father_contact: "", tags: "",
    }));
    await roster.upsertStudents(records, "canteen-test");
    const students = await Promise.all(records.map(async (r) => (await roster.getStudentByCode(r.student_code))!));
    await roster.setPaymentStatus({ ...actor, fair_slug: fair, student_ids: students.slice(0, 4).map((s) => s.id), status: "PAID" });
    const paid = students[0];
    const token = tokenFor(paid.id);
    const check = await scan(token, "check");
    assert.equal(check.result, "ready");
    assert.equal(check.lunch.eligible, true);
    assert.equal(check.lunch.claimed_today, false);
    assert.equal(await countClaims(), 0);
    const first = await scan(token);
    assert.equal(first.result, "success");
    assert.equal(first.claim_time, beforeMidnight.toISOString());
    assert.equal(first.lunch.day, "2026-10-10");
    assert.equal(first.lunch.next_reset_at, afterMidnight.toISOString());
    assert.equal((await scan(token)).message, LUNCH_ALREADY_CLAIMED);
    const manual = await processLunchScan({ ...actor, fair_slug: fair, code: paid.student_code, method: "manual", action: "claim" }, beforeMidnight);
    const banglaManual = await processLunchScan({ ...actor, fair_slug: fair, code: "LUNCH-১", method: "manual", action: "claim" }, beforeMidnight);
    assert.equal(banglaManual.result, "duplicate", "printed Bangla ID digits map to the same canonical person");
    assert.equal(manual.result, "duplicate", "manual entry and every printed copy share the same person identity");
    assert.equal((await scan(token, "check")).result, "duplicate");
    await roster.setPaymentStatus({ ...actor, fair_slug: otherFair, student_ids: [paid.id], status: "PAID" });
    assert.equal((await scan(tokenFor(paid.id, "s", otherFair), "claim", beforeMidnight, otherFair)).result, "duplicate", "switching fairs cannot buy a second lunch on the same day");
    assert.equal(await countClaims(), 1);
    assert.equal((await scan(token, "claim", afterMidnight)).result, "success");
    assert.equal(await countClaims(), 2, "the next Dhaka day resets eligibility while retaining yesterday's receipt");
    console.log("PASS paid-student entitlement, non-consuming checks, QR/manual/copy deduplication and automatic Dhaka-midnight reset");

    const racers = await Promise.all(Array.from({ length: 24 }, (_, i) => processLunchScan({
      fair_slug: fair, token: tokenFor(students[1].id), method: "qr", action: "claim", actor_id: `device-${i}`, actor_name: `Operator ${i}`,
    }, beforeMidnight)));
    assert.equal(racers.filter((r) => r.result === "success").length, 1);
    assert.equal(racers.filter((r) => r.result === "duplicate").length, 23);
    const raceLogs = await db.execute({ sql: "SELECT * FROM lunch_scan_logs WHERE subject_id = ?", args: [students[1].id] });
    assert.equal(raceLogs.rows.length, 24, "each competing attempt must be audited");
    assert.equal(new Set(raceLogs.rows.map((r) => r.claim_time)).size, 1);
    console.log("PASS 24 simultaneous devices produce exactly one lunch claim and 24 consistent audit decisions");

    const guestBase = { fair_slug: fair, contact: "01712345678", related_student_id: paid.id, relation: "Guardian",
      entry_fee: 50, created_by: actor.actor_id, created_by_name: actor.actor_name };
    const guest = (await roster.createGuest({ ...guestBase, name: "Paid lunch guest", has_lunch: true, lunch_fee: 150, total_fee: 200 }))!;
    const entryOnly = (await roster.createGuest({ ...guestBase, name: "Entry-only guest", has_lunch: false, lunch_fee: 0, total_fee: 50 }))!;
    const unpaidGuest = (await roster.createGuest({ ...guestBase, name: "Unpaid guest", has_lunch: true, lunch_fee: 150, total_fee: 200, fee_status: "UNPAID" }))!;
    const zeroFee = (await roster.createGuest({ ...guestBase, name: "No lunch fee", has_lunch: true, lunch_fee: 0, total_fee: 50 }))!;
    const guestClaim = await scan(tokenFor(guest.id, "g"));
    assert.equal(guestClaim.result, "success");
    assert.notEqual(guestClaim.subject?.code, paid.student_code, "a guest's displayed ID must be their own reference");
    assert.equal((await scan(tokenFor(guest.id, "g"))).message, LUNCH_ALREADY_CLAIMED);
    assert.equal((await scan(tokenFor(guest.id, "g"), "claim", afterMidnight)).result, "success");
    const beforeDenied = await countClaims();
    for (const id of [entryOnly.id, unpaidGuest.id, zeroFee.id]) {
      const refused = await scan(tokenFor(id, "g"));
      assert.equal(refused.result, "denied");
      assert.equal(refused.message, LUNCH_NO_PURCHASE);
    }
    assert.equal((await scan(tokenFor(students[4].id))).message, LUNCH_NO_PURCHASE);
    await roster.setGuestStatus(guest.id, "revoked");
    assert.equal((await scan(tokenFor(guest.id, "g"))).result, "invalid");
    assert.equal((await scan(tokenFor(entryOnly.id, "g", otherFair), "claim", beforeMidnight, otherFair)).result, "invalid", "stored guest fair must match, not just the QR's fair");
    assert.equal(await countClaims(), beforeDenied);
    console.log("PASS guest lunch purchase/payment/revocation checks, guest IDs, unpaid students and persisted-fair validation");

    const beforeMalformed = await countClaims();
    assert.equal((await scan(tokenFor(students[2].id, "s", otherFair))).result, "invalid");
    assert.equal((await scan(tokenFor(students[2].id, "s", fair, 1))).result, "expired");
    const [body, signature] = token.split(".");
    const changed = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), i: students[2].id })).toString("base64url");
    assert.equal((await scan(`${changed}.${signature}`)).result, "invalid");
    assert.equal((await scan("not-a-ticket")).message, LUNCH_NO_PURCHASE);
    assert.equal((await scan(makeEntryToken("project-identifier"))).result, "invalid", "project labels cannot claim a person's meal");
    assert.equal(parseTicketToken(tokenFor(paid.id, "s", fair, Infinity)), null);
    assert.equal(parseTicketToken(tokenFor(paid.id, "s", fair, 123.45)), null);
    assert.equal(parseTicketToken(tokenFor(paid.id, "s", fair, Number.MAX_SAFE_INTEGER)), null);
    assert.equal(await countClaims(), beforeMalformed);
    console.log("PASS tampered, wrong-fair, expired, malformed and project QR codes never create claims");

    const reviewStudent = students[2];
    assert.equal((await scan(tokenFor(reviewStudent.id), "check")).result, "ready");
    await roster.setPaymentStatus({ ...actor, fair_slug: fair, student_ids: [reviewStudent.id], status: "UNPAID" });
    assert.equal((await scan(tokenFor(reviewStudent.id))).result, "denied", "confirmation must re-check payment, not trust the earlier popup");
    await roster.setPaymentStatus({ ...actor, fair_slug: fair, student_ids: [reviewStudent.id], status: "PAID" });
    const pass = await portal.createPass({ fair_slug: fair, holder_name: reviewStudent.name, holder_role: "student", student_id: reviewStudent.student_code, guest_limit: 1, token: "" });
    assert.equal((await scan(`https://school.example/pass/${makePassToken(pass.id)}`)).result, "success");
    assert.equal((await scan(tokenFor(reviewStudent.id))).result, "duplicate", "legacy and new student QRs map to the same claim identity");
    const child = await portal.createPass({ fair_slug: fair, holder_name: "Family slot", holder_role: "guest", student_id: paid.student_code, parent_pass_id: pass.id, guest_index: 1, token: "" });
    assert.equal((await scan(makePassToken(child.id))).result, "invalid", "family slots must not inherit a paid student's lunch");
    console.log("PASS check-to-claim payment revalidation, legacy student QR mapping and denial of unpurchased family slots");

    const beforeGate = await countClaims();
    const gate = await processEntry({ ...actor, fair_slug: fair, token: tokenFor(students[3].id), method: "qr" });
    assert.equal(gate.result, "success");
    assert.equal(gate.lunch.eligible, true);
    assert.equal(gate.lunch.claimed_today, false);
    assert.equal(await countClaims(), beforeGate, "gate entry must not consume a lunch box");
    const lunchAfterGate = await scan(tokenFor(students[3].id));
    assert.equal(lunchAfterGate.result, "success");
    const gateLogCount = Number((await db.execute("SELECT COUNT(*) AS n FROM scan_logs")).rows[0].n);
    assert.equal(gateLogCount, 1, "canteen scans must not create admissions");
    const unpaidGate = await processEntry({ ...actor, fair_slug: fair, code: students[4].student_code, method: "manual" });
    assert.equal(unpaidGate.result, "invalid", "live unpaid tickets are not admitted by manual ID");
    console.log("PASS independent gate/lunch state and live payment verification for gate admissions");

    assert.equal(schoolDayKey(beforeMidnight), "2026-10-10");
    assert.equal(schoolDayKey(afterMidnight), "2026-10-11");
    assert.equal(dhakaDayStartIso(afterMidnight), afterMidnight.toISOString());
    assert.equal(nextSchoolDayIso(afterMidnight), "2026-10-11T18:00:00.000Z");
    assert.equal(formatSchoolTime(afterMidnight.toISOString()), "00:00:00");
    const summary = await lunchScanSummary(fair, afterMidnight);
    assert.equal(summary.claimed, 2);
    assert.equal(summary.day, "2026-10-11");
    assert.ok((await listLunchScans(fair, { today: true, limit: 500 }, afterMidnight)).every((r) => r.claim_date === "2026-10-11"));
    const claims = (await db.execute("SELECT * FROM lunch_claims")).rows;
    assert.ok(claims.every((r) => r.claimed_by && r.claimed_at && r.claim_date));
    console.log("PASS school-day time formatting, daily summary filtering and server-owned claim receipts");

    const request = (value: unknown, headers: Record<string, string> = {}) => new Request("https://school.example/api/staff/lunch/scan", {
      method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(value),
    });
    const parsed = await readScanRequest(request({ token, fair_slug: fair, action: "check", actor_id: "attacker", claim_date: "2099-01-01", eligible: true }));
    assert.deepEqual(Object.keys(parsed).sort(), ["action", "code", "fair_slug", "method", "token"]);
    for (const value of [null, [], { token, code: paid.student_code }, { token: {} }, { token, action: "reset" }, { token: "x".repeat(9000) }]) {
      await assert.rejects(readScanRequest(request(value)), ScanRequestError);
    }
    await assert.rejects(readScanRequest(request({ token, fair_slug: fair }, { "Sec-Fetch-Site": "cross-site" })), /Cross-site/);
    assert.equal(extractScanValue(`https://school.example/ticket/${token}`), token);
    assert.equal(isTicketQr(token), true);
    assert.equal(isScanQr(makePassToken(pass.id)), true);
    assert.doesNotThrow(() => extractScanValue("https://school.example/pass/%E0%A4%A"));
    await db.execute({ sql: "INSERT INTO students (id, student_code, name) VALUES (?, ?, ?)", args: ["ambiguous-local-id", "LUNCH-১", "Another student"] });
    const ambiguous = await processLunchScan({ ...actor, fair_slug: fair, code: "LUNCH-১", method: "manual", action: "claim" }, beforeMidnight);
    assert.equal(ambiguous.result, "invalid", "localized ID collisions fail closed rather than claim for the wrong person");
    assert.match(ambiguous.reason || "", /ambiguous/);
    console.log("PASS bounded JSON, cross-site rejection, ignored client claim flags/dates/actors and safe QR URL normalization");
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
