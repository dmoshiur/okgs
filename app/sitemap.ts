import type { MetadataRoute } from "next";
import { getPublicContent } from "@/lib/db";
import { clubSections, clubPath } from "@/lib/club-data";
import { siteUrl } from "@/lib/schema";

export const dynamic = "force-dynamic";

/** Clubs are the heart of this site, so they carry the highest priority. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getPublicContent();
  const base = siteUrl();
  const today = new Date();
  const entry = (path: string, updated?: string, change: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly", priority = 0.6): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`,
    lastModified: updated ? new Date(updated) : today,
    changeFrequency: change,
    priority,
  });

  const clubPages = content.clubs.flatMap((club) => [
    entry(clubPath(club.slug), club.updated_at, "weekly", 0.9),
    ...clubSections
      .filter((section) => section.slug)
      .map((section) => entry(clubPath(club.slug, section.slug), club.updated_at, "monthly", 0.7)),
    ...content.club_posts
      .filter((post) => post.club_slug === club.slug)
      .map((post) => entry(`/clubs/${club.slug}/posts/${post.slug}`, post.updated_at, "yearly", 0.5)),
  ]);

  return [
    entry("", undefined, "daily", 1),
    entry("/clubs", undefined, "daily", 0.9),
    entry("/news", undefined, "weekly", 0.8),
    ...clubPages,
    ...content.news.map((story) => entry(`/news/${story.slug}`, story.updated_at, "monthly", 0.6)),
  ];
}
