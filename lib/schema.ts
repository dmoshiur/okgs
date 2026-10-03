/** Structured data for an information site — helps Google show club pages as rich results. */
import type { Club, ClubEvent, NewsItem, SiteSetting } from "@/lib/types";
import { settingValue } from "@/lib/club-data";

/** Canonical origin for every absolute URL the site emits (sitemap, robots, JSON-LD). */
export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://okgs.info").replace(/\/$/, "");
}

const site = siteUrl;

export function organizationSchema(settings: SiteSetting[]) {
  return {
    "@context": "https://schema.org",
    "@type": "School",
    name: settingValue(settings, "site_name", "ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি"),
    alternateName: settingValue(settings, "short_name", "OKGS"),
    url: site(),
    email: settingValue(settings, "email") || undefined,
    telephone: settingValue(settings, "phone") || undefined,
    foundingDate: "2003-01-01",
    address: {
      "@type": "PostalAddress",
      streetAddress: settingValue(settings, "address", "কালাই সদর"),
      addressLocality: "কালাই",
      addressRegion: "রাজশাহী",
      addressCountry: "BD",
    },
    sameAs: [settingValue(settings, "facebook_url"), settingValue(settings, "youtube_url")].filter(Boolean),
  };
}

export function clubSchema(club: Club, events: ClubEvent[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: club.name,
    description: club.description || club.tagline,
    url: `${site()}/clubs/${club.slug}`,
    foundingDate: club.founded_year ? String(club.founded_year) : undefined,
    logo: club.image_url || undefined,
    image: club.cover_image_url || undefined,
    email: club.email || undefined,
    telephone: club.coordinator_phone || undefined,
    memberOf: { "@type": "Organization", name: "ওমর কিন্ডারগার্টেন স্কুল" },
    event: events.slice(0, 8).map((event) => ({
      "@type": "Event",
      name: event.title,
      startDate: event.event_date,
      endDate: event.event_date,
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      location: { "@type": "Place", name: event.venue || "ওমর কিন্ডারগার্টেন স্কুল" },
      image: event.image_url || undefined,
      description: event.description || undefined,
      organizer: { "@type": "Organization", name: club.name },
    })),
  };
}

export function newsArticleSchema(item: NewsItem, club?: Club) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: item.title,
    description: item.excerpt,
    image: item.image_url ? [item.image_url] : undefined,
    datePublished: item.published_at,
    dateModified: item.updated_at || item.published_at,
    author: { "@type": "Organization", name: item.author || "ওকেজিএস বার্তা" },
    publisher: { "@type": "Organization", name: "ওমর কিন্ডারগার্টেন স্কুল" },
    mainEntityOfPage: `${site()}/news/${item.slug}`,
    ...(club ? { about: { "@type": "Organization", name: club.name, url: `${site()}/clubs/${club.slug}` } } : {}),
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${site()}${item.url}`,
    })),
  };
}
