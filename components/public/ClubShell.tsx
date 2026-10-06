import type { LoadedClub } from "@/lib/club-loader";
import { PublicChrome } from "@/components/public/Chrome";
import { ClubPageHero } from "@/components/public/ClubBlocks";
import { ClubTabs } from "@/components/public/ClubTabs";
import { InternalPageShell, SectionHeader } from "@/components/public/InternalPage";
import { clubSections, type ClubSectionSlug } from "@/lib/club-data";
import { buildClubPalette } from "@/lib/club-colors";

/** Shared frame for /clubs/[slug] and every section page. */
export function ClubShell({
  loaded,
  section,
  children,
}: {
  loaded: LoadedClub;
  section: ClubSectionSlug;
  children: React.ReactNode;
}) {
  const { content, club, data } = loaded;
  const sectionLabel = clubSections.find((item) => item.slug === section)?.label || "পরিচিতি";
  // The published tokens are the `-base`/`-bright` pair; globals.css maps
  // `--club-accent` from them, so a dark surface gets the brighter twin.
  const clubVars = buildClubPalette({ accent: club.accent }).vars;
  return (
    <PublicChrome content={content} active="clubs" internal contextLabel={`${club.name} · ${sectionLabel}`}>
      <InternalPageShell className="club-page-main">
        <ClubPageHero club={club} fallbackImage={data.gallery[0]?.image_url} />
        <div
          className="page-width club-body"
          style={clubVars as React.CSSProperties}
        >
          {section ? <ClubTabs club={club} active={section} /> : null}
          {children}
        </div>
      </InternalPageShell>
    </PublicChrome>
  );
}

export function ClubSectionTitle({ eyebrow, title, intro, action }: { eyebrow: string; title: string; intro?: string; action?: React.ReactNode }) {
  return <SectionHeader className="club-section-head" eyebrow={eyebrow} title={title} intro={intro} action={action} />;
}
