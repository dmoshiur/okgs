import { ArrowRight, ArrowUpRight, CalendarDays, MapPin, Users } from "lucide-react";
import type { ClubSummary } from "@/lib/club-data";
import { clubPath } from "@/lib/club-data";
import { bn, formatMonthDay, relativeDay } from "@/lib/format";
import { IconByName } from "@/lib/icons";
import { SmartBackdrop } from "@/components/public/Media";

/**
 * Club card used on the homepage strip and in the directory.
 * The whole card links to the internal club page via a stretched link, so the
 * optional "own website" link can sit on top as a real second anchor.
 */
export function ClubCard({ summary, variant = "grid" }: { summary: ClubSummary; variant?: "grid" | "row" }) {
  const { club, counts, nextEvent } = summary;
  const href = clubPath(club.slug);
  const accent = club.accent || "#e7c27e";

  return (
    <article
      className={`club-card club-card-${variant}`}
      style={{ "--club-accent": accent } as React.CSSProperties}
    >
      <SmartBackdrop
        className="club-photo"
        src={club.image_url || summary.coverPhoto}
        accent={accent}
        label={club.name}
        transform={{ width: 760, fit: "cover" }}
      >
        <span className="club-icon"><IconByName name={club.icon} size={19} /></span>
        <span className="club-open">ক্লাব পেজ <ArrowUpRight size={13} /></span>
      </SmartBackdrop>

      <div className="club-card-copy">
        <div className="club-card-top">
          <span className="club-index">{bn(Math.max(1, Number(club.sort_order) || 1))}</span>
          <span className="club-card-chip">{club.meeting_day || "সভার দিন নির্ধারিত"}</span>
        </div>
        <h3>
          <a href={href} className="club-card-stretch">{club.name}</a>
        </h3>
        {club.tagline ? <p className="club-tagline">{club.tagline}</p> : null}
        {club.description ? <p>{club.description}</p> : null}

        <div className="club-meta">
          {club.member_count ? <span><Users size={13} /> {bn(club.member_count)} সদস্য</span> : null}
          {counts.events ? <span><CalendarDays size={13} /> {bn(counts.events)} আয়োজন</span> : null}
          {counts.gallery ? <span><ArrowUpRight size={13} /> {bn(counts.gallery)} ছবি</span> : null}
          {club.meeting_place ? <span><MapPin size={13} /> {club.meeting_place}</span> : null}
        </div>

        {nextEvent ? (
          <div className="club-next">
            <span className="club-next-date">{formatMonthDay(nextEvent.event_date)}</span>
            <span className="club-next-title">{nextEvent.title}</span>
            {relativeDay(nextEvent.event_date) ? <span className="club-next-in">{relativeDay(nextEvent.event_date)}</span> : null}
          </div>
        ) : null}

        <div className="club-card-foot">
          <span className="club-link">সব তথ্য দেখুন <ArrowRight size={14} /></span>
          {club.domain ? (
            <a className="club-site-link" href={club.domain} target="_blank" rel="noreferrer">
              নিজস্ব সাইট <ArrowUpRight size={12} />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
