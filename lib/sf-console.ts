/**
 * Server-side props for every Science Fair panel route.
 *
 * `/sf`, `/sf/students`, `/sf/reports` … all render the same shell, so the guard
 * (staff session), the fair resolution (cookie preference → configured fair) and
 * the content lookup live here once instead of being copied into every route.
 */
import { redirect } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { activeFair, fairMode, readFlag, readSetting } from "@/lib/site";
import { settingValue } from "@/lib/club-data";
import { readFairPreference } from "@/lib/sf-preference";
import { ticketSchoolName } from "@/lib/ticket-locale";
import type { PublicUser } from "@/lib/portal-db";
import type { PortalRole } from "@/lib/roles";
import type { Fair, SiteTheme } from "@/lib/types";
import type { SfSectionId } from "@/components/sf/sections";

export interface SfConsoleProps {
  tab: SfSectionId;
  user: PublicUser;
  role: PortalRole;
  fairs: Fair[];
  themes: SiteTheme[];
  activeFairSlug: string;
  mode: "school" | "fair";
  bannerEnabled: boolean;
  registrationOpen: boolean;
  categories: string[];
  clubs: { slug: string; name: string }[];
  schoolName: string;
  logo: string;
  fairName: string;
}

/**
 * Guards a panel route and collects the props its shell needs.
 *
 * A signed-out visitor is sent to the sign-in door with `next` pointing back at
 * the section they asked for; a non-staff account is sent to its own dashboard.
 */
export async function sfConsoleProps(section: SfSectionId): Promise<SfConsoleProps> {
  const target = section === "dashboard" ? "/sf" : `/sf/${section}`;
  const session = await getPortalSession();
  if (!session) redirect(`/sf/login?next=${encodeURIComponent(target)}`);
  if (!isStaffRole(session.role)) redirect("/me");

  const content = await getPublicContent();
  const mode = fairMode(content.settings);
  // The administrator's own last choice wins, then the configured fair mode.
  const preference = await readFairPreference();
  const fair = activeFair(content, preference || mode.slug);
  const categories = Array.from(
    new Set((content.fair_categories ?? []).filter((item) => !fair || !item.fair_slug || item.fair_slug === fair.slug).map((item) => item.name)),
  );

  return {
    tab: section,
    user: session.user,
    role: session.role,
    fairs: content.fairs,
    themes: content.themes,
    activeFairSlug: fair?.slug ?? "",
    mode: mode.mode,
    bannerEnabled: readFlag(content.settings, "fair_banner_enabled", true),
    registrationOpen: readFlag(content.settings, "fair_registration_open", true),
    categories,
    clubs: content.clubs.map((club) => ({ slug: club.slug, name: club.name })),
    schoolName: ticketSchoolName(readSetting(content.settings, "site_name_en") || settingValue(content.settings, "site_name")),
    logo: readSetting(content.settings, "logo_url"),
    fairName: fair?.name ?? "Science Fair",
  };
}
