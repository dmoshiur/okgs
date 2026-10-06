"use client";

import {
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Clock,
  ExternalLink,
  Facebook,
  Globe,
  GraduationCap,
  Images,
  ListChecks,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  Quote,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  UsersRound,
  Youtube,
} from "lucide-react";

import type { ClubPalette } from "@/lib/club-palette";
import type { ClubSite } from "@/lib/club-sites";
import { leadershipCards } from "@/lib/club-leadership";
import { backgroundStyle, optimizedImage } from "@/lib/cloudinary";
import { bn, formatDate, relativeDay } from "@/lib/format";
import { siteUrl } from "@/lib/schema";

import { ClubSiteGallery } from "@/components/club/ClubSiteGallery";
import { ClubSiteNav, type ClubSiteNavItem } from "@/components/club/ClubSiteNav";
import { ThemeModeToggle } from "@/components/public/ThemeModeToggle";

export interface ClubSiteViewProps {
  site: ClubSite;
  palette: ClubPalette;
  /** The club's own `theme.css`, injected verbatim when present. */
  themeCss?: string;
  /** Extra host chrome (used on the standalone subdomain page). */
  showBar?: boolean;
  /**
   * Preview mode: the studio embeds the very same component, so what the admin
   * sees is what the subdomain renders. Only the pieces that would fight with
   * an embedded frame (scroll-spy rail, lightbox) are quieted down.
   */
  preview?: boolean;
}

interface SiteEvent {
  title: string;
  date: string;
  description: string;
  image_url: string;
  venue: string;
}

/** Club rows and the club's own JSON list, de-duplicated and ordered sensibly. */
function collectEvents(site: ClubSite): SiteEvent[] {
  const rows: SiteEvent[] = [
    ...site.clubEvents.map((event) => ({
      title: String(event.title || "").trim(),
      date: String(event.event_date || "").trim(),
      description: String(event.description || "").trim(),
      image_url: String(event.image_url || "").trim(),
      venue: String(event.venue || "").trim(),
    })),
    ...site.events.map((event) => ({
      title: String(event.title || "").trim(),
      date: String(event.date || "").trim(),
      description: String(event.description || "").trim(),
      image_url: String(event.image_url || "").trim(),
      venue: "",
    })),
  ].filter((row) => row.title);

  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    const key = `${row.title.toLowerCase()}|${row.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const iso = /^\d{4}-\d{2}-\d{2}/;
  const dated = unique
    .filter((row) => iso.test(row.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const rest = unique.filter((row) => !iso.test(row.date));
  const today = new Date().toISOString().slice(0, 10);

  return [...dated.filter((row) => row.date.slice(0, 10) >= today), ...dated.filter((row) => row.date.slice(0, 10) < today).reverse(), ...rest];
}

/** Terms of a Bengali date string like “২০২৬” → nothing usable, so keep it raw. */
function eventDateLabel(value: string) {
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value, "long") : value;
}

export function ClubSiteView({ site, palette, themeCss = "", showBar = true, preview = false }: ClubSiteViewProps) {
  const school = siteUrl();
  const clubPage = `${school}/clubs/${site.slug}`;
  const events = collectEvents(site);
  const upcoming = events.filter((event) => /^\d{4}-\d{2}-\d{2}/.test(event.date) && event.date.slice(0, 10) >= new Date().toISOString().slice(0, 10));
  const leaders = leadershipCards(site);
  const photos = site.galleryItems.filter((item) => item?.url);
  const posts = site.posts.slice(0, 4);
  const members = preview ? site.members.slice(0, 8) : site.members;
  const cover = site.cover_image_url || photos[0]?.url || "";

  const stats = [
    { label: "সদস্য", value: site.member_count || members.length, icon: <UsersRound size={17} /> },
    { label: "আয়োজন", value: events.length, icon: <CalendarDays size={17} /> },
    { label: "ছবি", value: photos.length, icon: <Images size={17} /> },
    { label: "প্রতিষ্ঠা", value: site.founded_year, icon: <Sparkles size={17} /> },
  ].filter((item) => Number(item.value) > 0);

  const facts = [
    site.founded_year ? { label: "যাত্রা শুরু", value: bn(site.founded_year), icon: <Sparkles size={15} /> } : null,
    site.meeting.day ? { label: "সভার দিন", value: site.meeting.day, icon: <CalendarDays size={15} /> } : null,
    site.meeting.time ? { label: "সভার সময়", value: site.meeting.time, icon: <Clock size={15} /> } : null,
    site.meeting.place ? { label: "সভার স্থান", value: site.meeting.place, icon: <MapPin size={15} /> } : null,
    site.record?.coordinator ? { label: "শিক্ষক-পরামর্শক", value: site.record.coordinator, icon: <GraduationCap size={15} /> } : null,
  ].filter(Boolean) as { label: string; value: string; icon: React.ReactNode }[];

  const nav: ClubSiteNavItem[] = [
    site.about || site.mission.length || site.objectives.length ? { id: "about", label: "পরিচিতি" } : null,
    leaders.length ? { id: "leaders", label: "নেতৃত্ব" } : null,
    events.length ? { id: "events", label: "আয়োজন" } : null,
    photos.length ? { id: "gallery", label: "ছবিঘর" } : null,
    members.length ? { id: "members", label: "সদস্য" } : null,
    posts.length || site.notice ? { id: "writing", label: "লেখা ও ঘোষণা" } : null,
    { id: "contact", label: "যোগাযোগ" },
  ].filter(Boolean) as ClubSiteNavItem[];

  const addressQuery = site.contact.address ? encodeURIComponent(site.contact.address) : "";

  return (
    <div
      className="club-site"
      data-club={site.slug}
      data-club-palette={palette.source}
      style={palette.vars as React.CSSProperties}
    >
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <a className="clx-skip" href="#clx-main">মূল অংশে যান</a>

      {showBar ? (
        <header className="clx-bar">
          <div className="clx-wrap clx-bar-inner">
            <a className="clx-brand" href="#top">
              <span className="clx-brand-mark">
                {site.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={optimizedImage(site.logo_url, { width: 120 })} alt="" />
                ) : (
                  <b>{site.short_code.slice(0, 3) || "OK"}</b>
                )}
              </span>
              <span className="clx-brand-copy">
                <strong>{site.name}</strong>
                <small>{site.host}</small>
              </span>
            </a>

            <nav className="clx-bar-nav" aria-label="দ্রুত লিংক">
              {nav.slice(0, 6).map((item) => (
                <a key={item.id} href={`#${item.id}`}>{item.label}</a>
              ))}
            </nav>

            <div className="clx-bar-actions">
              <a className="clx-bar-back" href={clubPage}>
                <Globe size={15} aria-hidden /> স্কুল সাইট
              </a>
              <a className="clx-bar-icon" href={`${school}/clubs/${site.slug}/admin`} title="ক্লাব স্টুডিও">
                <ShieldCheck size={16} aria-hidden />
                <span className="sr-only">ক্লাব স্টুডিও</span>
              </a>
              <ThemeModeToggle compact />
            </div>
          </div>
        </header>
      ) : null}

      <header className="clx-hero" id="top">
        {cover ? <div className="clx-hero-photo" style={backgroundStyle(cover, { width: 1800, fit: "cover" })} aria-hidden /> : null}
        <span className="clx-hero-mesh" aria-hidden />
        <span className="clx-hero-grain" aria-hidden />

        <div className="clx-wrap clx-hero-inner">
          <div className="clx-hero-copy">
            <p className="clx-kicker">
              <span className="clx-kicker-dot" aria-hidden />
              {site.short_code || site.slug.toUpperCase()}
              <i aria-hidden>·</i>
              <span className="clx-kicker-host">{site.host}</span>
            </p>

            <h1>{site.name}</h1>
            {site.name_en ? <p className="clx-hero-en">{site.name_en}</p> : null}
            {site.tagline ? <p className="clx-hero-lead">{site.tagline}</p> : null}

            <div className="clx-hero-actions">
              <a className="clx-btn clx-btn-solid" href="#about">
                ক্লাব সম্পর্কে জানুন <ArrowDown size={16} aria-hidden />
              </a>
              {site.facebook ? (
                <a className="clx-btn clx-btn-ghost" href={site.facebook} target="_blank" rel="noreferrer noopener">
                  <Facebook size={16} aria-hidden /> ফেসবুক
                </a>
              ) : null}
              {site.youtube ? (
                <a className="clx-btn clx-btn-ghost" href={site.youtube} target="_blank" rel="noreferrer noopener">
                  <Youtube size={16} aria-hidden /> ইউটিউব
                </a>
              ) : null}
              {site.contact.email ? (
                <a className="clx-btn clx-btn-ghost" href={`mailto:${site.contact.email}`}>
                  <Mail size={16} aria-hidden /> ইমেইল
                </a>
              ) : null}
            </div>

            {site.motto ? (
              <p className="clx-hero-motto">
                <Quote size={17} aria-hidden />
                {site.motto}
              </p>
            ) : null}
          </div>

          <aside className="clx-hero-panel" aria-label="ক্লাবের পরিচয়">
            <span className="clx-hero-logo">
              {site.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={optimizedImage(site.logo_url, { width: 320 })} alt={`${site.name} এর লোগো`} />
              ) : (
                <b>{(site.short_code || site.slug).slice(0, 4)}</b>
              )}
            </span>

            <p className="clx-hero-panel-host">
              <Globe size={13} aria-hidden /> {site.host}
            </p>

            {site.website ? (
              <a className="clx-hero-panel-link" href={site.website} target="_blank" rel="noreferrer noopener">
                সাইটের ঠিকানা <ArrowUpRight size={14} aria-hidden />
              </a>
            ) : null}

            {upcoming[0] ? (
              <p className="clx-hero-next">
                <CalendarDays size={15} aria-hidden />
                <span>
                  <small>পরবর্তী আয়োজন</small>
                  <strong>{upcoming[0].title}</strong>
                  <em>
                    {eventDateLabel(upcoming[0].date)}
                    {relativeDay(upcoming[0].date) ? ` · ${relativeDay(upcoming[0].date)}` : ""}
                  </em>
                </span>
              </p>
            ) : null}
          </aside>
        </div>

        {stats.length ? (
          <div className="clx-wrap">
            <dl className="clx-stats">
              {stats.map((item) => (
                <div key={item.label} className="clx-stat">
                  <dt>
                    <span className="clx-stat-icon" aria-hidden>{item.icon}</span>
                    {item.label}
                  </dt>
                  <dd>{bn(item.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </header>

      {preview ? null : <ClubSiteNav items={nav} />}

      <main className="clx-wrap clx-main" id="clx-main">
        {site.about || site.mission.length || site.objectives.length || facts.length ? (
          <section className="clx-section" id="about">
            <div className="clx-section-head">
              <p className="clx-chip"><Sparkles size={13} aria-hidden /> পরিচিতি</p>
              <h2>{site.name} কী করে</h2>
              <p className="clx-section-lead">
                কার্যক্রম, লক্ষ্য আর সাফল্যের সব খবর — ক্লাবের নিজের ভাষায়।
              </p>
            </div>

            <div className="clx-about">
              <div className="clx-prose">
                {site.about ? <p className="clx-prose-lead">{site.about}</p> : null}
                {site.record?.history ? <p>{site.record.history}</p> : null}
              </div>

              {facts.length ? (
                <aside className="clx-facts" aria-label="এক নজরে">
                  <h3>এক নজরে</h3>
                  <ul>
                    {facts.map((fact) => (
                      <li key={fact.label}>
                        <span className="clx-facts-icon" aria-hidden>{fact.icon}</span>
                        <span>
                          <small>{fact.label}</small>
                          <strong>{fact.value}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                </aside>
              ) : null}
            </div>

            {site.mission.length || site.objectives.length ? (
              <div className="clx-pillars">
                {site.mission.length ? (
                  <article className="clx-pillar">
                    <h3><Target size={18} aria-hidden /> আমাদের লক্ষ্য</h3>
                    <ul>
                      {site.mission.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </article>
                ) : null}
                {site.objectives.length ? (
                  <article className="clx-pillar">
                    <h3><ListChecks size={18} aria-hidden /> ক্লাবের উদ্দেশ্য</h3>
                    <ol>
                      {site.objectives.map((item) => <li key={item}>{item}</li>)}
                    </ol>
                  </article>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {leaders.length ? (
          <section className="clx-section" id="leaders">
            <div className="clx-section-head">
              <p className="clx-chip"><UserRound size={13} aria-hidden /> নেতৃত্ব</p>
              <h2>সভাপতি, সম্পাদক ও কমিটি</h2>
              <p className="clx-section-lead">
                ক্লাবের দায়িত্বে যারা আছেন — কমিটি ও শিক্ষক-পরামর্শক।
              </p>
            </div>

            <div className="clx-people">
              {leaders.map((leader) => (
                <article className="clx-person" key={`${leader.role}-${leader.name}`}>
                  <span className="clx-person-photo">
                    {leader.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={optimizedImage(leader.photo_url, { width: 320, height: 320, fit: "cover" })} alt={leader.name} loading="lazy" />
                    ) : (
                      <b aria-hidden>{(leader.name || "?").trim().slice(0, 1)}</b>
                    )}
                  </span>
                  <div className="clx-person-copy">
                    <em>{leader.role}</em>
                    <strong>{leader.name}</strong>
                    {leader.class_level || leader.section ? (
                      <small>
                        {leader.class_level}
                        {leader.section ? ` · শাখা ${leader.section}` : ""}
                      </small>
                    ) : null}
                    {leader.bio ? <p>{leader.bio}</p> : null}
                    <div className="clx-person-links">
                      {leader.phone ? <a href={`tel:${leader.phone}`}><Phone size={13} aria-hidden /> {leader.phone}</a> : null}
                      {leader.email ? <a href={`mailto:${leader.email}`}><Mail size={13} aria-hidden /> ইমেইল</a> : null}
                      {leader.facebook ? (
                        <a href={leader.facebook} target="_blank" rel="noreferrer noopener"><Facebook size={13} aria-hidden /> ফেসবুক</a>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {events.length ? (
          <section className="clx-section" id="events">
            <div className="clx-section-head">
              <p className="clx-chip"><CalendarDays size={13} aria-hidden /> আয়োজন</p>
              <h2>কার্যক্রম ও অনুষ্ঠান</h2>
              <p className="clx-section-lead">
                {upcoming.length
                  ? `সামনে আছে ${bn(upcoming.length)} টি আয়োজন — বাকিগুলো নিচে সাজানো।`
                  : "এখন পর্যন্ত যা যা হয়েছে, সময়ের ক্রমে।"}
              </p>
            </div>

            <ol className="clx-timeline">
              {(preview ? events.slice(0, 6) : events).map((event, index) => (
                <li className="clx-event" key={`${event.title}-${index}`}>
                  <span className="clx-event-rail" aria-hidden />
                  <div className="clx-event-body">
                    <span className="clx-event-mark" aria-hidden>{bn(index + 1)}</span>
                    {event.date ? (
                      <p className="clx-event-date">
                        <CalendarDays size={13} aria-hidden /> {eventDateLabel(event.date)}
                        {relativeDay(event.date) ? <em>{relativeDay(event.date)}</em> : null}
                      </p>
                    ) : null}
                    <h3>{event.title}</h3>
                    {event.description ? <p>{event.description}</p> : null}
                    {event.venue ? <p className="clx-event-venue"><MapPin size={13} aria-hidden /> {event.venue}</p> : null}
                  </div>
                  {event.image_url ? (
                    <span className="clx-event-photo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={optimizedImage(event.image_url, { width: 720, fit: "cover" })} alt={event.title} loading="lazy" />
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {photos.length ? (
          <section className="clx-section" id="gallery">
            <div className="clx-section-head">
              <p className="clx-chip"><Images size={13} aria-hidden /> ছবিঘর</p>
              <h2>ক্লাবের ছবি</h2>
              <p className="clx-section-lead">
                {bn(photos.length)} টি ছবি — যেকোনো ছবিতে চাপ দিয়ে বড় করে দেখুন।
              </p>
            </div>
            {preview ? (
              <div className="clx-wall is-static">
                {photos.slice(0, 9).map((item, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <figure key={`${item.url}-${index}`} className="clx-shot">
                    <img src={optimizedImage(item.url, { width: 640, fit: "cover" })} alt={item.caption || ""} loading="lazy" />
                  </figure>
                ))}
              </div>
            ) : (
              <ClubSiteGallery
                photos={photos.map((item) => ({ url: item.url, caption: item.caption || "" }))}
                clubName={site.name}
              />
            )}
          </section>
        ) : null}

        {members.length ? (
          <section className="clx-section" id="members">
            <div className="clx-section-head">
              <p className="clx-chip"><UsersRound size={13} aria-hidden /> সদস্য</p>
              <h2>সদস্য তালিকা</h2>
              <p className="clx-section-lead">
                {bn(members.length)} জন নিবন্ধিত সদস্য{site.member_count > members.length ? ` · মোট ${bn(site.member_count)} জন` : ""}।
              </p>
            </div>

            <div className="clx-table-wrap">
              <table className="clx-table">
                <thead>
                  <tr>
                    <th scope="col">নাম</th>
                    <th scope="col">দায়িত্ব</th>
                    <th scope="col">শ্রেণি</th>
                    <th scope="col">শাখা</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td><strong>{member.name}</strong></td>
                      <td>{member.role || "সদস্য"}</td>
                      <td>{member.class_room || "—"}</td>
                      <td>{member.section || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {posts.length || site.notice ? (
          <section className="clx-section" id="writing">
            <div className="clx-section-head">
              <p className="clx-chip"><BookOpen size={13} aria-hidden /> লেখা ও ঘোষণা</p>
              <h2>ক্লাবের পত্রিকা ও ঘোষণা</h2>
              <p className="clx-section-lead">সদস্যদের লেখা আর ক্লাবের সর্বশেষ খবর।</p>
            </div>

            {site.notice ? (
              <p className="clx-notice">
                <Megaphone size={17} aria-hidden />
                <span>{site.notice}</span>
              </p>
            ) : null}

            {posts.length ? (
              <div className="clx-posts">
                {posts.map((post) => (
                  <a className="clx-post" key={post.id} href={`${clubPage}/posts/${post.slug}`}>
                    {post.image_url ? (
                      <span className="clx-post-photo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={optimizedImage(post.image_url, { width: 640, height: 420, fit: "cover" })} alt="" loading="lazy" />
                      </span>
                    ) : (
                      <span className="clx-post-photo is-plain" aria-hidden><BookOpen size={22} /></span>
                    )}
                    <span className="clx-post-copy">
                      <small>{post.published_at ? formatDate(post.published_at, "short") : "লেখা"}{post.author ? ` · ${post.author}` : ""}</small>
                      <strong>{post.title}</strong>
                      {post.excerpt ? <p>{post.excerpt}</p> : null}
                      <em>পড়ুন <ArrowUpRight size={13} aria-hidden /></em>
                    </span>
                  </a>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="clx-section" id="contact">
          <div className="clx-section-head">
            <p className="clx-chip"><MapPin size={13} aria-hidden /> যোগাযোগ</p>
            <h2>ক্লাবে যোগ দিন</h2>
            <p className="clx-section-lead">
              নতুন সদস্য, অতিথি বা সহযোগিতা — যেকোনো বিষয়ে যোগাযোগ করুন।
            </p>
          </div>

          <div className="clx-contact">
            <article className="clx-contact-card">
              <span className="clx-contact-icon" aria-hidden><Clock size={18} /></span>
              <h3>নিয়মিত সভা</h3>
              <p>{site.meeting.day || "প্রতি সপ্তাহে"}</p>
              {site.meeting.time ? <small>{site.meeting.time}</small> : null}
              {site.meeting.place ? <small>{site.meeting.place}</small> : null}
            </article>

            <article className="clx-contact-card">
              <span className="clx-contact-icon" aria-hidden><Phone size={18} /></span>
              <h3>ফোন ও ইমেইল</h3>
              {site.contact.phone ? <a href={`tel:${site.contact.phone}`}>{site.contact.phone}</a> : <p>—</p>}
              {site.contact.email ? <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a> : null}
            </article>

            <article className="clx-contact-card">
              <span className="clx-contact-icon" aria-hidden><MapPin size={18} /></span>
              <h3>ঠিকানা</h3>
              <p>{site.contact.address || "ওমর কিন্ডারগার্টেন স্কুল, কালাই, জয়পুরহাট"}</p>
              {addressQuery ? (
                <a href={`https://www.google.com/maps/search/?api=1&query=${addressQuery}`} target="_blank" rel="noreferrer noopener">
                  মানচিত্রে দেখুন <ExternalLink size={13} aria-hidden />
                </a>
              ) : null}
            </article>
          </div>

          <div className="clx-join">
            <div>
              <h3>ক্লাবের সদস্য হতে চান?</h3>
              <p>
                {site.record?.join_info ||
                  "স্কুল অফিসে অথবা ক্লাবের কমিটির যেকোনো সদস্যের সাথে কথা বলে নাম লেখানো যাবে — নতুন সদস্য সবসময় স্বাগত।"}
              </p>
            </div>
            <div className="clx-join-actions">
              {site.contact.email ? (
                <a className="clx-btn clx-btn-solid" href={`mailto:${site.contact.email}`}>
                  <Mail size={16} aria-hidden /> ইমেইল করুন
                </a>
              ) : null}
              {site.contact.phone ? (
                <a className="clx-btn clx-btn-ghost" href={`tel:${site.contact.phone}`}>
                  <Phone size={16} aria-hidden /> কল করুন
                </a>
              ) : null}
              <a className="clx-btn clx-btn-ghost" href={clubPage}>
                <Globe size={16} aria-hidden /> স্কুল সাইটে ক্লাব পাতা
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="clx-foot">
        <div className="clx-wrap clx-foot-inner">
          <div className="clx-foot-brand">
            <span className="clx-foot-mark">
              {site.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={optimizedImage(site.logo_url, { width: 120 })} alt="" />
              ) : (
                <b>{(site.short_code || site.slug).slice(0, 3)}</b>
              )}
            </span>
            <div>
              <strong>{site.name}</strong>
              <p>{site.name_en}</p>
              <small>{site.host}</small>
            </div>
          </div>

          <nav className="clx-foot-links" aria-label="ফুটার লিংক">
            <div>
              <span>ক্লাব</span>
              {nav.map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}
            </div>
            <div>
              <span>লিংক</span>
              <a href={clubPage}>স্কুল সাইটে ক্লাব পাতা</a>
              <a href={`${school}/clubs`}>সব ক্লাব</a>
              {site.facebook ? <a href={site.facebook} target="_blank" rel="noreferrer noopener">ফেসবুক</a> : null}
              {site.youtube ? <a href={site.youtube} target="_blank" rel="noreferrer noopener">ইউটিউব</a> : null}
              <a href={`${clubPage}/admin`}>ক্লাব স্টুডিও</a>
            </div>
          </nav>
        </div>

        <div className="clx-wrap clx-foot-bottom">
          <p>© {bn(new Date().getFullYear())} {site.name} · {site.host}</p>
          <p>
            পরিচালনায় <a href={school}>ওমর কিন্ডারগার্টেন স্কুল</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
