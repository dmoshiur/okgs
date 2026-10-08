import { fail, ok, staff, str } from "@/lib/api";
import { mailAvailable, sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/**
 * Test SMTP connection by sending a test email
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  
  // Validate required fields
  const host = str(body.host);
  const port = Number(body.port) || 587;
  const from_email = str(body.from_email);
  const test_recipient = str(body.test_recipient);
  
  if (!host) return fail("SMTP host is required", 400);
  if (!from_email) return fail("From email is required", 400);
  if (!test_recipient) return fail("Test recipient is required", 400);
  
  try {
    // Check if mailer is available
    if (!mailAvailable()) {
      return fail("Email service is not configured or available", 503);
    }
    
    // Send test email
    await sendMail({
      to: test_recipient,
      subject: `SMTP Test from OKGS Science Fair`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50;">SMTP Test Successful</h2>
          <p>This is a test email to verify that your SMTP configuration is working correctly.</p>
          <p><strong>SMTP Settings:</strong></p>
          <ul>
            <li><strong>Host:</strong> ${host}</li>
            <li><strong>Port:</strong> ${port}</li>
            <li><strong>From:</strong> ${from_email}</li>
            <li><strong>To:</strong> ${test_recipient}</li>
          </ul>
          <p>If you received this email, your SMTP configuration is working properly.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #7f8c8d; font-size: 12px;">
            This is an automated test email from OKGS Science Fair Management System.
          </p>
        </div>
      `,
      text: `SMTP Test Successful

This is a test email to verify that your SMTP configuration is working correctly.

SMTP Settings:
- Host: ${host}
- Port: ${port}
- From: ${from_email}
- To: ${test_recipient}

If you received this email, your SMTP configuration is working properly.

---
This is an automated test email from OKGS Science Fair Management System.`,
    });
    
    return ok({
      success: true,
      message: "SMTP connection successful! Test email sent.",
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "SMTP test failed";
    return fail(errorMessage, 500);
  }
}