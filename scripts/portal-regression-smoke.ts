/** Isolated real-database regression checks; never touches the deployment DB. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "okgs-portal-"));
  process.env.TURSO_DATABASE_URL = `file:${join(directory, "test.db")}`;
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.RESEND_API_KEY;
  process.env.SESSION_SECRET = "regression-test-secret-not-for-production";
  process.env.NEXT_PUBLIC_SITE_URL = "https://school.example";
  const { db, listRows, updateRow } = await import("../lib/db");
  const { createUser, findUserByLogin, updateUser, publicUser, createPasswordReset, getUser, dbQuery, recentResetRequests } = await import("../lib/portal-db");
  const { hashPassword, loginWithPassword, verifyPassword } = await import("../lib/portal-auth");
  const { normalizePhone } = await import("../lib/login-identifier");
  const { requestPasswordReset, performPasswordReset, hashResetToken } = await import("../lib/password-reset");
  const { upsertStudents, getStudentByCode, setPaymentStatus, getPaymentStatus } = await import("../lib/student-db");
  const { sendMail } = await import("../lib/mailer");
  try {
    assert.equal(normalizePhone("01912345678"), "8801912345678");
    assert.equal(normalizePhone("+880 19-1234-5678"), "8801912345678");
    assert.equal(normalizePhone("not-a-phone"), "");
    const password = "SafePassword123";
    const credentials = hashPassword(password);
    const user = await createUser({ name: "Student <Test>", role: "student", student_id: "202408127", email: "student@example.com", phone: "01912345678", password_hash: credentials.hash, password_salt: credentials.salt });
    for (const identifier of [user.id, "202408127", "STUDENT@EXAMPLE.COM", "01912345678", "+8801912345678"]) {
      assert.equal((await findUserByLogin(identifier))?.id, user.id);
      const result = await loginWithPassword(identifier, password);
      assert.equal(result.ok, true);
      assert.equal(result.redirect, "/me");
    }
    assert.equal((await loginWithPassword(user.student_id, "wrongpassword")).ok, false);
    assert.ok(!("password_hash" in publicUser(user)));
    assert.ok(!("login_phone" in publicUser(user)));
    const sibling = await createUser({ name: "Sibling", student_id: "202408128", phone: "+8801912345678", password_hash: credentials.hash, password_salt: credentials.salt });
    assert.equal(await findUserByLogin("01912345678"), null, "shared phones must not select arbitrary accounts");
    assert.equal((await findUserByLogin(user.student_id))?.id, user.id);
    await updateUser(sibling.id, { phone: "01812345678" });
    assert.equal((await findUserByLogin("01912345678"))?.id, user.id);
    console.log("PASS multi-identifier login, normalized phone index, ambiguity and student redirect");

    await upsertStudents([{ student_code: user.student_id, name: user.name, serial_no: 1, roll: "12", photo_url: "", branch: "Main", shift: "Morning", class_name: "Class 8", section: "A", student_group: "", sms_contact: user.phone, father_contact: "", father_name: "", mother_name: "", tags: "" }], "test");
    const roster = await getStudentByCode(user.student_id);
    assert.ok(roster);
    await setPaymentStatus({ fair_slug: "test-fair", student_ids: [roster.id], status: "PAID", actor_id: user.id, actor_name: "Office" });
    assert.equal(await getPaymentStatus(roster.id, "test-fair"), "PAID");
    const fairs = await listRows("fairs");
    assert.ok(fairs.length);
    await updateRow("fairs", String(fairs[0].id), { name: "Renamed fair" });
    assert.equal((await listRows("fairs")).find((fair) => fair.id === fairs[0].id)?.name, "Renamed fair");
    console.log("PASS roster linking, real payment persistence and fair name persistence");

    // A local SMTP sink tests Nodemailer delivery without external credentials.
    const messages: string[] = [];
    const smtp = createServer((socket) => {
      socket.write("220 test SMTP\r\n");
      let buffer = "", data = false, message = "";
      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        let end: number;
        while ((end = buffer.indexOf("\r\n")) >= 0) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          if (data) {
            if (line === ".") { messages.push(message); message = ""; data = false; socket.write("250 accepted\r\n"); }
            else message += `${line}\n`;
          } else if (/^(EHLO|HELO)/.test(line)) socket.write("250 test\r\n");
          else if (line === "DATA") { data = true; socket.write("354 send data\r\n"); }
          else if (line === "QUIT") { socket.end("221 bye\r\n"); }
          else socket.write("250 OK\r\n");
        }
      });
    });
    await new Promise<void>((resolve) => smtp.listen(0, "127.0.0.1", resolve));
    const address = smtp.address();
    assert.ok(address && typeof address !== "string");
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(address.port);
    process.env.SMTP_FROM_EMAIL = "office@example.com";
    try {
      assert.equal((await sendMail({ to: user.email, subject: "Test", text: "SMTP works" })).delivered, true);
      assert.ok(messages[0].includes("SMTP works"));
      const reset = await requestPasswordReset(new Request("https://school.example/api/auth/forgot"), "+8801912345678");
      assert.equal(reset.ok, true);
      assert.equal(reset.devLink, undefined);
      assert.equal(messages.length, 2);
      const records = await dbQuery<{ token_hash: string }>(`SELECT token_hash FROM password_resets WHERE user_id = ? AND used_at = ''`, [user.id]);
      assert.equal(records.length, 1);
      assert.match(records[0].token_hash, /^[a-f0-9]{64}$/);
    } finally {
      await new Promise<void>((resolve, reject) => smtp.close((error) => error ? reject(error) : resolve()));
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_FROM_EMAIL;
    }
    console.log("PASS real Nodemailer SMTP delivery and phone-initiated reset to registered email");

    const token = "secure-test-token";
    await createPasswordReset({ userId: user.id, email: user.email, tokenHash: hashResetToken(token) });
    const result = await performPasswordReset(token, "NewPassword456");
    assert.equal(result.ok, true);
    assert.equal(verifyPassword("NewPassword456", (await getUser(user.id))!.password_hash, (await getUser(user.id))!.password_salt), true);
    assert.equal((await performPasswordReset(token, "OtherPassword789")).ok, false);
    const racingToken = "concurrent-test-token";
    await createPasswordReset({ userId: user.id, email: user.email, tokenHash: hashResetToken(racingToken) });
    const racers = await Promise.all([performPasswordReset(racingToken, "RacePassword111"), performPasswordReset(racingToken, "RacePassword222")]);
    assert.equal(racers.filter((reset) => reset.ok).length, 1);
    const expired = await createPasswordReset({ userId: user.id, email: user.email, tokenHash: hashResetToken("expired") });
    await db.execute({ sql: `UPDATE password_resets SET expires_at = ? WHERE id = ?`, args: [new Date(0).toISOString(), expired.id] });
    assert.equal((await performPasswordReset("expired", "AnotherPassword123")).ok, false);
    assert.ok(await recentResetRequests(user.email) >= 4, "superseded links remain in request throttle history");
    const originalNodeEnv = process.env.NODE_ENV;
    Object.assign(process.env, { NODE_ENV: "production" });
    const noProvider = await requestPasswordReset(new Request("https://school.example/api/auth/forgot"), user.student_id);
    assert.equal(noProvider.devLink, undefined, "production must never return reset links");
    const unknown = await requestPasswordReset(new Request("https://school.example/api/auth/forgot"), "unknown@example.com");
    assert.equal(unknown.message, noProvider.message);
    if (originalNodeEnv === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV;
    else Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    console.log("PASS password reset hashing, expiry, replay rejection, atomic consumption, request history and production token secrecy");

    const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    const css = read("app/globals.css");
    assert.match(css, /\.printable-ticket \*, \.ticket-sheet, \.ticket-sheet \*\s*\{\s*visibility: visible !important/);
    assert.match(css, /@page ticket-landscape \{ size: A4 landscape; margin: 0.5in; \}/);
    assert.match(read("app/api/staff/settings/route.ts"), /isAdminRole\(session.role\)/);
    assert.match(read("app/api/staff/settings/route.ts"), /revalidatePath\("\/", "layout"\)/);
    assert.match(read("app/sf/print/ticket/[id]/page.tsx"), /!isStaffRole\(session.role\) && !isOwnTicket/);
    assert.match(read("app/layout.tsx"), /<DesktopSidebar/);
    assert.match(css, /@media screen and \(min-width: 768px\)/);
    console.log("PASS print visibility, landscape margins, admin authorization, refresh and ticket ownership contracts");
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
