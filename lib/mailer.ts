/**
 * Outgoing transactional mail (password resets, welcome mail).
 *
 * One provider is enough for this app, so the transport is deliberately small:
 *
 *   RESEND_API_KEY  → https://api.resend.com (recommended, no SDK needed)
 *   MAIL_FROM       → "OKGS <no-reply@okgs.info>" (must be a verified sender)
 *
 * With no provider configured nothing breaks: the message is written to the
 * server log and `delivered: false` is returned, which lets the dev UI show the
 * reset link instead of silently swallowing it.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface MailResult {
  delivered: boolean;
  provider: "resend" | "none";
  error?: string;
}

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export function mailFrom() {
  return process.env.MAIL_FROM || "OKGS <no-reply@okgs.info>";
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  if (!mailConfigured()) {
    console.info(
      `[mailer] no provider configured — mail for ${message.to} kept in the log.\n--- ${message.subject} ---\n${message.text}\n---`,
    );
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

/** The “your account is ready” note for accounts created by the SuperAdmin. */
export function welcomeMail(name: string, email: string, resetLink: string): MailMessage {
  return {
    to: email,
    subject: "OKGS — আপনার অ্যাকাউন্ট তৈরি হয়েছে",
    text: [
      `${name},`,
      "",
      `আপনার OKGS অ্যাকাউন্ট (${email}) তৈরি হয়েছে।`,
      "নিচের লিংক থেকে নিজের পাসওয়ার্ড সেট করুন — লিংকটি ৬০ মিনিট বৈধ:",
      resetLink,
      "",
      "OKGS School — okgs.info",
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto">
        <h2 style="margin:0 0 12px">OKGS অ্যাকাউন্ট তৈরি</h2>
        <p style="color:#334155;line-height:1.7">${name}, আপনার OKGS অ্যাকাউন্ট (<b>${email}</b>) তৈরি হয়েছে। নিচের বোতাম থেকে নিজের পাসওয়ার্ড সেট করুন — লিংকটি ৬০ মিনিট বৈধ।</p>
        <p style="margin:24px 0"><a href="${resetLink}" style="background:#0f1e36;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">পাসওয়ার্ড সেট করুন</a></p>
        <p style="color:#64748b;font-size:13px;word-break:break-all">${resetLink}</p>
      </div>`,
  };
}
