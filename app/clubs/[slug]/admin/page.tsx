import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClubStudio } from "@/components/club/ClubStudio";
import { clubAccess, loadClubSite } from "@/lib/club-sites";

export const dynamic = "force-dynamic";

type ClubAdminProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ClubAdminProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadClubSite(slug);
  return {
    title: site ? `${site.name} — ক্লাব স্টুডিও` : "ক্লাব স্টুডিও",
    robots: { index: false, follow: false },
  };
}

/**
 * The club studio.
 *
 * Reached either from the information centre (`/clubs/<slug>/admin`) or from the
 * club's own address (`<slug>.okgs.info/admin`, rewritten by middleware.ts).
 * The site row and the visitor's permission are resolved on the server, so the
 * studio paints its real content on the first byte instead of flashing a
 * spinner — and the client only refetches when it saves.
 */
export default async function ClubAdminPage({ params }: ClubAdminProps) {
  const { slug } = await params;
  const site = await loadClubSite(slug);
  if (!site) notFound();
  const access = await clubAccess(slug);
  return <ClubStudio slug={slug} initialSite={site} initialCanEdit={access.allowed} initialRole={access.role} />;
}
