import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_CLUB_SLUGS } from "@/lib/club-slugs";
import { isExemptPath, readMaintenanceFlag } from "@/lib/maintenance";
import { canBypassMaintenance } from "@/lib/session";
import { LEGACY_ADMIN_COOKIE, PORTAL_COOKIE } from "@/lib/session";

/**
 * Middleware — club subdomains and the emergency maintenance lock.
 *
 * Club subdomains → club micro-sites.
 * `alssm.okgs.info/anything` is rewritten to `/clubs/alssm/site/anything`, so a
 * single deployment hosts the main school site *and* all five club sites. Add a
 * wildcard domain (`*.okgs.info`) at the host and every club is live — no extra
 * deploys, no duplicated code. `alssm.localhost` works the same way in dev.
 *
 * Maintenance lock.
 * When the SuperAdmin flips the emergency switch, every public request is
 * rewritten to `/maintenance` — the URL stays as it is, so switching the site
 * back on restores the exact same page. Admin surfaces (`/admin`), API routes and
 * assets stay reachable; admins/superadmins keep full access because they are the
 * ones who have to turn the site back on.
 *
 * Runs on the Node.js runtime so the flag can be read straight from libSQL.
 */
const clubSlugs = new Set<string>(DEFAULT_CLUB_SLUGS);

function subdomainOf(host: string) {
  const clean = host.split(":")[0].toLowerCase();
  const parts = clean.split(".");
  if (parts.length > 2) return parts[0];
  if (parts.length === 2 && parts[1] === "localhost") return parts[0];
  return "";
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sub = subdomainOf(request.headers.get("host") || "");

  /* ------------------------- emergency maintenance ------------------------- */
  if (!isExemptPath(pathname)) {
    const flag = await readMaintenanceFlag();
    if (flag.enabled) {
      const bypass = canBypassMaintenance(
        request.cookies.get(PORTAL_COOKIE)?.value,
        request.cookies.get(LEGACY_ADMIN_COOKIE)?.value,
      );
      if (!bypass) {
        const target = request.nextUrl.clone();
        target.pathname = "/maintenance";
        target.search = "";
        const response = NextResponse.rewrite(target);
        response.headers.set("x-okgs-maintenance", "1");
        response.headers.set("x-okgs-pathname", pathname);
        return response;
      }
    }
  }

  /* ----------------------------- club subdomains ---------------------------- */
  if (!sub || !clubSlugs.has(sub)) {
    const response = NextResponse.next();
    // Server components (the layout fallback gate) read this instead of guessing.
    response.headers.set("x-okgs-pathname", pathname);
    return response;
  }

  // The admin panel, API calls and asset paths stay exactly where they are.
  if (pathname.startsWith(`/clubs/${sub}`) || pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    const response = NextResponse.next();
    response.headers.set("x-okgs-pathname", pathname);
    return response;
  }

  const target = request.nextUrl.clone();
  target.pathname = `/clubs/${sub}/site${pathname === "/" ? "" : pathname}`;
  target.search = search;
  const response = NextResponse.rewrite(target);
  response.headers.set("x-okgs-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api|media|favicon.ico).*)"],
  runtime: "nodejs",
};
