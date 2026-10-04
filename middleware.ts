import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_CLUB_SLUGS } from "@/lib/club-slugs";

/**
 * Club subdomains → club micro-sites.
 *
 * `alssm.okgs.info/anything` is rewritten to `/clubs/alssm/site/anything`, so a
 * single deployment hosts the main school site *and* all five club sites. Add a
 * wildcard domain (`*.okgs.info`) at the host and every club is live — no extra
 * deploys, no duplicated code. `alssm.localhost` works the same way in dev.
 */
const clubSlugs = new Set<string>(DEFAULT_CLUB_SLUGS);

function subdomainOf(host: string) {
  const clean = host.split(":")[0].toLowerCase();
  const parts = clean.split(".");
  if (parts.length > 2) return parts[0];
  if (parts.length === 2 && parts[1] === "localhost") return parts[0];
  return "";
}

export function middleware(request: NextRequest) {
  const sub = subdomainOf(request.headers.get("host") || "");
  if (!sub || !clubSlugs.has(sub)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  // The admin panel, API calls and asset paths stay exactly where they are.
  if (pathname.startsWith(`/clubs/${sub}`) || pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const target = request.nextUrl.clone();
  target.pathname = `/clubs/${sub}/site${pathname === "/" ? "" : pathname}`;
  target.search = search;
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api|media|favicon.ico).*)"],
};
