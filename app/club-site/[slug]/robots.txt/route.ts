/**
 * The club's own robots.txt.
 *
 * The club site is a public page, but its studio (`/admin` on the club host)
 * is behind a login and has nothing to index. The sitemap line points at the
 * club's own host so crawlers stay on it.
 */
import { loadClubSite } from "@/lib/club-sites";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await loadClubSite(slug);
  if (!site) return new Response("Not found", { status: 404 });

  const body = ["User-agent: *", "Allow: /", "Disallow: /admin", `Sitemap: ${site.url}/sitemap.xml`, ""].join("\n");
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
