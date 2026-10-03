import type { MetadataRoute } from "next";
import { getPublicContent } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getPublicContent();
  const base = "https://okgs.info";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/news`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    ...content.news.map((story) => ({ url: `${base}/news/${story.slug}`, lastModified: new Date(story.updated_at), changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
