import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadClubSite } from "@/lib/club-sites";
import { ClubSiteAdmin } from "@/components/club/ClubSiteAdmin";

export const dynamic = "force-dynamic";

type ClubAdminProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ClubAdminProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadClubSite(slug);
  return {
    title: site ? `${site.name} — ক্লাব অ্যাডমিন` : "ক্লাব অ্যাডমিন",
    robots: { index: false, follow: false },
  };
}

export default async function ClubAdminPage({ params }: ClubAdminProps) {
  const { slug } = await params;
  const site = await loadClubSite(slug);
  if (!site) notFound();
  return <ClubSiteAdmin slug={slug} />;
}
