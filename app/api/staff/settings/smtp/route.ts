import { fail, ok, staff, str } from "@/lib/api";
import { getSetting, setSetting } from "@/lib/portal-db";

export const dynamic = "force-dynamic";

/**
 * Get current SMTP configuration
 */
export async function GET() {
  const guard = await staff();
  if ("status" in guard) return guard;
  
  try {
    const [
      enabled,
      host,
      port,
      secure,
      username,
      from_email,
      from_name,
      test_recipient
    ] = await Promise.all([
      getSetting("smtp_enabled", "false"),
      getSetting("smtp_host", ""),
      getSetting("smtp_port", "587"),
      getSetting("smtp_secure", "false"),
      getSetting("smtp_username", ""),
      getSetting("smtp_from_email", ""),
      getSetting("smtp_from_name", "OKGS Science Fair"),
      getSetting("smtp_test_recipient", ""),
    ]);
    
    return ok({
      enabled: enabled === "true",
      host: host || "",
      port: parseInt(port) || 587,
      secure: secure === "true",
      username: username || "",
      from_email: from_email || "",
      from_name: from_name || "OKGS Science Fair",
      test_recipient: test_recipient || "",
    });
    
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to load SMTP settings", 500);
  }
}

/**
 * Save SMTP configuration
 */
export async function POST(request: Request) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  
  try {
    // Save all SMTP settings
    await Promise.all([
      setSetting("smtp_enabled", str(body.enabled) === "true" ? "true" : "false"),
      setSetting("smtp_host", str(body.host) || ""),
      setSetting("smtp_port", String(body.port || 587)),
      setSetting("smtp_secure", str(body.secure) === "true" ? "true" : "false"),
      setSetting("smtp_username", str(body.username) || ""),
      setSetting("smtp_password", str(body.password) || ""),
      setSetting("smtp_from_email", str(body.from_email) || ""),
      setSetting("smtp_from_name", str(body.from_name) || "OKGS Science Fair"),
      setSetting("smtp_test_recipient", str(body.test_recipient) || ""),
    ]);
    
    // Log activity
    await setSetting("last_smtp_update", new Date().toISOString());
    await setSetting("last_smtp_updated_by", session.user.name);
    
    return ok({
      success: true,
      message: "SMTP configuration saved successfully",
    });
    
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to save SMTP settings", 500);
  }
}