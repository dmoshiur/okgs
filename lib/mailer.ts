/**
 * Transactional and broadcast email.
 *
 * SuperAdmins may configure one SMTP transport in the database. SMTP credentials
 * are encrypted at rest; SMTP_CONFIG_SECRET (or SESSION_SECRET) must be set on
 * every app instance. RESEND_API_KEY remains a supported fallback for existing
 * installations.
 */
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

let cachedSmtpKey = "";
let cachedSmtpTransport: Transporter | null = null;

/** Synchronous compatibility check for the legacy Resend environment config. */
export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function mailAvailable() {
  if (mailConfigured() || environmentSmtp()) return true;
  try {
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

async function smtpTransport() {
  const stored = await getSmtpSettings();
  const useStored = Boolean(stored?.enabled);
  const settings = useStored ? stored : environmentSmtp();
  if (!settings?.enabled || !settings.host || !settings.from_email) return null;
  let password = useStored ? "" : process.env.SMTP_PASSWORD || "";
  if (settings.password_encrypted) password = decryptSmtpPassword(settings.password_encrypted);
  const key = [settings.host, settings.port, settings.secure, settings.username, settings.password_encrypted, password].join("|");
  if (cachedSmtpTransport && cachedSmtpKey === key) return { transport: cachedSmtpTransport, settings };
  cachedSmtpTransport?.close();
  cachedSmtpTransport = nodemailer.createTransport({
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    requireTLS: !Boolean(Number(settings.secure)) && process.env.NODE_ENV === "production",
    host: settings.host,
    port: Number(settings.port) || 587,
    secure: Boolean(Number(settings.secure)),
    ...(settings.username ? { auth: { user: settings.username, pass: password } } : {}),
  });
  cachedSmtpKey = key;
  return { transport: cachedSmtpTransport, settings };
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  try {
    const smtp = await smtpTransport();
    if (smtp) {
      const from = smtp.settings.from_name
        ? `"${smtp.settings.from_name.replace(/[\r\n"<>]/g, "").trim()}" <${smtp.settings.from_email}>`
        : smtp.settings.from_email;
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
    return { delivered: false, provider: "smtp", error: error instanceof Error ? error.message : "SMTP_ERROR" };
  }

  if (!mailConfigured()) {
    console.info(`[mailer] no provider configured — email for ${message.to} was not delivered (${message.subject}).`);
    return { delivered: false, provider: "none" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
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
    console.error("[mailer] send failed", error);
    return { delivered: false, provider: "resend", error: error instanceof Error ? error.message : "unknown" };
  }
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
