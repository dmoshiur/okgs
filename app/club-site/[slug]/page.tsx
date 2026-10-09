import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { ClubSiteView } from "@/components/club/ClubSiteView";
import { JsonLd } from "@/components/public/JsonLd";
import { clubSitePalette, clubThemeCss, loadClubSite } from "@/lib/club-sites";
import { clubSiteSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://okgs.info";

type ClubSiteRouteProps = { params: Promise<{ slug: string }> };

/**
 * The club micro-site.
 *
 * Reachable only through a club's own subdomain — `middleware.ts` rewrites
 * `alssm.okgs.info/*` here. Asking for `/club-site/alssm` on the main domain is
 * forwarded to that club's page in the information centre, so the club site
 * keeps exactly one public address.
 */
export async function generateMetadata({ params }: ClubSiteRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadClubSite(slug);
  if (!site) return { title: "ক্লাব সাইট পাওয়া যায়নি", robots: { index: false, follow: false } };

  const image = site.cover_image_url || site.logo_url;
  const description = site.tagline || site.about || `${site.name} — আয়োজন, সদস্য, ছবি ও যোগাযোগের তথ্য।`;
  return {
    metadataBase: new URL(site.url || siteUrl),
    title: { default: site.name, template: `%s | ${site.name}` },
    description,
    applicationName: site.name,
    alternates: { canonical: site.url || siteUrl },
    openGraph: {
      title: site.name,
      description,
      url: site.url || siteUrl,
      siteName: site.name,
      locale: "bn_BD",
      type: "website",
      images: image ? [image] : undefined,
    },
    twitter: { card: "summary_large_image", title: site.name, description, images: image ? [image] : undefined },
  };
}

/** The phone's address bar wears the club's colour, not the school's. */
export async function generateViewport({ params }: ClubSiteRouteProps): Promise<Viewport> {
  const { slug } = await params;
  const site = await loadClubSite(slug);
  if (!site) return {};
  const palette = await clubSitePalette(site);
  return { themeColor: palette.deep };
}

export default async function ClubSiteRoute({ params }: ClubSiteRouteProps) {
  const { slug } = await params;
  const site = await loadClubSite(slug);
  if (!site) notFound();

  const [palette, css] = await Promise.all([clubSitePalette(site), clubThemeCss(slug)]);
  const url = site.url || siteUrl;

  return (
    <>
      {/* The club's own structured data — its events are filed under its own host. */}
      <JsonLd
        schema={clubSiteSchema({
          name: site.name,
          url,
          tagline: site.tagline,
          about: site.about,
          logo_url: site.logo_url,
          cover_image_url: site.cover_image_url,
          email: site.contact?.email || site.record?.email,
          phone: site.contact?.phone,
          founded_year: site.founded_year,
          facebook: site.facebook,
          youtube: site.youtube,
          events: site.clubEvents.map((event) => ({
            title: event.title,
            date: event.event_date,
            description: event.description,
            image_url: event.image_url,
          })),
        })}
      />
      <ClubSiteView site={site} palette={palette} themeCss={css} />
    </>
  );
}
