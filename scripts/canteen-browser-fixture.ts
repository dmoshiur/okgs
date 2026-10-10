/** Creates ONLY a new ignored local verification DB. Never reads/writes a configured production DB. */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { StudentImportRecord } from "../lib/student-db";

async function main() {
  mkdirSync(resolve(".screens"), { recursive: true });
  const directory = mkdtempSync(join(resolve(".screens"), "canteen-"));
  const databaseUrl = `file:${join(directory, "database.db")}`;
  process.env.TURSO_DATABASE_URL = databaseUrl;
  delete process.env.TURSO_AUTH_TOKEN;
  process.env.SESSION_SECRET = "isolated-browser-verification-secret-not-production";
  const { db, insertRow } = await import("../lib/db");
  const { ensurePortal, createUser } = await import("../lib/portal-db");
  const { hashPassword } = await import("../lib/portal-auth");
  const roster = await import("../lib/student-db");
  const { makeTicketToken } = await import("../lib/ticket-token");
  const { qrDataUrl } = await import("../lib/qr");
  try {
    await ensurePortal();
    const fairSlug = "print-check";
    await insertRow("fairs", { slug: fairSlug, name: "OKGS GENESIS 2026", name_en: "OKGS GENESIS 2026", starts_on: new Date().toISOString().slice(0, 10),
      ends_on: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10), is_active: 1 });
    const records: StudentImportRecord[] = Array.from({ length: 502 }, (_, i) => ({
      serial_no: i + 1, student_code: `VERIFY-${String(i + 1).padStart(4, "0")}`,
      name: i === 1 ? "মোহাম্মদ আব্দুল্লাহ আল মামুন" : i === 2 ? "Mohammad Abdullah Al Mamun Mahmudur Rahman Chowdhury" : `Verification Student ${i + 1}`,
      roll: String(i + 1), class_name: "Class 8", section: "A", shift: "Day", branch: "Main", student_group: "Science",
      father_name: i === 2 ? "Mohammad Rafiqul Islam Mahmudur Rahman Chowdhury" : "Rafiqul Islam",
      mother_name: i === 2 ? "Begum Salma Khatun Mahmudur Rahman Chowdhury" : "Salma Begum",
      photo_url: `https://res.cloudinary.com/verification/image/upload/v1/student-${i + 1}.jpg`,
      father_photo_url: `https://res.cloudinary.com/verification/image/upload/v1/father-${i + 1}.jpg`,
      mother_photo_url: `https://res.cloudinary.com/verification/image/upload/v1/mother-${i + 1}.jpg`,
      sms_contact: "", father_contact: "", tags: "",
    }));
    await roster.upsertStudents(records, "isolated-browser-verification");
    // No entitlements are seeded by the schema. Pay these test rows explicitly.
    const rows = (await db.execute("SELECT id, student_code FROM students WHERE student_code LIKE 'VERIFY-%' ORDER BY serial_no")).rows;
    await roster.setPaymentStatus({ fair_slug: fairSlug, student_ids: rows.slice(0, 501).map((r) => String(r.id)), status: "PAID", actor_id: "verification", actor_name: "Verification" });
    const password = "local-verification-only-2026";
    const hashed = hashPassword(password);
    const operator = await createUser({ name: "Verification Operator", role: "staff", email: "scanner-verification@example.com", password_hash: hashed.hash, password_salt: hashed.salt });
    await createUser({ name: "Verification Learner", role: "student", student_id: String(rows[501].student_code), email: "learner-verification@example.com", password_hash: hashed.hash, password_salt: hashed.salt });
    const common = { created_by: operator.id, created_by_name: "Verification Operator", fair_slug: fairSlug, contact: "01712345678", related_student_id: String(rows[0].id), relation: "Guardian", photo_url: "https://res.cloudinary.com/verification/image/upload/v1/guest.jpg", entry_fee: 50 };
    const paidGuest = (await roster.createGuest({ ...common, name: "Lunch Guest", has_lunch: true, lunch_fee: 150, total_fee: 200 }))!;
    const entryGuest = (await roster.createGuest({ ...common, name: "Entry Only Guest", has_lunch: false, lunch_fee: 0, total_fee: 50 }))!;
    const expires = Math.floor(Date.now() / 1000) + 30 * 86400;
    const token = (id: string, k: "s" | "g" = "s") => makeTicketToken({ k, i: id, f: fairSlug, e: expires });
    const tokens = { student: token(String(rows[0].id)), camera: token(String(rows[3].id)), guest: token(paidGuest.id, "g"), noLunch: token(entryGuest.id, "g") };
    const fixture = { databaseUrl, directory, fairSlug, operatorId: operator.id, password, staffLogin: "scanner-verification@example.com", studentLogin: "learner-verification@example.com",
      students: rows.map((r) => ({ id: String(r.id), code: String(r.student_code) })), paidGuestId: paidGuest.id, entryGuestId: entryGuest.id,
      tokens, cameraQr: await qrDataUrl(tokens.camera, { size: 520, margin: 4 }) };
    writeFileSync(resolve(".screens/canteen-browser-fixture.json"), JSON.stringify(fixture, null, 2));
    console.log(`Created isolated fixture: 502 students (501 paid), 2 guests and staff/student test users.\nDatabase: ${databaseUrl}\nFixture: .screens/canteen-browser-fixture.json`);
  } finally { db.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
