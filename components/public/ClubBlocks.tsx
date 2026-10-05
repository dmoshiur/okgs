import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Facebook,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import type { Club, ClubAchievement, ClubContent, ClubEvent, ClubMember, ClubPost, NewsItem, Notice } from "@/lib/types";
import { clubHighlights, clubPath, type ClubSectionSlug } from "@/lib/club-data";
import { bn, formatDate, formatDayNumber, formatMonthName, initialsOf, isUpcoming, relativeDay, yearLabel } from "@/lib/format";
import { SmartBackdrop, SmartImage } from "@/components/public/Media";
import { Breadcrumb, EmptyState } from "@/components/public/InternalPage";


export function ClubPageHero({ club, fallbackImage }: { club: Club; fallbackImage?: string }) {
  const accent = club.accent || "#e7c27e";
=======
import { normalizeHexColor, readableTextColor } from "@/lib/club-colors";

export function ClubPageHero({ club, fallbackImage }: { club: Club; fallbackImage?: string }) {
  const accent = normalizeHexColor(club.accent, "#2563eb");

  return (
    <section
      className="club-hero"
      style={{
        "--club-accent": accent,
        "--club-accent-text": `color-mix(in srgb, ${accent} 56%, var(--ink))`,
        "--club-accent-ink": readableTextColor(accent),
        "--club-accent-wash": `color-mix(in srgb, ${accent} 10%, var(--surface))`,
        "--club-accent-line": `color-mix(in srgb, ${accent} 26%, var(--line))`,
      } as React.CSSProperties}
    >
      <SmartBackdrop
        className="club-hero-bg"
        src={club.cover_image_url || club.image_url || fallbackImage}
        transform={{ width: 1800, fit: "cover" }}
      />
      <div className="page-width club-hero-inner">
        <Breadcrumb items={[{ label: "ক্লাবসমূহ", href: "/clubs" }, { label: club.name }]} className="internal-breadcrumb-light" />
        <p className="club-hero-kicker">
          {club.short_code ? `${club.short_code} · ` : ""}ক্লাব তথ্যকেন্দ্র
        </p>
        <h1>{club.name}</h1>
        {club.tagline ? <p className="club-hero-tagline">{club.tagline}</p> : null}
      </div>
    </section>
  );
}

export function FactGrid({ club }: { club: Club }) {
  const facts = [
    ...clubHighlights(club),
    club.meeting_time ? { label: "সময়", value: club.meeting_time } : null,
    club.coordinator ? { label: "উপদেষ্টা শিক্ষক", value: club.coordinator } : null,
    club.president ? { label: "সভাপতি", value: club.president } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  if (!facts.length) return null;
  return (
    <dl className="club-facts">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ObjectiveList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="club-objectives">
      {items.map((item) => (
        <li key={item}><CheckCircle2 size={16} /><span>{item}</span></li>
      ))}
    </ul>
  );
}

export function EventCard({ event, accent }: { event: ClubEvent; accent: string }) {
  const isPast = !isUpcoming(event.event_date);
  return (
    <article className={`event-card${isPast ? " is-past" : ""}${event.image_url ? " has-image" : ""}`} style={{ "--club-accent": accent } as React.CSSProperties}>
      <div className="event-date">
        <strong>{formatDayNumber(event.event_date) || "—"}</strong>
        <span>{formatMonthName(event.event_date, "long")}</span>
        <small>{yearLabel(event.event_date)}</small>
      </div>
      <div className="event-body">
        <div className="event-meta">
          <span className="event-type">{event.event_type || "আয়োজন"}</span>
          {event.is_featured ? <span className="event-flag">বিশেষ</span> : null}
          {relativeDay(event.event_date) ? <span className="event-relative">{relativeDay(event.event_date)}</span> : null}
        </div>
        <h3>{event.title}</h3>
        {event.description ? <p>{event.description}</p> : null}
        <div className="event-facts">
          {event.event_time ? <span><Clock size={13} /> {event.event_time}</span> : null}
          {event.venue ? <span><MapPin size={13} /> {event.venue}</span> : null}
          {event.registration_deadline ? <span><Ticket size={13} /> নিবন্ধন: {formatDate(event.registration_deadline)}</span> : null}
        </div>
        {event.registration_link ? (
          <a className="text-link" href={event.registration_link} target="_blank" rel="noreferrer">নিবন্ধন করুন <ArrowUpRight size={14} /></a>
        ) : null}
      </div>
      {event.image_url ? (
        <div className="event-photo">
          <SmartImage src={event.image_url} alt={event.title} transform={{ width: 640, fit: "cover" }} label={event.title} accent={accent} />
        </div>
      ) : null}
    </article>
  );
}

export function EventList({ content, accent, limit }: { content: ClubContent; accent: string; limit?: number }) {
  const events = limit ? content.events.slice(0, limit) : content.events;
  if (!events.length) return <EmptyState className="empty-note" message="এই মুহূর্তে কোনো আয়োজন প্রকাশিত হয়নি।" />;
  return <div className="event-list">{events.map((event) => <EventCard key={event.id} event={event} accent={accent} />)}</div>;
}

export function MemberGrid({ members, accent, limit }: { members: ClubMember[]; accent: string; limit?: number }) {
  const rows = limit ? members.slice(0, limit) : members;
  if (!rows.length) return <EmptyState className="empty-note" message="কমিটির তালিকা শিগগিরই যুক্ত হবে।" />;
  return (
    <div className="member-grid">
      {rows.map((member) => (
        <article key={member.id} className="member-card" style={{ "--club-accent": accent } as React.CSSProperties}>
          <div className="member-photo">
            {member.photo_url ? (
              <SmartImage src={member.photo_url} alt={member.name} transform={{ width: 420, height: 520, fit: "cover" }} label={member.name} accent={accent} />
            ) : (
              <span className="member-initials">{initialsOf(member.name)}</span>
            )}
          </div>
          <div className="member-copy">
            <span className="member-role">{member.role || "সদস্য"}</span>
            <h3>{member.name}</h3>
            {member.class_room ? <p className="member-class">{member.class_room}</p> : null}
            {member.bio ? <p className="member-bio">{member.bio}</p> : null}
            {member.achievement ? <p className="member-achievement"><Trophy size={13} /> {member.achievement}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function AchievementList({ items, accent, limit }: { items: ClubAchievement[]; accent: string; limit?: number }) {
  const rows = limit ? items.slice(0, limit) : items;
  if (!rows.length) return <EmptyState className="empty-note" message="এখনো অর্জন যুক্ত করা হয়নি।" />;
  return (
    <div className="achievement-list">
      {rows.map((item, index) => (
        <article key={item.id} className={`achievement-card${item.certificate_url ? " has-certificate" : ""}`} style={{ "--club-accent": accent } as React.CSSProperties}>
          <span className="achievement-index">{bn(index + 1)}</span>
          {item.certificate_url ? (
            <SmartImage className="achievement-photo" src={item.certificate_url} alt={item.title} transform={{ width: 420, fit: "cover" }} label={item.title} accent={accent} />
          ) : null}
          <div>
            <div className="achievement-meta">
              {item.level ? <span className="achievement-level">{item.level}</span> : null}
              {item.position ? <span className="achievement-pos">{item.position}</span> : null}
              {item.achieved_on ? <time>{formatDate(item.achieved_on)}</time> : null}
            </div>
            <h3>{item.title}</h3>
            {item.awarded_to ? <p className="achievement-who">{item.awarded_to}</p> : null}
            {item.description ? <p>{item.description}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function PostList({ club, posts, limit }: { club: Club; posts: ClubPost[]; limit?: number }) {
  const rows = limit ? posts.slice(0, limit) : posts;
  if (!rows.length) return <EmptyState className="empty-note" message="এই ক্লাবের লেখা শিগগিরই প্রকাশিত হবে।" />;
  return (
    <div className="post-list">
      {rows.map((post) => (
        <article key={post.id} className="post-card">
          <a className="post-photo" href={`/clubs/${club.slug}/posts/${post.slug}`}>
            <SmartImage src={post.image_url} alt={post.title} transform={{ width: 720, fit: "cover" }} label={post.title} accent={club.accent} />
            {post.is_featured ? <span className="post-flag">বিশেষ</span> : null}
          </a>
          <div className="post-copy">
            <div className="post-meta">
              <span>{post.category || "লেখা"}</span>
              <time>{formatDate(post.published_at)}</time>
            </div>
            <h3><a href={`/clubs/${club.slug}/posts/${post.slug}`}>{post.title}</a></h3>
            {post.excerpt ? <p>{post.excerpt}</p> : null}
            {post.author ? <span className="post-author">{post.author}</span> : null}
            <a className="text-link" href={`/clubs/${club.slug}/posts/${post.slug}`}>পড়ুন <ArrowRight size={14} /></a>
          </div>
        </article>
      ))}
    </div>
  );
}

export function NoticeList({ notices }: { notices: Notice[] }) {
  if (!notices.length) return null;
  return (
    <div className="club-notice-list">
      {notices.map((notice) => (
        <article key={notice.id}>
          <span className="club-notice-type">{notice.type || "নোটিশ"}</span>
          <h4>{notice.title}</h4>
          <p>{notice.body}</p>
          <time>{formatDate(notice.published_at)}</time>
        </article>
      ))}
    </div>
  );
}

export function ClubNewsList({ items, club }: { items: NewsItem[]; club: Club }) {
  if (!items.length) return null;
  return (
    <div className="club-news-list">
      {items.map((item) => (
        <a key={item.id} href={`/news/${item.slug}`} className="club-news-row">
          <SmartImage className="club-news-thumb" src={item.image_url} alt={item.title} transform={{ width: 240, height: 180, fit: "cover" }} accent={club.accent} label={item.title} />
          <span>
            <strong>{item.title}</strong>
            <small>{formatDate(item.published_at)} · স্কুল সংবাদ</small>
          </span>
          <ArrowUpRight size={16} />
        </a>
      ))}
    </div>
  );
}

export function JoinPanel({ club }: { club: Club }) {
  const hasContact = Boolean(club.coordinator_phone || club.email || club.facebook_url || club.domain);
  return (
    <aside className="club-join">
      <p className="club-join-eyebrow"><Sparkles size={14} /> যোগ দেবেন যেভাবে</p>
      {club.join_info ? <p className="club-join-text">{club.join_info}</p> : <p className="club-join-text">ক্লাবের সভায় এসে নাম লেখালেই সদস্যপদ পাওয়া যাবে।</p>}
      {club.meeting_day || club.meeting_time || club.meeting_place ? (
        <ul className="club-join-list">
          {club.meeting_day ? <li><CalendarClock size={14} /> {club.meeting_day}</li> : null}
          {club.meeting_time ? <li><Clock size={14} /> {club.meeting_time}</li> : null}
          {club.meeting_place ? <li><MapPin size={14} /> {club.meeting_place}</li> : null}
        </ul>
      ) : null}
      <div className="club-join-actions">
        {club.coordinator_phone ? <a className="button button-green button-small" href={`tel:${club.coordinator_phone.replace(/\s/g, "")}`}><Phone size={14} /> {club.coordinator_phone}</a> : null}
        {club.email ? <a className="button button-gold button-small" href={`mailto:${club.email}`}><Mail size={14} /> ইমেইল</a> : null}
        {club.facebook_url ? <a className="club-social-link" href={club.facebook_url} target="_blank" rel="noreferrer"><Facebook size={14} /> ফেসবুক</a> : null}
        {club.domain ? <a className="club-social-link" href={club.domain} target="_blank" rel="noreferrer"><ExternalLink size={14} /> ক্লাবের সাইট</a> : null}
      </div>
      {!hasContact && club.coordinator ? <p className="club-join-note">উপদেষ্টা: {club.coordinator}</p> : null}
    </aside>
  );
}

export function ClubSidebar({ club, content }: { club: Club; content: ClubContent }) {
  return (
    <div className="club-side">
      <JoinPanel club={club} />
      <section className="club-side-card">
        <h3><Trophy size={15} /> অর্জন</h3>
        {content.achievements.length ? (
          <ul className="club-side-list">
            {content.achievements.slice(0, 4).map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <small>{[item.level, item.position, yearLabel(item.achieved_on)].filter(Boolean).join(" · ")}</small>
              </li>
            ))}
          </ul>
        ) : <p className="empty-note">এখনো অর্জন যুক্ত হয়নি।</p>}
        <a className="text-link" href={clubPath(club.slug, "achievements")}>সব অর্জন <ArrowRight size={13} /></a>
      </section>
      <section className="club-side-card">
        <h3><Users size={15} /> কমিটি</h3>
        {content.members.length ? (
          <ul className="club-side-people">
            {content.members.slice(0, 5).map((member) => (
              <li key={member.id}>
                <span className="club-side-avatar">{initialsOf(member.name)}</span>
                <span><strong>{member.name}</strong><small>{member.role}</small></span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="empty-note" message="কমিটির তথ্য এখনো যোগ করা হয়নি।" />
        )}
        <a className="text-link" href={clubPath(club.slug, "members")}>সব সদস্য <ArrowRight size={13} /></a>
      </section>
    </div>
  );
}
