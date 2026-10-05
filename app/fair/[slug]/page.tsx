import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { PublicChrome } from "@/components/public/Chrome";
import { FairSite } from "@/components/public/FairSite";
import { siteUrl } from "@/lib/schema";
import { listTickers } from "@/lib/portal-db";

type FairPageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: FairPageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = await getPublicContent();
  const fair = content.fairs.find((item) => item.slug === slug);
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
  const content = await getPublicContent();
  const fair = content.fairs.find((item) => item.slug === slug);
  if (!fair) notFound();

  return (
    <PublicChrome content={content} active="fair" internal>

    <PublicChrome content={content} active="fair" internal contextLabel={fair.name}>

      <FairSite content={content} fair={fair} />
    </PublicChrome>
  );
}
