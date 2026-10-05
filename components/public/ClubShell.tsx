import type { LoadedClub } from "@/lib/club-loader";
import { PublicChrome } from "@/components/public/Chrome";
import { ClubPageHero } from "@/components/public/ClubBlocks";
import { ClubTabs } from "@/components/public/ClubTabs";
import { InternalPageShell, SectionHeader } from "@/components/public/InternalPage";
import type { ClubSectionSlug } from "@/lib/club-data";

import { clubSections, type ClubSectionSlug } from "@/lib/club-data";
import { normalizeHexColor, readableTextColor } from "@/lib/club-colors";


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
  const accent = normalizeHexColor(club.accent, "#2563eb");
  return (
    <PublicChrome content={content} active="clubs" internal>
      <InternalPageShell className="club-page-main">
        <ClubPageHero club={club} fallbackImage={data.gallery[0]?.image_url} />
        <div className="page-width club-body" style={{ "--club-accent": club.accent || "#e7c27e" } as React.CSSProperties}>

    <PublicChrome content={content} active="clubs" internal contextLabel={`${club.name} · ${sectionLabel}`}>
      <InternalPageShell className="club-page-main">
        <ClubPageHero club={club} fallbackImage={data.gallery[0]?.image_url} />
        <div
          className="page-width club-body"
          style={{
            "--club-accent": accent,
            "--club-accent-text": `color-mix(in srgb, ${accent} 56%, var(--ink))`,
            "--club-accent-ink": readableTextColor(accent),
            "--club-accent-wash": `color-mix(in srgb, ${accent} 10%, var(--surface))`,
            "--club-accent-line": `color-mix(in srgb, ${accent} 26%, var(--line))`,
          } as React.CSSProperties}
      
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
