import { NextResponse } from "next/server";
import { clearLegacyCookieHeader, clearPortalCookieHeader } from "@/lib/session";

/**
 * POST /api/auth/logout — ends the session on every surface at once
 * (studio cookie and portal cookie), then answers with the login page to use.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { redirect?: string };
  const response = NextResponse.json({
    ok: true,
    redirect: typeof body.redirect === "string" && body.redirect.startsWith("/") ? body.redirect : "/admin/login",
  });
  response.headers.append("Set-Cookie", clearPortalCookieHeader());
  response.headers.append("Set-Cookie", clearLegacyCookieHeader());
  return response;
}
