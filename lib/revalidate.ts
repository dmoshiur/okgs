/**
 * Cache revalidation for every database-driven surface.
 *
 * Public pages are `force-dynamic`, so the server re-reads the database on every
 * request — but Next still keeps a **client-side Router Cache** (and, once the
 * app is deployed behind a CDN, an edge cache) for the paths it has already
 * rendered. Without an explicit revalidation an admin can save an edit in the
 * studio, click “Live site”, and be handed the copy of the page the router
 * cached a minute ago.
 *
 * Every route handler that writes content calls `revalidatePublicSite()` so the
 * next navigation (in this tab *and* in any visitor's tab that hits the site
 * afterwards) is served fresh HTML instead of a stale cached render.
 */
import { revalidatePath } from "next/cache";

/**
 * Revalidates the whole public tree.
 *
 * `"/"` with the `"layout"` scope invalidates the root layout — the browser
 * title, favicon, site name, Open Graph tags and theme variables — *and* every
 * nested route beneath it, which is exactly the set of pages that render
 * database content (`/`, `/clubs/*`, `/news/*`, `/fair/*`, `/club-site/*`).
 *
 * Extra concrete paths can be passed for per-route precision; they are
 * revalidated in addition to the tree-wide sweep.
 */
export function revalidatePublicSite(paths: string[] = []) {
  try {
    revalidatePath("/", "layout");
  } catch {
    // `revalidatePath` throws outside a request scope (e.g. a CLI script).
    // Nothing to invalidate there, and the caller's work has already succeeded.
  }

  for (const path of paths) {
    const clean = String(path ?? "").trim();
    if (!clean || clean === "/") continue;
    try {
      revalidatePath(clean);
    } catch {
      /* see above */
    }
  }
}

/**
 * The concrete public paths a record touches, so a save can revalidate just the
 * pages that actually changed (on top of the tree-wide sweep).
 */
export function publicPathsFor(resource: string, row?: Record<string, unknown> | null) {
  const paths: string[] = [];
  const club = row?.club_slug ? String(row.club_slug) : "";
  const slug = row?.slug ? String(row.slug) : "";

  if (club) paths.push(`/clubs/${club}`);
  if (slug) {
    if (resource === "clubs") paths.push(`/clubs/${slug}`);
    if (resource === "news") paths.push(`/news/${slug}`);
    if (resource === "fairs") paths.push(`/fair/${slug}`);
    if (resource === "club_posts" && club) paths.push(`/clubs/${club}/posts/${slug}`);
  }
  if (["clubs", "club_events", "club_posts", "club_gallery", "club_members", "club_achievements"].includes(resource)) {
    paths.push("/clubs");
    if (club) paths.push(`/clubs/${club}/events`, `/clubs/${club}/gallery`, `/clubs/${club}/committee`);
  }
  if (["fairs", "fair_categories", "fair_schedule", "fair_collections"].includes(resource)) {
    paths.push("/fair");
    const fair = row?.fair_slug ? String(row.fair_slug) : "";
    if (fair) paths.push(`/fair/${fair}`);
  }
  if (["notices", "news", "updates", "slides", "banners", "gallery", "stats", "settings", "themes"].includes(resource)) {
    paths.push("/");
  }
  if (resource === "news") paths.push("/news");
  return paths;
}

/**
 * Response headers that stop a browser, proxy or CDN from holding on to a
 * database-driven page. Used by the public JSON endpoints so a value changed in
 * the studio is never answered from a stale cache.
 */
export const noStoreHeaders = { "Cache-Control": "no-store, must-revalidate" } as const;
