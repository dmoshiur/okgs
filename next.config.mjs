/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dev-server origins that are allowed to call the app. The e2b wildcard keeps
  // the live preview working; the okgs.info ones let real club subdomains
  // (alssm.okgs.info…) hit the same dev/prod build.
  allowedDevOrigins: [
    "*.e2b.app",
    "*.okgs.info",
    "omarkgschool.com",
    "*.localhost",
    "localhost",
    "127.0.0.1",
  ],
  /**
   * Dynamic routes must never be answered from a browser, proxy or CDN cache.
   *
   * Every public page already renders with `dynamic = "force-dynamic"`, so the
   * server re-reads the database on each request — but the default response for
   * a dynamic render is `Cache-Control: no-cache, must-revalidate`, which still
   * lets a shared cache hold the body and revalidate it in the background. An
   * admin who renames a fair or swaps a hero image then sees the old copy for
   * as long as that cache lives. `no-store` closes the gap: the HTML for these
   * routes is always fetched again.
   *
   * Static assets are deliberately excluded — `_next/static`, `/media/*` and the
   * icon are content-hashed or versioned and should stay cacheable.
   */
  async headers() {
    const noStore = [
      { key: "Cache-Control", value: "no-store, must-revalidate" },
      { key: "CDN-Cache-Control", value: "no-store" },
      { key: "Vercel-CDN-Cache-Control", value: "no-store" },
    ];
    const dynamicRoutes = [
      "/",
      "/clubs",
      "/clubs/:slug",
      "/clubs/:slug/:section",
      "/clubs/:slug/posts/:postSlug",
      "/news",
      "/news/:slug",
      "/fair",
      "/fair/:slug",
      "/club-site/:slug",
      "/entry/:token",
      "/pass/:token",
      "/me",
      "/sitemap.xml",
      "/robots.txt",
    ];
    return dynamicRoutes.map((source) => ({ source, headers: noStore }));
  },
};

export default nextConfig;
