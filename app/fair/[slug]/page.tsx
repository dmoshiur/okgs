import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadContent } from "@/lib/content";
import { PublicChrome } from "@/components/public/Chrome";
import { FairSite } from "@/components/public/FairSite";
import { siteUrl } from "@/lib/schema";
import { listTickers } from "@/lib/portal-db";

type FairPageProps = { params: Promise<{ slug: string }> };

/**
 * The page is rendered per request: the fair's title, dates, logo and every
 * category row come straight from the database, and an edit in the studio has to
 * be visible on the very next visit — never from a cached render.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Slug typed by an admin can carry stray case or whitespace — compare cleanly. */
function canonicalSlug(value: string) {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Resolves the fair for a route parameter.
 *
 * An exact match is used first. Failing that the stored slugs are compared
 * case-insensitively, and a near-match is answered with a permanent redirect to
 * the canonical address rather than a 404 — so renaming a fair in the studio
 * moves the old link instead of breaking it.
 */
async function resolveFair(slug: string) {
  const content = await loadContent();
  const fairs = content.fairs ?? [];
  const exact = fairs.find((item) => item.slug === slug);
  if (exact) return { content, fair: exact, redirectTo: null as string | null };

  const wanted = canonicalSlug(slug);
  const near = fairs.find((item) => canonicalSlug(item.slug) === wanted);
  if (near && near.slug !== slug) return { content, fair: near, redirectTo: `/fair/${near.slug}` };

  return { content, fair: undefined, redirectTo: null as string | null };
}

export async function generateMetadata({ params }: FairPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { fair } = await resolveFair(slug);
  if (!fair) return { title: "মেলা পাওয়া যায়নি" };
  const description = fair.description || fair.tagline || `${fair.name} — ক্যাটাগরি, রুটিন ও নিবন্ধন।`;
  return {
    title: `${fair.name} — ক্যাটাগরি, রুটিন ও নিবন্ধন`,
    description,
    alternates: { canonical: `${siteUrl()}/fair/${fair.slug}` },
    openGraph: { title: fair.name, description, images: fair.cover_image_url ? [fair.cover_image_url] : undefined },
  };
}

export default async function FairPage({ params }: FairPageProps) {
  const { slug } = await params;
  // One request-scoped read: the metadata above and the markup below are built
  // from the same snapshot, so the <title> can never disagree with the heading.
  const { content, fair, redirectTo } = await resolveFair(slug);
  if (redirectTo) redirect(redirectTo);
  if (!fair) notFound();

  const tickers = await listTickers({ fair_slug: fair.slug, activeOnly: true, publicOnly: true, limit: 12 }).catch(() => []);

  return (
    <PublicChrome content={content} active="fair" internal contextLabel={fair.name}>
      <FairSite
        content={content}
        fair={fair}
        tickers={tickers.map((item) => ({ id: item.id, message: item.message, kind: item.kind, category: item.category, name: item.name, class_level: item.class_level, section: item.section }))}
      />
    </PublicChrome>
  );
}
