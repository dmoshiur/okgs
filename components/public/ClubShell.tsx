import type { LoadedClub } from "@/lib/club-loader";
import { PublicChrome } from "@/components/public/Chrome";
import { ClubPageHero } from "@/components/public/ClubBlocks";
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
    <PublicChrome content={content} active="clubs">
      <div className="club-page-main">
        <ClubPageHero club={club} content={data} active={section} />
        <div className="page-width club-body" style={{ "--club-accent": club.accent || "#e7c27e" } as React.CSSProperties}>
          {children}
        </div>
      </div>
    </PublicChrome>
  );
}

export function ClubSectionTitle({ eyebrow, title, intro, action }: { eyebrow: string; title: string; intro?: string; action?: React.ReactNode }) {
  return (
    <header className="club-section-head">
      <div>
        <p className="eyebrow"><span className="eyebrow-dot" />{eyebrow}</p>
        <h2>{title}</h2>
        {intro ? <p className="club-section-intro">{intro}</p> : null}
      </div>
      {action}
    </header>
  );
}
