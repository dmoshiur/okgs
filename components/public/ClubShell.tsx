import type { LoadedClub } from "@/lib/club-loader";
import { PublicChrome } from "@/components/public/Chrome";
import { ClubPageHero } from "@/components/public/ClubBlocks";
import { ClubTabs } from "@/components/public/ClubTabs";
import { InternalPageShell, SectionHeader } from "@/components/public/InternalPage";
import type { ClubSectionSlug } from "@/lib/club-data";

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
  return (
    <PublicChrome content={content} active="clubs" internal>
      <InternalPageShell className="club-page-main">
        <ClubPageHero club={club} fallbackImage={data.gallery[0]?.image_url} />
        <div className="page-width club-body" style={{ "--club-accent": club.accent || "#e7c27e" } as React.CSSProperties}>
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
