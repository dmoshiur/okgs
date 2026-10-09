import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_CLUB_SLUGS } from "@/lib/club-slugs";
import { clubSiteHost } from "@/lib/club-urls";
import { isExemptPath, readMaintenanceFlag } from "@/lib/maintenance";
import { canBypassMaintenance } from "@/lib/session";
import { LEGACY_ADMIN_COOKIE, PORTAL_COOKIE } from "@/lib/session";

/**
 * Middleware — club subdomains and the emergency maintenance lock.
 *
 * Club subdomains → club micro-sites.
 * `alssm.okgs.info/anything` is rewritten to `/club-site/alssm`, so a single
 * deployment hosts the main school site *and* all five club sites. Add a
 * wildcard domain (`*.okgs.info`) at the host and every club is live
 * immediately — no extra deploys, no duplicated code. `alssm.localhost` works
 * the same way in dev.
 *
 * The club site has exactly one public address: its subdomain. `/club-site/*`
 * is an internal render target — asking for it on the main domain simply
 * forwards to that club's page in the information centre. `/clubs/<slug>/site`
 * (the old path-based address) is a permanent redirect handled by the route.
 *
 * On a club subdomain, `/admin` opens that club's studio directly:
 * `alssm.okgs.info/admin` → `/clubs/alssm/admin`.
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

const slugPattern = /^[a-z0-9-]{2,24}$/;

/**
 * Routes whose HTML is assembled from the database on every request.
 *
 * A dynamic render is not enough on its own: Next answers one with
 * `Cache-Control: no-cache, must-revalidate`, which still allows a browser or an
 * edge cache to hold the body and revalidate it later — so an admin edit can
 * lag behind what a visitor sees. `no-store` removes that window entirely.
 */
const dynamicPublicRoutes = [
  /^\/$/,
  /^\/clubs(?:\/|$)/,
  /^\/news(?:\/|$)/,
  /^\/fair(?:\/|$)/,
  /^\/club-site(?:\/|$)/,
  /^\/entry(?:\/|$)/,
  /^\/pass(?:\/|$)/,
  /^\/me\/?$/,
  /^\/sitemap\.xml$/,
  /^\/robots\.txt$/,
];

function isDynamicPublicPath(pathname: string) {
  return dynamicPublicRoutes.some((pattern) => pattern.test(pathname));
}

function subdomainOf(host: string) {
  const clean = host.split(":")[0].toLowerCase();
  const parts = clean.split(".");
  if (parts.length > 2) return parts[0];
  if (parts.length === 2 && parts[1] === "localhost") return parts[0];
  return "";
}

function withPathHeader(pathname: string, response: NextResponse) {
  // Server components (the layout fallback gate) read this instead of guessing.
  response.headers.set("x-okgs-pathname", pathname);
  if (isDynamicPublicPath(pathname)) {
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    response.headers.set("CDN-Cache-Control", "no-store");
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sub = subdomainOf(request.headers.get("host") || "");
  const club = sub && clubSlugs.has(sub) ? sub : "";

  /* ------------------- internal club-site path, never public ----------------- */
  // `/club-site/<slug>` only exists so middleware can render a club on its own
  // subdomain. On the main domain it forwards to that club's page, so the club
  // site is reachable at one address and one address only.
  if (/^\/club-site(\/|$)/.test(pathname) && !club) {
    const slug = pathname.split("/")[2] || "";
    const target = request.nextUrl.clone();
    target.pathname = slugPattern.test(slug) ? `/clubs/${slug}` : "/clubs";
    target.search = "";
    return NextResponse.redirect(target, 308);
  }

  /* ---------------------- the old path-based club site --------------------- */
  // `/clubs/<slug>/site` was the public club address before every club moved to
  // its own subdomain. The route still forwards, but a route-level redirect
  // cannot set a status once the streamed shell has gone out, so the answer is
  // given here — a real 308, no JavaScript required, for a bookmark, a search
  // result or a printed QR code that still points at the old shape.
  const legacy = /^\/clubs\/([a-z0-9-]{2,24})\/site(\/|$)/.exec(pathname);
  if (legacy) {
    const target = request.nextUrl.clone();
    target.pathname = "/";
    target.search = "";
    const host = request.headers.get("host") || "";
    const local = /^(?:[a-z0-9-]+\.)?(localhost|127\.0\.0\.1|\[[^\]]+\])(:\d+)?$/i.test(host);
    target.protocol = local ? "http:" : "https:";
    // On a club's own address the redirect stays on that host; from the school
    // site it hands over to the club's subdomain.
    target.host = club ? host : local ? `${legacy[1]}.${host}` : clubSiteHost(legacy[1]);
    return NextResponse.redirect(target, 308);
  }

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
        response.headers.set("Cache-Control", "no-store, must-revalidate");
        return response;
      }
    }
  }

  /* ----------------------------- club subdomains ---------------------------- */
  if (!club) {
    return withPathHeader(pathname, NextResponse.next());
  }

  // API calls and asset paths stay exactly where they are, so the studio and the
  // admin panel keep working when they are opened from the club's own address.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/media/") ||
    pathname.startsWith("/clubs/")
  ) {
    return withPathHeader(pathname, NextResponse.next());
  }

  const target = request.nextUrl.clone();
  target.search = search;

  // The club's own sitemap/robots live on the club's host so search engines
  // treat it as its own property (see app/club-site/[slug]/sitemap.xml).
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
    target.pathname = `/club-site/${club}${pathname}`;
    return withPathHeader(pathname, NextResponse.rewrite(target));
  }

  // `alssm.okgs.info/admin` — the club's own studio, one keystroke away.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    target.pathname = `/clubs/${club}/admin${pathname.slice("/admin".length)}`;
    return withPathHeader(pathname, NextResponse.rewrite(target));
  }

  // Everything else is the micro-site itself: a one-page site, so the path only
  // decides which anchor the browser jumps to (`alssm.okgs.info/#events`).
  target.pathname = `/club-site/${club}`;
  return withPathHeader(pathname, NextResponse.rewrite(target));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api|media|favicon.ico).*)"],
  runtime: "nodejs",
};
