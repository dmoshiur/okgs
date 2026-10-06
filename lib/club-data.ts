import { toLines } from "@/lib/content-config";
import type {
  Club,
  ClubAchievement,
  ClubContent,
  ClubEvent,
  ClubGalleryItem,
  ClubMember,
  ClubPost,
  NewsItem,
  Notice,
  PublicContent,
  SiteSetting,
} from "@/lib/types";
import { isUpcoming } from "@/lib/format";
import { clubSiteLabel, clubSiteUrl } from "@/lib/club-urls";

/** The tab model for a club page — sections are real URLs so they can be shared/indexed. */
export const clubSections = [
  { slug: "", label: "পরিচিতি", key: "overview" },
  { slug: "events", label: "আয়োজন", key: "events" },
  { slug: "gallery", label: "গ্যালারি", key: "gallery" },
  { slug: "members", label: "কমিটি ও সদস্য", key: "members" },
  { slug: "achievements", label: "অর্জন", key: "achievements" },
  { slug: "posts", label: "লেখা ও রিপোর্ট", key: "posts" },
] as const;

export type ClubSectionSlug = (typeof clubSections)[number]["slug"];

export function isClubSection(value: string): value is ClubSectionSlug {
  return clubSections.some((section) => section.slug === value);
}

export function clubPath(slug: string, section: ClubSectionSlug | string = "") {
  const base = `/clubs/${slug}`;
  return section ? `${base}/${section}` : base;
}

export function settingValue(settings: SiteSetting[], key: string, fallback = "") {
  return String(settings.find((setting) => setting.key === key)?.value || fallback);
}

export function activeClubs(content: PublicContent) {
  return [...content.clubs].sort((a, b) => a.sort_order - b.sort_order);
}

export function findClub(content: PublicContent, slug: string) {
  return content.clubs.find((club) => club.slug === slug) ?? null;
}

/** Group every club-scoped row under its club, newest-configured first. */
export function indexByClub<T extends { club_slug: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = String(row.club_slug ?? "");
    if (!key) continue;
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return map;
}

export function buildClubContent(content: PublicContent, club: Club): ClubContent {
  const byDate = (a: { event_date?: string }, b: { event_date?: string }) =>
    String(b.event_date ?? "").localeCompare(String(a.event_date ?? ""));

  const events = [...(content.club_events as ClubEvent[])].filter((item) => item.club_slug === club.slug);
  const [upcoming, past] = [events.filter((item) => isUpcoming(item.event_date)).sort((a, b) => String(a.event_date).localeCompare(String(b.event_date))), events.filter((item) => !isUpcoming(item.event_date)).sort(byDate)];

  return {
    club,
    events: [...upcoming, ...past],
    upcomingEvents: upcoming,
    pastEvents: past,
    posts: (content.club_posts as ClubPost[]).filter((item) => item.club_slug === club.slug),
    gallery: (content.club_gallery as ClubGalleryItem[]).filter((item) => item.club_slug === club.slug),
    members: (content.club_members as ClubMember[]).filter((item) => item.club_slug === club.slug),
    achievements: (content.club_achievements as ClubAchievement[]).filter((item) => item.club_slug === club.slug),
    notices: (content.notices as Notice[]).filter((item) => item.club_slug === club.slug),
    news: (content.news as NewsItem[]).filter((item) => item.club_slug === club.slug),
  };
}

export type ClubCountKey = "events" | "posts" | "gallery" | "members" | "achievements";

export function clubCounts(club: ClubContent): Record<ClubCountKey, number> {
  return {
    events: club.events.length,
    posts: club.posts.length,
    gallery: club.gallery.length,
    members: club.members.length,
    achievements: club.achievements.length,
  };
}

export interface ClubSummary {
  club: Club;
  counts: Record<ClubCountKey, number>;
  nextEvent?: ClubEvent;
  coverPhoto?: string;
  objectives: string[];
  /** The club's own site — `https://alssm.okgs.info` — never a path on this one. */
  siteUrl: string;
  /** The address printed on buttons, e.g. `alssm.okgs.info`. */
  siteLabel: string;
}

/** Everything a card needs, without rendering a full club page. */
export function summarizeClub(content: PublicContent, club: Club): ClubSummary {
  const data = buildClubContent(content, club);
  const coverPhoto =
    data.club.cover_image_url || data.club.image_url || data.gallery[0]?.image_url || data.posts[0]?.image_url || "";
  return {
    club,
    counts: clubCounts(data),
    nextEvent: data.upcomingEvents[0],
    coverPhoto,
    objectives: toLines(club.objectives),
    siteUrl: clubSiteUrl({ slug: club.slug, subdomain: club.subdomain, website: club.domain }),
    siteLabel: clubSiteLabel({ slug: club.slug, subdomain: club.subdomain, website: club.domain }),
  };
}

export function summarizeAll(content: PublicContent) {
  return activeClubs(content).map((club) => summarizeClub(content, club));
}

export function clubHighlights(club: Club) {
  return [
    club.founded_year ? { label: "যাত্রা শুরু", value: String(club.founded_year) } : null,
    club.member_count ? { label: "সদস্য", value: `${club.member_count}+` } : null,
    club.meeting_day ? { label: "সভার দিন", value: club.meeting_day } : null,
    club.meeting_place ? { label: "স্থান", value: club.meeting_place } : null,
  ].filter(Boolean) as { label: string; value: string }[];
}
