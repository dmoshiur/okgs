import { fail, ok, str } from "@/lib/api";
import { clubAccess, hexList, loadClubSite, saveClubSite, type ClubOverride } from "@/lib/club-sites";
import { logActivity } from "@/lib/portal-db";
import { updateRow } from "@/lib/db";
import { normalizeHexColor } from "@/lib/club-colors";
import { logoSwatches } from "@/lib/logo-swatches";
import { revalidatePublicSite } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

const list = (value: unknown, limit = 60) =>
  Array.isArray(value)
    ? value
        .slice(0, limit)
        .map((item) => {
          if (typeof item === "string") return { url: item, caption: "" };
          const row = (item ?? {}) as Record<string, unknown>;
          return {
            url: str(row.url || row.image_url),
            caption: str(row.caption),
          };
        })
        .filter((item) => item.url)
    : undefined;

const leaders = (value: unknown, limit = 40) =>
  Array.isArray(value)
    ? value
        .slice(0, limit)
        .map((item) => {
          const row = (item ?? {}) as Record<string, unknown>;
          return {
            name: str(row.name),
            role: str(row.role),
            class_level: str(row.class_level || row.class_room),
            section: str(row.section),
            phone: str(row.phone),
            email: str(row.email),
            facebook: str(row.facebook || row.facebook_url),
            photo_url: str(row.photo_url),
            bio: str(row.bio),
          };
        })
        .filter((row) => row.name)
    : undefined;

const events = (value: unknown, limit = 60) =>
  Array.isArray(value)
    ? value
        .slice(0, limit)
        .map((item) => {
          const row = (item ?? {}) as Record<string, unknown>;
          return {
            title: str(row.title),
            date: str(row.date || row.achieved_on || row.starts_at),
            description: str(row.description),
            image_url: str(row.image_url),
          };
        })
        .filter((row) => row.title)
    : undefined;

const stringList = (value: unknown, limit = 40) =>
  Array.isArray(value)
    ? value
        .slice(0, limit)
        .map((item) => str(item))
        .filter(Boolean)
    : undefined;

const nonNegativeInteger = (value: unknown, maximum = 1000000) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(0, Math.floor(parsed))) : 0;
};

/** GET /api/clubs/<slug>/site — public club-site data (also feeds the admin panel). */
export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const site = await loadClubSite(slug);
  if (!site) return fail("ক্লাবটি পাওয়া যায়নি।", 404);
  const access = await clubAccess(slug);
  return ok({ site, canEdit: access.allowed, role: access.role });
}

/**
 * POST /api/clubs/<slug>/site — the club admin's save button.
 * Only the club's own admin (or a global admin/teacher) may write.
 */
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const access = await clubAccess(slug);
  if (!access.allowed) return fail("এই ক্লাবটি সম্পাদনা করতে ক্লাব অ্যাডমিন লগইন দরকার।", 401);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = str(body.action || "save");

  if (action === "reset") {
    if (!access.super) return fail("আগের অবস্থায় ফেরানো কেবল প্রধান অ্যাডমিনের কাজ।", 403);
    await saveClubSite(slug, { updated_at: "", updated_by: "" } as ClubOverride, access);
    revalidatePublicSite([`/club-site/${slug}`, `/clubs/${slug}`]);
    return ok({ reset: true });
  }

  const patch: ClubOverride = {};
  const text: Array<keyof ClubOverride> = ["name", "name_en", "tagline", "motto", "about", "notice", "logo_url", "cover_image_url", "accent", "accent_2", "website", "facebook", "youtube"];
  for (const key of text) {
    if (body[key] !== undefined) (patch as Record<string, unknown>)[key] = str(body[key]);
  }
  if (patch.name !== undefined && !patch.name.trim()) return fail("ক্লাবের নাম খালি রাখা যাবে না।", 422);
  if (patch.accent) patch.accent = normalizeHexColor(patch.accent);
  if (patch.accent_2) patch.accent_2 = normalizeHexColor(patch.accent_2);
  if (body.founded_year !== undefined) patch.founded_year = nonNegativeInteger(body.founded_year, new Date().getFullYear());
  if (body.member_count !== undefined) patch.member_count = nonNegativeInteger(body.member_count);

  // The club panel sends the palette it sampled from the uploaded logo.
  if (body.logo_colors !== undefined) {
    patch.logo_colors = Array.isArray(body.logo_colors) ? hexList(body.logo_colors) : [];
  }

  const mission = stringList(body.mission);
  if (mission) patch.mission = mission;
  const objectives = stringList(body.objectives);
  if (objectives) patch.objectives = objectives;

  const gallery = list(body.gallery);
  if (gallery) patch.gallery = gallery;
  const leaderList = leaders(body.leaders);
  if (leaderList) patch.leaders = leaderList;
  const eventList = events(body.events);
  if (eventList) patch.events = eventList;

  if (body.contact && typeof body.contact === "object") {
    const row = body.contact as Record<string, unknown>;
    patch.contact = { phone: str(row.phone), email: str(row.email), address: str(row.address) };
  }
  if (body.meeting && typeof body.meeting === "object") {
    const row = body.meeting as Record<string, unknown>;
    patch.meeting = { day: str(row.day), time: str(row.time), place: str(row.place) };
  }

  if (!Object.keys(patch).length) return fail("সংরক্ষণ করার মতো কিছু পাওয়া যায়নি।", 422);

  // A new logo but no sampled palette (CORS blocked the browser canvas, or the
  // URL was pasted by hand)? Sample it here so the site still re-skins itself.
  if (patch.logo_url !== undefined && patch.logo_colors === undefined && !patch.accent) {
    const sampled = await logoSwatches(patch.logo_url);
    if (sampled.length) patch.logo_colors = sampled;
  }

  const before = await loadClubSite(slug);
  const saved = await saveClubSite(slug, patch, { name: access.name, id: access.userId });

  // Keep the directory and the club's main profile in sync with the micro-site
  // editor. The override remains the source for club-only lists and theme data.
  if (before?.record?.id) {
    const clubPatch: Record<string, string | number> = {};
    if (patch.name !== undefined) clubPatch.name = patch.name;
    if (patch.name_en !== undefined) clubPatch.name_en = patch.name_en;
    if (patch.tagline !== undefined) clubPatch.tagline = patch.tagline;
    if (patch.motto !== undefined) clubPatch.motto = patch.motto;
    if (patch.about !== undefined) clubPatch.description = patch.about;
    if (patch.mission !== undefined) clubPatch.mission = patch.mission.join("\n");
    if (patch.objectives !== undefined) clubPatch.objectives = patch.objectives.join("\n");
    if (patch.founded_year !== undefined) clubPatch.founded_year = patch.founded_year;
    if (patch.member_count !== undefined) clubPatch.member_count = patch.member_count;
    if (patch.logo_url !== undefined) clubPatch.logo_url = patch.logo_url;
    if (patch.cover_image_url !== undefined) clubPatch.cover_image_url = patch.cover_image_url;
    if (patch.accent !== undefined) clubPatch.accent = patch.accent;
    if (patch.website !== undefined) clubPatch.domain = patch.website;
    if (patch.facebook !== undefined) clubPatch.facebook_url = patch.facebook;
    if (patch.youtube !== undefined) clubPatch.youtube_url = patch.youtube;
    if (Object.keys(clubPatch).length) await updateRow("clubs", before.record.id, clubPatch);
  }

  await logActivity({
    actor_id: access.userId,
    actor_name: access.name,
    actor_role: access.role,
    action: "club.site.save",
    entity: "clubs",
    entity_id: slug,
    detail: Object.keys(patch).join(", ").slice(0, 120),
  });

  // The micro-site lives on its own subdomain *and* is linked from the
  // directory; both render from this data, so both are flushed.
  revalidatePublicSite([`/club-site/${slug}`, `/clubs/${slug}`, "/clubs"]);

  const site = await loadClubSite(slug);
  return ok({ saved, site, at: saved.updated_at });
}
