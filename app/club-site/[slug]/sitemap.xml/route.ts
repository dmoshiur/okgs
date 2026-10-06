/**
 * The club's own sitemap.
 *
 * Served from the club's host (`alssm.okgs.info/sitemap.xml`) so search engines
 * treat the club site as its own property instead of a stray directory of the
 * school site. The club is a one-page site, so the entry list is short — the
 * school's sitemap lives on the main domain.
 */
import { loadClubSite } from "@/lib/club-sites";

export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] || char);
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await loadClubSite(slug);
  if (!site) return new Response("Not found", { status: 404 });

  const today = new Date().toISOString().slice(0, 10);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "  <url>",
    `    <loc>${escapeXml(site.url)}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    "    <changefreq>weekly</changefreq>",
    "    <priority>1.0</priority>",
    "  </url>",
    "</urlset>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
