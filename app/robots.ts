import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/schema";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    // `/club-site/` is the internal render target of the club subdomains — it is
    // never a public address on this host (see middleware.ts), so crawlers are
    // pointed away from it. Each club publishes its own /robots.txt.
    rules: [{ userAgent: "*", allow: ["/"], disallow: ["/admin", "/api/", "/club-site/", "/clubs/*/site"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
