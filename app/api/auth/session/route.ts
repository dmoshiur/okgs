import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getPortalSession } from "@/lib/portal-auth";
import { dashboardPathForRole } from "@/lib/roles";

/**
 * GET /api/auth/session — who is signed in?
 *
 * Returns the role and the dashboard that role owns, so a client component can
 * bounce the visitor without shipping the routing rules into the bundle twice.
 */
export async function GET() {
  const admin = await getAdminSession();
  if (admin) {
    return NextResponse.json({
      authenticated: true,
      role: admin.role,
      isSuperAdmin: admin.isSuperAdmin,
      redirect: "/admin",
      user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    });
  }

  const portal = await getPortalSession();
  if (!portal) return NextResponse.json({ authenticated: false, role: null });
  return NextResponse.json({
    authenticated: true,
    role: portal.role,
    isSuperAdmin: false,
    redirect: dashboardPathForRole(portal.role),
    user: { id: portal.user.id, name: portal.user.name, email: portal.user.email, role: portal.role },
  });
}
