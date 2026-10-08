import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicContent } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { activeFair, fairMode, readFlag, readSetting } from "@/lib/site";
import { settingValue } from "@/lib/club-data";
import { FairConsole } from "@/components/sf/FairConsole";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Science Fair console",
  robots: { index: false, follow: false },
};

/** /sf — the science-fair console. Students are sent to their own dashboard. */
export default async function ConsolePage() {
  const session = await getPortalSession();
  if (!session) redirect("/sf/login?next=/sf");
  if (!isStaffRole(session.role)) redirect("/me");

  const content = await getPublicContent();
  const mode = fairMode(content.settings);
  const fair = activeFair(content, mode.slug);
  const categories = Array.from(
    new Set((content.fair_categories ?? []).filter((item) => !fair || !item.fair_slug || item.fair_slug === fair.slug).map((item) => item.name)),
  );

  return (
    <FairConsole
      user={session.user}
      role={session.role}
      fairs={content.fairs}
      themes={content.themes}
      activeFairSlug={fair?.slug ?? ""}
      mode={mode.mode}
      bannerEnabled={readFlag(content.settings, "fair_banner_enabled", true)}
      registrationOpen={readFlag(content.settings, "fair_registration_open", true)}
      categories={categories}
      clubs={content.clubs.map((club) => ({ slug: club.slug, name: club.name }))}
      schoolName={settingValue(content.settings, "site_name", "OKGS")}
      logo={readSetting(content.settings, "logo_url")}
    />
  );
}
