import { fail, ok, str } from "@/lib/api";
import { clubAccess, loadClubSite, saveClubSite, type ClubOverride } from "@/lib/club-sites";
import { logActivity } from "@/lib/portal-db";

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
    return ok({ reset: true });
  }

  const patch: ClubOverride = {};
  const text: Array<keyof ClubOverride> = ["name", "name_en", "tagline", "motto", "about", "notice", "logo_url", "cover_image_url", "accent", "accent_2", "website", "facebook", "youtube"];
  for (const key of text) {
    if (body[key] !== undefined) (patch as Record<string, unknown>)[key] = str(body[key]);
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

  const saved = await saveClubSite(slug, patch, { name: access.name, id: access.userId });
  await logActivity({
    actor_id: access.userId,
    actor_name: access.name,
    actor_role: access.role,
    action: "club.site.save",
    entity: "clubs",
    entity_id: slug,
    detail: Object.keys(patch).join(", ").slice(0, 120),
  });

  const site = await loadClubSite(slug);
  return ok({ saved, site, at: saved.updated_at });
}
