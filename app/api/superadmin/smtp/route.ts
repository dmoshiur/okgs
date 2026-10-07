import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { getSmtpSettings, isEmailAddress, logActivity, saveSmtpSettings } from "@/lib/portal-db";
import { encryptSmtpPassword } from "@/lib/smtp-secrets";
import { mailAvailable, sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

function authResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "Only a SuperAdmin can configure SMTP." }, { status: 403 });
  return null;
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const settings = await getSmtpSettings();
    return NextResponse.json({
      ok: true,
      settings: settings ? {
        host: settings.host,
        port: settings.port,
        secure: Boolean(settings.secure),
        username: settings.username,
        from_name: settings.from_name,
        from_email: settings.from_email,
        reply_to: settings.reply_to,
        enabled: Boolean(settings.enabled),
        password_set: Boolean(settings.password_encrypted),
      } : {
        host: "", port: 587, secure: false, username: "", from_name: "OKGS", from_email: "", reply_to: "", enabled: false, password_set: false,
      },
      available: await mailAvailable(),
    });
  } catch (error) {
    const auth = authResponse(error);
    if (auth) return auth;
    console.error("[smtp:get]", error);
    return NextResponse.json({ error: "SMTP settings could not be loaded." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const host = String(body.host ?? "").trim();
    const fromEmail = String(body.from_email ?? "").trim().toLowerCase();
    const replyTo = String(body.reply_to ?? "").trim().toLowerCase();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const clearPassword = body.clear_password === true;
    const enabled = body.enabled === true || Number(body.enabled) === 1;
    const secure = body.secure === true || Number(body.secure) === 1;
    const port = Number(body.port ?? 587);
    const current = await getSmtpSettings();

    if (enabled && !host) return NextResponse.json({ error: "Enter the SMTP host before enabling mail." }, { status: 422 });
    if (enabled && !isEmailAddress(fromEmail)) return NextResponse.json({ error: "Enter a valid sender email address." }, { status: 422 });
    if (replyTo && !isEmailAddress(replyTo)) return NextResponse.json({ error: "Enter a valid reply-to email address." }, { status: 422 });
    if (!Number.isInteger(port) || port < 1 || port > 65535) return NextResponse.json({ error: "SMTP port must be between 1 and 65535." }, { status: 422 });
    if (enabled && username && !password && (clearPassword || !current?.password_encrypted)) return NextResponse.json({ error: "Enter the SMTP password for this account." }, { status: 422 });

    let encrypted = current?.password_encrypted ?? "";
    try {
      if (password) encrypted = encryptSmtpPassword(password);
      else if (clearPassword) encrypted = "";
    } catch (error) {
      const message = error instanceof Error && error.message === "SMTP_CONFIG_SECRET_OR_SESSION_SECRET_REQUIRED"
        ? "Set SMTP_CONFIG_SECRET (or SESSION_SECRET) in the deployment environment before saving SMTP credentials."
        : "SMTP password encryption failed.";
      return NextResponse.json({ error: message }, { status: 503 });
    }

    const saved = await saveSmtpSettings({
      host,
      port,
      secure: secure ? 1 : 0,
      username,
      password_encrypted: encrypted,
      from_name: String(body.from_name ?? "OKGS").trim() || "OKGS",
      from_email: fromEmail,
      reply_to: replyTo,
      enabled: enabled ? 1 : 0,
    });
    await logActivity({
      actor_id: session.id,
      actor_name: session.name,
      actor_role: session.role,
      action: "mail.smtp.update",
      entity: "smtp_settings",
      detail: `${saved.host}:${saved.port} · ${saved.enabled ? "enabled" : "disabled"}`,
    });
    return NextResponse.json({ ok: true, saved: true, password_set: Boolean(saved.password_encrypted), available: await mailAvailable() });
  } catch (error) {
    const auth = authResponse(error);
    if (auth) return auth;
    console.error("[smtp:put]", error);
    return NextResponse.json({ error: "SMTP settings could not be saved." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const to = String(body.to ?? "").trim().toLowerCase();
    if (!isEmailAddress(to)) return NextResponse.json({ error: "Enter a valid test-recipient email." }, { status: 422 });
    if (!(await mailAvailable())) return NextResponse.json({ error: "Configure and enable SMTP or Resend before sending a test." }, { status: 409 });
    const result = await sendMail({
      to,
      subject: "OKGS SMTP test",
      text: "This is a test message from the OKGS SuperAdmin console. Email delivery is configured.",
      html: "<p>This is a test message from the OKGS SuperAdmin console. Email delivery is configured.</p>",
    });
    await logActivity({ actor_id: session.id, actor_name: session.name, actor_role: session.role, action: "mail.smtp.test", entity: "smtp_settings", detail: `${to} · ${result.delivered ? "delivered" : "failed"}` });
    if (!result.delivered) return NextResponse.json({ error: result.error || "The test message could not be sent." }, { status: 502 });
    return NextResponse.json({ ok: true, delivered: true, provider: result.provider });
  } catch (error) {
    const auth = authResponse(error);
    if (auth) return auth;
    console.error("[smtp:test]", error);
    return NextResponse.json({ error: "The SMTP test could not be sent." }, { status: 500 });
  }
}
