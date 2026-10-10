/**
 * Transactional and broadcast email.
 *
 * SuperAdmins may configure one SMTP transport in the database. SMTP credentials
 * are encrypted at rest; SMTP_CONFIG_SECRET (or SESSION_SECRET) must be set on
 * every app instance. MAIL_PROVIDER=resend bypasses SMTP on hosts that restrict
 * SMTP egress. In auto mode Resend is a fallback for pre-submission connection
 * failures, never for failures with an ambiguous delivery outcome.
 */
import dns from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer, { type Transporter } from "nodemailer";
import { getSmtpSettings } from "@/lib/portal-db";
import { decryptSmtpPassword } from "@/lib/smtp-secrets";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface MailResult {
  delivered: boolean;
  provider: "smtp" | "resend" | "none";
  error?: string;
}

export interface MailBatchResult {
  attempted: number;
  delivered: number;
  failed: number;
  configured: boolean;
}

type MailProvider = "auto" | "smtp" | "resend";
type SmtpError = Error & { code?: string; command?: string; syscall?: string };

const SMTP_DNS_TIMEOUT_MS = 5_000;
const SMTP_DNS_CACHE_MS = 5 * 60_000;
let cachedSmtpKey = "";
let cachedSmtpExpiresAt = 0;
// Cache the in-flight lookup too, so concurrent broadcasts share one transport.
let cachedSmtpTransport: Promise<Transporter> | null = null;

function selectedMailProvider(): MailProvider {
  const provider = process.env.MAIL_PROVIDER?.trim().toLowerCase() || "auto";
  if (provider === "auto" || provider === "smtp" || provider === "resend") return provider;
  throw new Error("MAIL_PROVIDER must be auto, smtp or resend.");
}

/** Synchronous compatibility check for the legacy Resend environment config. */
export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/** Checks configuration, not whether the provider is currently reachable. */
export async function mailAvailable() {
  try {
    const provider = selectedMailProvider();
    if (provider === "resend") return mailConfigured();
    if (provider === "auto" && mailConfigured()) return true;
    if (environmentSmtp()) return true;
    const smtp = await getSmtpSettings();
    return Boolean(smtp?.enabled && smtp.host && smtp.from_email && (!smtp.username || smtp.password_encrypted));
  } catch {
    return false;
  }
}

export function mailFrom() {
  return process.env.MAIL_FROM || "OKGS <no-reply@okgs.info>";
}

function environmentSmtp() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM_EMAIL || (process.env.SMTP_USER && !process.env.SMTP_PASSWORD)) return null;
  return {
    enabled: 1, host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1" ? 1 : 0,
    username: process.env.SMTP_USER || "", password_encrypted: "",
    from_email: process.env.SMTP_FROM_EMAIL, from_name: process.env.SMTP_FROM_NAME || "OKGS",
    reply_to: process.env.SMTP_REPLY_TO || "",
  };
}

function smtpAddressFamily(): 0 | 4 | 6 {
  const family = process.env.SMTP_ADDRESS_FAMILY?.trim() || "4";
  if (family === "0") return 0;
  if (family === "4") return 4;
  if (family === "6") return 6;
  throw new Error("SMTP_ADDRESS_FAMILY must be 4 (IPv4), 6 (IPv6) or 0 (automatic).");
}

async function smtpNetworkOptions(host: string, family: 0 | 4 | 6) {
  const hostname = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const tls = isIP(hostname) ? undefined : { servername: hostname };
  if (isIP(hostname) || family === 0) return { host: hostname, tls };

  // Nodemailer resolves A and AAAA records itself and can pick an unreachable
  // IPv6 address. A top-level `family: 4` or NODE_OPTIONS=--dns-result-order
  // does not constrain that resolver. Pass a resolved IP instead, preserving
  // the original hostname for TLS SNI AND certificate verification.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const resolved = await Promise.race([
      dns.lookup(hostname, { family }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("SMTP DNS lookup timed out"), {
          code: "EDNS", command: "CONN",
        })), SMTP_DNS_TIMEOUT_MS);
      }),
    ]);
    return { host: resolved.address, tls };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function smtpTransport() {
  const stored = await getSmtpSettings();
  const useStored = Boolean(stored?.enabled);
  const settings = useStored ? stored : environmentSmtp();
  if (!settings?.enabled || !settings.host || !settings.from_email) return null;
  let password = useStored ? "" : process.env.SMTP_PASSWORD || "";
  if (settings.password_encrypted) password = decryptSmtpPassword(settings.password_encrypted);
  const family = smtpAddressFamily();
  const requireTLS = !Boolean(Number(settings.secure)) && process.env.NODE_ENV === "production";
  const key = [settings.host, settings.port, settings.secure, settings.username, settings.password_encrypted, password, family, requireTLS].join("|");
  if (cachedSmtpTransport && cachedSmtpKey === key && Date.now() < cachedSmtpExpiresAt) {
    return { transport: await cachedSmtpTransport, settings };
  }

  const previous = cachedSmtpTransport;
  const pending = smtpNetworkOptions(settings.host, family).then((network) => nodemailer.createTransport({
    ...network,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    requireTLS,
    port: Number(settings.port) || 587,
    secure: Boolean(Number(settings.secure)),
    ...(settings.username ? { auth: { user: settings.username, pass: password } } : {}),
  }));
  cachedSmtpKey = key;
  cachedSmtpExpiresAt = Date.now() + SMTP_DNS_CACHE_MS;
  cachedSmtpTransport = pending;
  void previous?.then((transport) => transport.close()).catch(() => {});
  try {
    return { transport: await pending, settings };
  } catch (error) {
    // A temporary DNS failure must not poison subsequent attempts.
    if (cachedSmtpTransport === pending) {
      cachedSmtpTransport = null;
      cachedSmtpKey = "";
      cachedSmtpExpiresAt = 0;
    }
    throw error;
  }
}

function smtpConnectionFailedBeforeSend(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const failure = error as Partial<SmtpError>;
  // Generic ESOCKET/ETIMEDOUT and even command=CONN may occur AFTER DATA.
  // Retry only errors that prove the message was not submitted, avoiding
  // duplicate password-reset, invitation and broadcast emails.
  return failure.syscall === "connect" || failure.code === "EDNS" || (
    failure.code === "ETIMEDOUT" && failure.command === "CONN" &&
    (failure.message === "Connection timeout" || failure.message === "Greeting never received")
  );
}

function smtpFailureMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : "SMTP_ERROR";
  const code = error && typeof error === "object" ? (error as Partial<SmtpError>).code : undefined;
  if (smtpConnectionFailedBeforeSend(error) || code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return `Cannot reach the SMTP server. Check the host, port and outbound network access. If your host blocks SMTP ports, use HTTPS email by setting MAIL_PROVIDER=resend, RESEND_API_KEY and MAIL_FROM. (${detail})`;
  }
  return detail;
}

async function sendWithResend(message: MailMessage): Promise<MailResult> {
  if (!mailConfigured()) {
    return { delivered: false, provider: "resend", error: "Set RESEND_API_KEY and MAIL_FROM before using Resend." };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFrom(),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        reply_to: message.replyTo,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[mailer] resend rejected the message", response.status, detail);
      return { delivered: false, provider: "resend", error: `HTTP ${response.status}` };
    }
    return { delivered: true, provider: "resend" };
  } catch (error) {
    console.error("[mailer] resend send failed", error);
    return { delivered: false, provider: "resend", error: error instanceof Error ? error.message : "unknown" };
  }
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  let provider: MailProvider;
  try {
    provider = selectedMailProvider();
  } catch (error) {
    return { delivered: false, provider: "none", error: error instanceof Error ? error.message : "MAIL_CONFIG_ERROR" };
  }
  // Explicit HTTPS mode must not read/decrypt SMTP settings or attempt SMTP.
  if (provider === "resend") return sendWithResend(message);

  let smtp: Awaited<ReturnType<typeof smtpTransport>> = null;
  let sending = false;
  try {
    smtp = await smtpTransport();
    if (smtp) {
      const from = smtp.settings.from_name
        ? `"${smtp.settings.from_name.replace(/[\r\n"<>]/g, "").trim()}" <${smtp.settings.from_email}>`
        : smtp.settings.from_email;
      sending = true;
      await smtp.transport.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(message.replyTo || smtp.settings.reply_to ? { replyTo: message.replyTo || smtp.settings.reply_to } : {}),
      });
      return { delivered: true, provider: "smtp" };
    }
  } catch (error) {
    console.error("[mailer] smtp send failed", error);
    if (provider !== "auto" || !mailConfigured() || (sending && !smtpConnectionFailedBeforeSend(error))) {
      return { delivered: false, provider: "smtp", error: smtpFailureMessage(error) };
    }
    console.info("[mailer] SMTP unavailable before submission — trying Resend over HTTPS.");
  }

  if (provider === "smtp") {
    return { delivered: false, provider: "smtp", error: "Configure and enable SMTP before sending email." };
  }
  if (!mailConfigured()) {
    console.info(`[mailer] no provider configured — email for ${message.to} was not delivered (${message.subject}).`);
    return { delivered: false, provider: "none" };
  }
  return sendWithResend({ ...message, replyTo: message.replyTo || smtp?.settings.reply_to || undefined });
}

/** Send separately to each address so recipient lists are never exposed. */
export async function sendMailBatch(
  message: Omit<MailMessage, "to">,
  recipients: Array<{ email: string }>,
  concurrency = 8,
): Promise<MailBatchResult> {
  const unique = Array.from(new Set(recipients.map((item) => item.email.trim().toLowerCase()).filter(Boolean)));
  const configured = await mailAvailable();
  if (!configured) return { attempted: unique.length, delivered: 0, failed: unique.length, configured: false };
  let delivered = 0;
  for (let offset = 0; offset < unique.length; offset += Math.max(1, concurrency)) {
    const batch = unique.slice(offset, offset + Math.max(1, concurrency));
    const results = await Promise.all(batch.map((email) => sendMail({ ...message, to: email })));
    delivered += results.filter((result) => result.delivered).length;
  }
  return { attempted: unique.length, delivered, failed: unique.length - delivered, configured: true };
}

/** The “your account is ready” note for accounts created by the SuperAdmin. */
export function welcomeMail(name: string, email: string, resetLink: string): MailMessage {
  return {
    to: email,
    subject: "OKGS — আপনার অ্যাকাউন্ট তৈরি হয়েছে",
    text: [
      `${name},`,
      "",
      `আপনার OKGS অ্যাকাউন্ট (${email}) তৈরি হয়েছে।`,
      "নিচের লিংক থেকে নিজের পাসওয়ার্ড সেট করুন — লিংকটি ৭ দিন বৈধ:",
      resetLink,
      "",
      "OKGS School — okgs.info",
    ].join("\n"),
    html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto"><h2>OKGS অ্যাকাউন্ট তৈরি</h2><p>${escapeHtml(name)}, আপনার OKGS অ্যাকাউন্ট (<b>${escapeHtml(email)}</b>) তৈরি হয়েছে। নিচের লিংক থেকে নিজের পাসওয়ার্ড সেট করুন।</p><p><a href="${escapeHtml(resetLink)}">পাসওয়ার্ড সেট করুন</a></p></div>`,
  };
}

export function welcomeCredentialsMail(name: string, email: string, password: string, loginUrl: string): MailMessage {
  return {
    to: email,
    subject: "OKGS — আপনার অ্যাকাউন্ট তৈরি হয়েছে",
    text: `${name},\n\nআপনার OKGS অ্যাকাউন্ট তৈরি হয়েছে।\nইমেইল: ${email}\nঅস্থায়ী পাসওয়ার্ড: ${password}\nলগইন: ${loginUrl}\n\nনিরাপত্তার জন্য প্রথম লগইনের পর পাসওয়ার্ড বদলে নিন।`,
    html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto"><h2>আপনার OKGS অ্যাকাউন্ট প্রস্তুত</h2><p>${escapeHtml(name)}, এই অস্থায়ী পরিচয়পত্র দিয়ে সাইন ইন করুন:</p><p>ইমেইল: <b>${escapeHtml(email)}</b><br>অস্থায়ী পাসওয়ার্ড: <b>${escapeHtml(password)}</b></p><p><a href="${escapeHtml(loginUrl)}">লগইন করুন</a></p><p>নিরাপত্তার জন্য প্রথম লগইনের পর পাসওয়ার্ড বদলে নিন।</p></div>`,
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character] ?? character));
}
