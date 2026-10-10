/** Mail networking/provider regressions — isolated DB, mocked DNS/SMTP/HTTPS, no external credentials. */
import assert from "node:assert/strict";
import dns from "node:dns/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock } from "node:test";
import nodemailer, { type SendMailOptions } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "okgs-mailer-"));
  process.env.TURSO_DATABASE_URL = `file:${join(directory, "test.db")}`;
  delete process.env.TURSO_AUTH_TOKEN;
  for (const key of ["MAIL_PROVIDER", "RESEND_API_KEY", "MAIL_FROM", "SMTP_ADDRESS_FAMILY", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM_EMAIL", "SMTP_FROM_NAME", "SMTP_REPLY_TO"]) {
    delete process.env[key];
  }
  process.env.SESSION_SECRET = "mailer-regression-secret-not-for-production";
  process.env.SMTP_CONFIG_SECRET = "mailer-regression-encryption-secret-not-for-production";
  Object.assign(process.env, { NODE_ENV: "production" });
  const { db } = await import("../lib/db");
  const { saveSmtpSettings } = await import("../lib/portal-db");
  const { encryptSmtpPassword } = await import("../lib/smtp-secrets");
  const { mailAvailable, sendMail, sendMailBatch } = await import("../lib/mailer");

  const lookups: Array<{ host: string; family: number }> = [];
  const transports: SMTPTransport.Options[] = [];
  const smtpMessages: SendMailOptions[] = [];
  const apiMessages: Array<{ url: string; options: RequestInit; body: Record<string, unknown> }> = [];
  let lookupError: Error | null = null;
  let lookupBlocked = false;
  let smtpError: Error | null = null;
  let apiError: Error | null = null;
  let apiStatus = 200;
  const originalCreateTransport = nodemailer.createTransport.bind(nodemailer);
  mock.method(dns, "lookup", async (host: string, options: { family: number }) => {
    lookups.push({ host, family: options.family });
    if (lookupError) throw lookupError;
    if (lookupBlocked) return new Promise<never>(() => {});
    return { address: options.family === 6 ? "2001:db8::1" : "192.0.2.10", family: options.family };
  });
  mock.method(nodemailer, "createTransport", (options: SMTPTransport.Options) => {
    transports.push(options);
    const transport = originalCreateTransport(options);
    mock.method(transport, "sendMail", async (message: SendMailOptions) => {
      smtpMessages.push(message);
      if (smtpError) throw smtpError;
      return { accepted: [message.to], rejected: [] };
    });
    return transport;
  });
  mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    apiMessages.push({ url, options, body: JSON.parse(String(options.body)) as Record<string, unknown> });
    if (apiError) throw apiError;
    return new Response(JSON.stringify({ id: "test-message" }), { status: apiStatus });
  });
  // Expected error paths are asserted below, not printed as alarming stack traces.
  mock.method(console, "error", () => {});
  mock.method(console, "info", () => {});
  const message = { to: "student@example.com", subject: "Reset test", text: "Reset link", html: "<p>Reset link</p>" };
  const networkError = () => Object.assign(new Error("connect ENETUNREACH 2607:f8b0:400e:c20::6c:465"), {
    code: "ESOCKET", syscall: "connect", command: "CONN", address: "2607:f8b0:400e:c20::6c", port: 465,
  });
  try {
    assert.equal(await mailAvailable(), false);
    assert.deepEqual(await sendMail(message), { delivered: false, provider: "none" });

    process.env.SMTP_HOST = "smtp.environment.example";
    process.env.SMTP_FROM_EMAIL = "environment@example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "environment-user";
    process.env.SMTP_PASSWORD = "environment-password";
    assert.equal(await mailAvailable(), true);
    assert.deepEqual(await sendMail(message), { delivered: true, provider: "smtp" });
    assert.deepEqual(lookups[0], { host: "smtp.environment.example", family: 4 });
    assert.equal(transports[0].host, "192.0.2.10");
    assert.equal(transports[0].tls?.servername, "smtp.environment.example");
    assert.notEqual(transports[0].tls?.rejectUnauthorized, false);
    assert.equal(transports[0].requireTLS, true, "production STARTTLS must still be required");
    assert.equal(transports[0].secure, false);
    assert.deepEqual(transports[0].auth, { user: "environment-user", pass: "environment-password" });
    console.log("PASS environment SMTP defaults to IPv4 with TLS hostname verification and production STARTTLS");

    await saveSmtpSettings({
      enabled: 1, host: "smtp.stored.example", port: 465, secure: 1, username: "stored-user",
      password_encrypted: encryptSmtpPassword("stored-password"), from_email: "stored@example.com",
      from_name: "OKGS", reply_to: "office@example.com",
    });
    const transportCount = transports.length;
    const lookupCount = lookups.length;
    assert.deepEqual(await Promise.all([sendMail(message), sendMail(message), sendMail(message)]), Array(3).fill({ delivered: true, provider: "smtp" }));
    assert.equal(transports.length, transportCount + 1, "concurrent messages must share the in-flight transport");
    assert.equal(lookups.length, lookupCount + 1);
    const stored = transports.at(-1)!;
    assert.equal(stored.host, "192.0.2.10");
    assert.equal(stored.tls?.servername, "smtp.stored.example");
    assert.equal(stored.secure, true);
    assert.deepEqual(stored.auth, { user: "stored-user", pass: "stored-password" });
    assert.equal(smtpMessages.at(-1)?.from, '"OKGS" <stored@example.com>');
    assert.equal(smtpMessages.at(-1)?.replyTo, "office@example.com");
    console.log("PASS encrypted database SMTP overrides environment settings and concurrent sends reuse DNS/transport");

    const beforeExpiry = lookups.length;
    const now = Date.now();
    const clock = mock.method(Date, "now", () => now + 5 * 60_000 + 1);
    try { assert.equal((await sendMail(message)).delivered, true); }
    finally { clock.mock.restore(); }
    assert.equal(lookups.length, beforeExpiry + 1, "SMTP DNS must be refreshed, not pinned indefinitely");

    process.env.SMTP_ADDRESS_FAMILY = "6";
    await sendMail(message);
    assert.equal(transports.at(-1)?.host, "2001:db8::1");
    assert.equal(transports.at(-1)?.tls?.servername, "smtp.stored.example");
    process.env.SMTP_ADDRESS_FAMILY = "0";
    const beforeAutomatic = lookups.length;
    await sendMail(message);
    assert.equal(transports.at(-1)?.host, "smtp.stored.example");
    assert.equal(lookups.length, beforeAutomatic, "automatic mode leaves resolution to Nodemailer");
    process.env.SMTP_ADDRESS_FAMILY = "4";
    await saveSmtpSettings({ host: "[::1]" });
    await sendMail(message);
    assert.equal(transports.at(-1)?.host, "::1", "explicit IP literals are used as supplied without brackets");
    assert.equal(lookups.length, beforeAutomatic);
    await saveSmtpSettings({ host: "smtp.stored.example" });
    console.log("PASS DNS cache expiry, explicit family overrides and literal-IP handling");

    process.env.RESEND_API_KEY = "test-api-key-not-real";
    process.env.MAIL_FROM = "OKGS <no-reply@verified.example>";
    smtpError = networkError();
    assert.deepEqual(await sendMail(message), { delivered: true, provider: "resend" });
    assert.equal(apiMessages.at(-1)?.url, "https://api.resend.com/emails");
    assert.equal(apiMessages.at(-1)?.options.method, "POST");
    assert.ok(apiMessages.at(-1)?.options.signal instanceof AbortSignal, "HTTPS requests must have a deadline");
    assert.equal(new Headers(apiMessages.at(-1)?.options.headers).get("authorization"), "Bearer test-api-key-not-real");
    assert.deepEqual(apiMessages.at(-1)?.body, {
      from: process.env.MAIL_FROM, to: [message.to], subject: message.subject,
      text: message.text, html: message.html, reply_to: "office@example.com",
    });
    await sendMail({ ...message, replyTo: "override@example.com" });
    assert.equal(apiMessages.at(-1)?.body.reply_to, "override@example.com");
    for (const detail of ["Connection timeout", "Greeting never received"]) {
      smtpError = Object.assign(new Error(detail), { code: "ETIMEDOUT", command: "CONN" });
      assert.deepEqual(await sendMail(message), { delivered: true, provider: "resend" });
    }
    console.log("PASS ENETUNREACH and pre-submission timeouts fall back to HTTPS with the correct sender and reply-to");

    const beforeRejected = apiMessages.length;
    for (const [detail, code, command] of [
      ["Bad credentials", "EAUTH", "AUTH PLAIN"],
      ["Message rejected", "EMESSAGE", "DATA"],
      ["Timeout", "ETIMEDOUT", "CONN"],
      ["Socket closed after submission", "ESOCKET", "CONN"],
    ]) {
      smtpError = Object.assign(new Error(detail), { code, command });
      assert.deepEqual(await sendMail(message), { delivered: false, provider: "smtp", error: detail });
    }
    assert.equal(apiMessages.length, beforeRejected, "ambiguous send outcomes must never produce a duplicate via Resend");
    smtpError = networkError();
    process.env.MAIL_PROVIDER = "smtp";
    const smtpOnly = await sendMail(message);
    assert.equal(smtpOnly.delivered, false);
    assert.equal(smtpOnly.provider, "smtp");
    assert.match(smtpOnly.error!, /outbound network access/);
    assert.equal(apiMessages.length, beforeRejected);
    delete process.env.MAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    const withoutFallback = await sendMail(message);
    assert.equal(withoutFallback.provider, "smtp");
    assert.match(withoutFallback.error!, /MAIL_PROVIDER=resend/);
    assert.equal(apiMessages.length, beforeRejected);
    process.env.RESEND_API_KEY = "test-api-key-not-real";
    console.log("PASS failures are reported accurately; auth/DATA/ambiguous errors and SMTP-only mode never retry");

    smtpError = null;
    lookupError = Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });
    await saveSmtpSettings({ host: "smtp.temporary-dns.example" });
    assert.deepEqual(await sendMail(message), { delivered: true, provider: "resend" });
    lookupError = null;
    assert.deepEqual(await sendMail(message), { delivered: true, provider: "smtp" }, "DNS failure must not poison the cache");
    lookupBlocked = true;
    await saveSmtpSettings({ host: "smtp.stalled-dns.example" });
    assert.deepEqual(await sendMail(message), { delivered: true, provider: "resend" }, "stalled DNS must time out before API fallback");
    lookupBlocked = false;
    console.log("PASS DNS failures recover and stalled DNS is bounded before fallback");

    process.env.MAIL_PROVIDER = "resend";
    const beforeHttpsOnly = smtpMessages.length;
    const lookupsBeforeHttps = lookups.length;
    delete process.env.SMTP_CONFIG_SECRET;
    delete process.env.SESSION_SECRET;
    assert.equal(await mailAvailable(), true);
    assert.deepEqual(await sendMail(message), { delivered: true, provider: "resend" });
    assert.equal(smtpMessages.length, beforeHttpsOnly);
    assert.equal(lookups.length, lookupsBeforeHttps);
    assert.equal(apiMessages.at(-1)?.body.reply_to, undefined, "HTTPS-only mode must not depend on SMTP settings");
    assert.deepEqual(await sendMailBatch(message, [
      { email: "student@example.com" }, { email: "STUDENT@example.com " }, { email: "other@example.com" },
    ]), { attempted: 2, delivered: 2, failed: 0, configured: true });
    assert.deepEqual(apiMessages.at(-2)?.body.to, ["student@example.com"]);
    assert.deepEqual(apiMessages.at(-1)?.body.to, ["other@example.com"]);
    apiStatus = 403;
    assert.deepEqual(await sendMail(message), { delivered: false, provider: "resend", error: "HTTP 403" });
    apiStatus = 200;
    apiError = new Error("HTTPS timeout");
    assert.deepEqual(await sendMail(message), { delivered: false, provider: "resend", error: "HTTPS timeout" });
    apiError = null;
    delete process.env.RESEND_API_KEY;
    assert.equal(await mailAvailable(), false, "enabled SMTP does not count as available in HTTPS-only mode");
    assert.equal((await sendMail(message)).delivered, false);
    process.env.RESEND_API_KEY = "test-api-key-not-real";
    delete process.env.MAIL_FROM;
    assert.equal(await mailAvailable(), false);
    assert.equal((await sendMail(message)).delivered, false);
    process.env.MAIL_FROM = "OKGS <no-reply@verified.example>";
    console.log("PASS explicit Resend bypasses encrypted SMTP, isolates batch recipients and reports API/config failures");

    process.env.MAIL_PROVIDER = "invalid-provider";
    assert.equal(await mailAvailable(), false);
    assert.match((await sendMail(message)).error!, /MAIL_PROVIDER must be/);
    process.env.MAIL_PROVIDER = "resend";
    db.close();
    assert.equal(await mailAvailable(), true);
    assert.deepEqual(await sendMail(message), { delivered: true, provider: "resend" }, "HTTPS-only mode must not query the closed database");
    console.log("PASS provider validation and HTTPS-only delivery without a working SMTP settings database");
  } finally {
    mock.restoreAll();
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
