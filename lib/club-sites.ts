/**
 * Club sub-sites — server only.
 *
 * Every club has its own folder (`clubs/alssm`, `clubs/alpcg`, …) holding a
 * `club.json` identity file and a `theme.css`. That file is the *default* copy;
 * anything the club admin changes in `/clubs/<slug>/admin` is stored in the
 * `settings` table under `club_site:<slug>` so the repository copy stays intact
 * and the live site can be edited without a deploy.
 *
 * The same content also feeds `alssm.okgs.info` style subdomains — see
 * `middleware.ts`.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getPublicContent } from "@/lib/db";
import { findClub } from "@/lib/club-data";
import { readSetting, setSetting } from "@/lib/site";
import { getPortalSession } from "@/lib/portal-auth";
import { isAdmin } from "@/lib/auth";
import { toLines } from "@/lib/content-config";
import { normalizeHexColor } from "@/lib/club-colors";
import { buildClubPalette, type ClubPalette } from "@/lib/club-palette";
import { logoSwatches } from "@/lib/logo-swatches";
import { DEFAULT_CLUB_SLUGS } from "@/lib/club-slugs";
import { clubSiteHost, clubSiteUrl as buildClubSiteUrl } from "@/lib/club-urls";
import { leadershipCards as buildLeadershipCards, type ClubLeaderCard } from "@/lib/club-leadership";
import type { Club, ClubEvent, ClubMember, ClubPost } from "@/lib/types";

/** Clubs that always exist, even if the folder cannot be read (serverless fs). */
export { DEFAULT_CLUB_SLUGS, isClubSlug } from "@/lib/club-slugs";
export { leadershipCards, leadershipOrder, type ClubLeaderCard } from "@/lib/club-leadership";

export interface ClubGalleryItem {
  url: string;
  caption?: string;
}

export type ClubLeader = ClubLeaderCard;

export interface ClubEventItem {
  title: string;
  date?: string;
  description?: string;
  image_url?: string;
}

export interface ClubContact {
  phone?: string;
  email?: string;
  address?: string;
}

export interface ClubMeeting {
  day?: string;
  time?: string;
  place?: string;
}

export interface ClubFile {
  slug: string;
  name: string;
  name_en: string;
  short_code: string;
  subdomain: string;
  website: string;
  main_site: string;
  facebook: string;
  youtube?: string;
  tagline: string;
  motto: string;
  founded_year: number;
  member_count: number;
  accent: string;
  accent_2: string;
  /** Colours lifted from the logo, most prominent first (see lib/logo-swatches.ts). */
  logo_colors: string[];
  logo_url: string;
  cover_image_url: string;
  about?: string;
  mission: string[];
  objectives: string[];
  events: ClubEventItem[];
  gallery: ClubGalleryItem[];
  leaders: ClubLeader[];
  notice: string;
  contact: ClubContact;
  meeting: ClubMeeting;
}

/** What a club admin can change — stored in the settings table. */
export interface ClubOverride {
  name?: string;
  name_en?: string;
  tagline?: string;
  motto?: string;
  about?: string;
  founded_year?: number;
  member_count?: number;
  mission?: string[];
  objectives?: string[];
  notice?: string;
  logo_url?: string;
  cover_image_url?: string;
  accent?: string;
  accent_2?: string;
  /**
   * The palette the club logo produced. Filled in automatically by the uploader
   * on save, and by the server sampler when it is missing.
   */
  logo_colors?: string[];
  website?: string;
  facebook?: string;
  youtube?: string;
  contact?: ClubContact;
  meeting?: ClubMeeting;
  gallery?: ClubGalleryItem[];
  leaders?: ClubLeader[];
  events?: ClubEventItem[];
  updated_at?: string;
  updated_by?: string;
}

export interface ClubSite extends ClubFile {
  /** Absolute address of this club's own site, e.g. `https://alssm.okgs.info`. */
  url: string;
  /** Host shown on buttons and in the site bar, e.g. `alssm.okgs.info`. */
  host: string;
  /** Live DB row, when the club also exists in the main site's content tables. */
  record: Club | null;
  members: ClubMember[];
  /** Photo cards for the leadership strip (admin entries first, then members). */
  leaders: ClubLeader[];
  clubEvents: ClubEvent[];
  posts: ClubPost[];
  galleryItems: ClubGalleryItem[];
  /** True once an admin has saved anything from the club panel. */
  customized: boolean;
}

const fileCache = new Map<string, ClubFile | null>();

function clubsRoot() {
  return path.join(process.cwd(), "clubs");
}

export async function clubSiteSlugs(): Promise<string[]> {
  try {
    const entries = await readdir(clubsRoot(), { withFileTypes: true });
    const slugs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    if (slugs.length) return slugs.sort();
  } catch {
    /* folder not shipped with the serverless bundle — fall back below */
  }
  return [...DEFAULT_CLUB_SLUGS];
}

/** Synchronous list for the seeder + route validation. */
export function clubSiteSlugsSync(): string[] {
  return [...DEFAULT_CLUB_SLUGS];
}

export async function readClubFile(slug: string): Promise<ClubFile | null> {
  if (!/^[a-z0-9-]{2,24}$/.test(slug)) return null;
  if (fileCache.has(slug)) return fileCache.get(slug) ?? null;
  try {
    const raw = await readFile(path.join(clubsRoot(), slug, "club.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<ClubFile>;
    const file: ClubFile = {
      slug,
      name: parsed.name || slug.toUpperCase(),
      name_en: parsed.name_en || "",
      short_code: parsed.short_code || slug.toUpperCase(),
      subdomain: clubSiteHost(slug, parsed.subdomain),
      website: buildClubSiteUrl({ slug, subdomain: parsed.subdomain, website: parsed.website }),
      main_site: parsed.main_site || "",
      facebook: parsed.facebook || "",
      youtube: parsed.youtube || "",
      tagline: parsed.tagline || "",
      motto: parsed.motto || "",
      founded_year: Number(parsed.founded_year || 0),
      member_count: Number(parsed.member_count || 0),
      accent: parsed.accent || "#0f766e",
      accent_2: parsed.accent_2 || "#eab308",
      logo_colors: hexList(parsed.logo_colors),
      logo_url: parsed.logo_url || "",
      cover_image_url: parsed.cover_image_url || "",
      about: parsed.about || "",
      mission: Array.isArray(parsed.mission) ? parsed.mission : [],
      objectives: Array.isArray(parsed.objectives) ? parsed.objectives : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      gallery: Array.isArray(parsed.gallery) ? parsed.gallery : [],
      leaders: Array.isArray(parsed.leaders) ? parsed.leaders : [],
      notice: parsed.notice || "",
      contact: parsed.contact || {},
      meeting: parsed.meeting || {},
    };
    fileCache.set(slug, file);
    return file;
  } catch {
    fileCache.set(slug, null);
    return null;
  }
}

export async function clubThemeCss(slug: string): Promise<string> {
  if (!/^[a-z0-9-]{2,24}$/.test(slug)) return "";
  try {
    return await readFile(path.join(clubsRoot(), slug, "theme.css"), "utf8");
  } catch {
    return "";
  }
}

export function readOverride(settings: { key: string; value: string }[], slug: string): ClubOverride {
  const raw = readSetting(settings as never, `club_site:${slug}`, "");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ClubOverride;
  } catch {
    return {};
  }
}

/** Keeps only real `#rrggbb` values, most prominent first, capped at 8. */
export function hexList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const list = value.map((item) => normalizeHexColor(item, "")).filter(Boolean);
  return [...new Set(list)].slice(0, 8);
}

function cleanList(value: unknown, fallback: string[]): string[] {
  const list = Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
  return list.length ? list : fallback;
}

/**
 * Picks the list a club site should render: an admin's saved override wins,
 * then what the database holds, and only then the checked-in `club.json` seed.
 *
 * `clubs/<slug>/club.json` is a **first-run seed**, not live content. The old
 * rule used the file whenever no override existed, so a club whose events had
 * been edited in the content studio kept showing the seed event names next to
 * the real ones — and a club admin could never delete them from the studio they
 * had access to. Database rows now displace the seed entirely.
 */
function pickList<T>(override: T[] | undefined, fromDatabase: T[], seed: T[]): T[] {
  if (override !== undefined) return override;
  return fromDatabase.length ? fromDatabase : seed;
}

/** Merges seed → DB row → admin override, with the database ahead of the seed. */
export async function loadClubSite(slug: string): Promise<ClubSite | null> {
  const file = await readClubFile(slug);
  const content = await getPublicContent();
  const record = findClub(content, slug) ?? null;
  if (!file && !record) return null;

  const base: ClubFile =
    file ??
    ({
      slug,
      name: record?.name || slug.toUpperCase(),
      name_en: record?.name_en || "",
      short_code: record?.short_code || slug.toUpperCase(),
      subdomain: clubSiteHost(slug, record?.subdomain),
      website: buildClubSiteUrl({ slug, subdomain: record?.subdomain, website: record?.domain }),
      main_site: "",
      facebook: record?.facebook_url || "",
      youtube: record?.youtube_url || "",
      tagline: record?.tagline || "",
      motto: record?.motto || "",
      founded_year: record?.founded_year || 0,
      member_count: record?.member_count || 0,
      accent: record?.accent || "#0f766e",
      accent_2: "#eab308",
      logo_colors: [],
      logo_url: record?.logo_url || "",
      cover_image_url: record?.cover_image_url || "",
      about: record?.description || "",
      mission: [],
      objectives: [],
      events: [],
      gallery: [],
      leaders: [],
      notice: "",
      contact: { email: record?.email || "" },
      meeting: {},
    } satisfies ClubFile);

  const override = readOverride(content.settings, slug);

  // Database rows for the same club — compiled first so the merge below can
  // prefer them over `club.json` instead of only ever appending to it.
  const members = content.club_members.filter((member) => member.club_slug === slug);
  const clubEvents = content.club_events.filter((event) => event.club_slug === slug);
  const dbEvents: ClubEventItem[] = clubEvents.map((event) => ({
    title: String(event.title || "").trim(),
    date: String(event.event_date || "").trim(),
    description: String(event.description || "").trim(),
    image_url: String(event.image_url || "").trim(),
  }));
  const dbGallery: ClubGalleryItem[] = content.club_gallery
    .filter((item) => item.club_slug === slug)
    .map((item) => ({ url: String(item.image_url || "").trim(), caption: String(item.caption || "") }));

  // Empty strings are dropped so a row with no image does not render a broken tile.
  const dbMission = cleanList(toLines(record?.mission), []);
  const dbObjectives = cleanList(toLines(record?.objectives), []);
  const merged: ClubFile = {
    ...base,
    name: override.name ?? record?.name ?? base.name,
    name_en: override.name_en ?? record?.name_en ?? base.name_en,
    short_code: record?.short_code || base.short_code,
    subdomain: record?.subdomain || base.subdomain,
    website: override.website !== undefined ? override.website : record?.domain || base.website,
    facebook: override.facebook !== undefined ? override.facebook : record?.facebook_url || base.facebook,
    youtube: override.youtube !== undefined ? override.youtube : record?.youtube_url || base.youtube || "",
    tagline: override.tagline !== undefined ? override.tagline : record?.tagline || base.tagline,
    motto: override.motto !== undefined ? override.motto : record?.motto || base.motto,
    founded_year: override.founded_year ?? record?.founded_year ?? base.founded_year,
    member_count: override.member_count ?? record?.member_count ?? base.member_count,
    accent: override.accent || record?.accent || base.accent,
    accent_2: override.accent_2 || base.accent_2,
    logo_colors: override.logo_colors !== undefined ? hexList(override.logo_colors) : base.logo_colors,
    logo_url: override.logo_url !== undefined ? override.logo_url : record?.logo_url || base.logo_url,
    cover_image_url: override.cover_image_url !== undefined ? override.cover_image_url : record?.cover_image_url || record?.image_url || base.cover_image_url,
    about: override.about !== undefined ? override.about : record?.description || base.about || "",
    mission: pickList(override.mission, dbMission, base.mission),
    objectives: pickList(override.objectives, dbObjectives, base.objectives),
    notice: override.notice ?? base.notice,
    contact: { ...base.contact, ...(override.contact || {}) },
    meeting: { ...base.meeting, ...(override.meeting || {}) },
    // An explicitly saved empty list is a deliberate clear and wins. Otherwise
    // the database leads and `club.json` only seeds a club that has no rows yet.
    leaders: pickList(override.leaders, [], base.leaders),
    events: pickList(override.events, dbEvents, base.events),
    gallery: pickList(override.gallery, dbGallery, base.gallery),
  };

  // Built once here, so the page, the API and the studio preview all show the
  // same leadership strip.
  const customized = Boolean(override.updated_at || Object.keys(override).length);
  const leaders = buildLeadershipCards({ customized, leaders: merged.leaders, members });

  const posts = content.club_posts.filter((post) => post.club_slug === slug);

  // `merged.gallery` already carries the database photos (or the seed), so the
  // list is de-duplicated by URL rather than blindly concatenated.
  const galleryItems: ClubGalleryItem[] = [];
  const seenUrls = new Set<string>();
  for (const item of [...merged.gallery, ...dbGallery]) {
    const url = String(item?.url || "").trim();
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    galleryItems.push({ url, caption: item?.caption || "" });
  }

  return {
    ...merged,
    url: buildClubSiteUrl({ slug, subdomain: merged.subdomain, website: merged.website }),
    host: clubSiteHost(merged.slug, merged.subdomain),
    record,
    members,
    leaders,
    clubEvents,
    posts,
    galleryItems,
    customized,
  };
}

/**
 * The colours a club site should be painted with.
 *
 * Priority: a palette saved from the admin panel → a palette sampled from the
 * logo on the server → the stored accent pair. Sampling runs only on club-site
 * routes (never in the directory loop) and is cached, so a slow image host
 * cannot make browsing feel slow.
 */
export async function clubSitePalette(
  site: Pick<ClubFile, "accent" | "accent_2" | "logo_url" | "logo_colors">,
): Promise<ClubPalette> {
  const stored = hexList(site.logo_colors);
  const swatches = stored.length ? stored : hexList(await logoSwatches(site.logo_url));
  return buildClubPalette({ accent: site.accent, accent2: site.accent_2, swatches });
}

export interface ClubGridCard {
  slug: string;
  name: string;
  name_en: string;
  short_code: string;
  tagline: string;
  logo_url: string;
  cover_image_url: string;
  accent: string;
  accent_2: string;
  website: string;
  facebook: string;
  subdomain: string;
  /** Absolute address of the club's own site (`https://alssm.okgs.info`). */
  site_url: string;
}

/** Lightweight cards for the directory and the subdomain landing grid. */
export async function clubCards(): Promise<ClubGridCard[]> {
  const content = await getPublicContent();
  const slugs = await clubSiteSlugs();
  const cards = await Promise.all(
    slugs.map(async (slug) => {
      const site = await loadClubSite(slug);
      if (!site) return null;
      const club = content.clubs.find((row) => row.slug === slug);
      return {
        slug,
        name: site.name,
        name_en: site.name_en,
        short_code: site.short_code,
        tagline: site.tagline,
        logo_url: site.logo_url || club?.logo_url || "",
        cover_image_url: site.cover_image_url || club?.cover_image_url || club?.image_url || "",
        accent: site.accent,
        accent_2: site.accent_2,
        website: site.website,
        facebook: site.facebook,
        subdomain: site.subdomain,
        site_url: buildClubSiteUrl({ slug, subdomain: site.subdomain, website: site.website }),
      } satisfies ClubGridCard;
    }),
  );
  return cards.filter(Boolean) as ClubGridCard[];
}

/** Saves the club panel's changes on top of whatever was stored before. */
export async function saveClubSite(slug: string, patch: ClubOverride, actor?: { name?: string; id?: string }): Promise<ClubOverride> {
  const content = await getPublicContent();
  const existing = readOverride(content.settings, slug);
  const next: ClubOverride = {
    ...existing,
    ...patch,
    contact: { ...(existing.contact || {}), ...(patch.contact || {}) },
    meeting: { ...(existing.meeting || {}), ...(patch.meeting || {}) },
    updated_at: new Date().toISOString(),
    updated_by: actor?.name || existing.updated_by || "",
  };
  await setSetting(`club_site:${slug}`, JSON.stringify(next), {
    label: `${slug} ক্লাব সাইট`,
    field_kind: "json",
    description: "ক্লাব অ্যাডমিন প্যানেল থেকে সংরক্ষিত তথ্য",
  });
  return next;
}

export interface ClubAccess {
  allowed: boolean;
  role: string;
  name: string;
  userId: string;
  /** global admins may manage every club */
  super: boolean;
}

/** Who may edit this club: its own club admin, or a global admin/teacher. */
export async function clubAccess(slug: string): Promise<ClubAccess> {
  const session = await getPortalSession();
  if (session) {
    const superUser = session.role === "admin" || session.role === "teacher";
    const ownClub = session.role === "club" && session.user.club_slug === slug;
    if (superUser || ownClub) {
      return { allowed: true, role: session.role, name: session.user.name, userId: session.user.id, super: superUser };
    }
  }
  if (await isAdmin().catch(() => false)) {
    return { allowed: true, role: "admin", name: "স্টুডিও অ্যাডমিন", userId: "", super: true };
  }
  return { allowed: false, role: "", name: "", userId: "", super: false };
}
