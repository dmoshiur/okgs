import { permanentRedirect } from "next/navigation";

import { clubSiteUrl } from "@/lib/club-urls";
import { loadClubSite } from "@/lib/club-sites";

export const dynamic = "force-dynamic";

/**
 * The old path-based club site address.
 *
 * Club sites now live on their own subdomain (`alssm.okgs.info`), so anything
 * that still points here — an old bookmark, a search result, a printed QR
 * code — is forwarded to the real address instead of silently breaking.
 */
export default async function LegacyClubSiteRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await loadClubSite(slug);
  permanentRedirect(site ? clubSiteUrl({ slug, subdomain: site.subdomain, website: site.website }) : "/clubs");
}
