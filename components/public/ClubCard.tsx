import { ArrowRight, CalendarDays, Globe, Images, MapPin, Sparkles, Users } from "lucide-react";
import type { ClubSummary } from "@/lib/club-data";
import { clubPath } from "@/lib/club-data";
import { bn, formatMonthDay, relativeDay } from "@/lib/format";
import { IconByName } from "@/lib/icons";
import { SmartBackdrop } from "@/components/public/Media";
import { normalizeHexColor, readableTextColor } from "@/lib/club-colors";

/**
 * Club card — used on the homepage strip and in the club directory.
 *
 * Two destinations, both explicit: the club's own site on its subdomain
 * (`alssm.okgs.info`) through the accent button, and the club's page inside the
 * school information centre through the quieter link. The card itself is no
 * longer one giant link, so neither button can ever be swallowed by the other.
 */
export function ClubCard({ summary, variant = "grid" }: { summary: ClubSummary; variant?: "grid" | "row" }) {
  const { club, counts, nextEvent, objectives, siteUrl, siteLabel } = summary;
  const href = clubPath(club.slug);
  const accent = normalizeHexColor(club.accent, "#2563eb");
  const blurb = club.tagline || club.description || objectives[0] || "";

  return (
    <article
      className={`club-card club-card-${variant}`}
      style={{
        "--club-accent": accent,
        "--club-accent-text": `color-mix(in srgb, ${accent} 56%, var(--ink))`,
        "--club-accent-ink": readableTextColor(accent),
        "--club-accent-wash": `color-mix(in srgb, ${accent} 10%, var(--surface))`,
        "--club-accent-line": `color-mix(in srgb, ${accent} 26%, var(--line))`,
      } as React.CSSProperties}
    >
      <SmartBackdrop
        className="club-photo"
        src={club.cover_image_url || club.image_url || summary.coverPhoto}
        accent={accent}
        label={club.name}
        transform={{ width: 720, height: 460, fit: "cover" }}
      >
        <span className="club-badge">
          {club.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.logo_url} alt="" loading="lazy" />
          ) : (
            <span className="club-icon" aria-hidden><IconByName name={club.icon} size={19} /></span>
          )}
        </span>
        <span className="club-open">
          <Globe size={13} aria-hidden /> {siteLabel}
        </span>
      </SmartBackdrop>

      <div className="club-card-copy">
        <div className="club-card-top">
          <span className="club-code">{club.short_code || club.slug}</span>
          {club.meeting_day ? <span className="club-card-chip">{club.meeting_day}</span> : null}
        </div>

        <h3>
          <a href={href}>{club.name}</a>
        </h3>

        {club.name_en ? <p className="club-name-en">{club.name_en}</p> : null}
        {blurb ? <p className="club-tagline">{blurb}</p> : null}

        <div className="club-meta">
          {club.member_count ? <span><Users size={13} aria-hidden /> {bn(club.member_count)} সদস্য</span> : null}
          {counts.events ? <span><CalendarDays size={13} aria-hidden /> {bn(counts.events)} আয়োজন</span> : null}
          {counts.gallery ? <span><Images size={13} aria-hidden /> {bn(counts.gallery)} ছবি</span> : null}
          {club.meeting_place ? <span><MapPin size={13} aria-hidden /> {club.meeting_place}</span> : null}
        </div>

        {nextEvent ? (
          <div className="club-next">
            <span className="club-next-date">{formatMonthDay(nextEvent.event_date) || "আসছে"}</span>
            <span className="club-next-title">{nextEvent.title}</span>
            {relativeDay(nextEvent.event_date) ? <span className="club-next-in">{relativeDay(nextEvent.event_date)}</span> : null}
          </div>
        ) : null}

        <span className="club-card-spacer" aria-hidden />

        <div className="club-card-foot">
          <a className="club-site-btn" href={siteUrl} target="_blank" rel="noreferrer noopener">
            <Sparkles size={15} aria-hidden />
            <span>
              <strong>সাইট দেখুন</strong>
              <small>{siteLabel}</small>
            </span>
            <ArrowRight size={14} aria-hidden />
          </a>
          <a className="club-page-link" href={href}>
            ক্লাব পাতা
          </a>
        </div>
      </div>
    </article>
  );
}
