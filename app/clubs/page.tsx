import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarClock, Compass, MapPin, Sparkles, Trophy } from "lucide-react";

import { ClubDirectory } from "@/components/public/ClubDirectory";
import { PublicChrome } from "@/components/public/Chrome";
import { settingValue, summarizeAll } from "@/lib/club-data";
import { getPublicContent } from "@/lib/db";
import { bn, formatDate, isUpcoming, relativeDay } from "@/lib/format";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://okgs.info";

export const metadata: Metadata = {
  title: "ক্লাবসমূহ",
  description:
    "ওমর কিন্ডারগার্টেন স্কুলের সব ক্লাব — আয়োজন, সদস্য কমিটি, গ্যালারি, অর্জন আর প্রতিটি ক্লাবের নিজস্ব সাইট, এক জায়গায়।",
  alternates: { canonical: `${siteUrl}/clubs` },
};

export default async function ClubsPage() {
  const content = await getPublicContent();
  const summaries = summarizeAll(content);
  const intro = settingValue(
    content.settings,
    "club_mission",
    "স্কুলের সব ক্লাবের আয়োজন, সদস্য, ছবি ও অর্জন — এক জায়গায়, সবার জন্য উন্মুক্ত। প্রতিটি ক্লাবের আছে নিজের আলাদা সাইট।",
  );

  const upcoming = content.club_events
    .filter((event) => isUpcoming(event.event_date))
    .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))
    .slice(0, 6);
  const clubName = (slug: string) => content.clubs.find((club) => club.slug === slug)?.name ?? "";

  const recentAchievements = content.club_achievements.slice(0, 4);
  const clubNotices = content.notices.filter((notice) => notice.club_slug || notice.type === "কার্যক্রম").slice(0, 3);
  const totalPhotos = summaries.reduce((sum, item) => sum + item.counts.gallery, 0);
  const totalEvents = summaries.reduce((sum, item) => sum + item.counts.events, 0);

  return (
    <PublicChrome content={content} active="clubs" internal contextLabel="ক্লাব তথ্যকেন্দ্র">
      <div className="hub-page">
        {/* ------------------------------------------------------------ hero -- */}
        <section className="hub-hero">
          <span className="hub-hero-glow" aria-hidden />
          <div className="page-width hub-hero-inner">
            <div className="hub-hero-copy">
              <p className="eyebrow eyebrow-light"><span className="eyebrow-dot" aria-hidden />সহশিক্ষা কার্যক্রম</p>
              <h1>প্রতিটি ক্লাবের <em>নিজের সাইট</em>।</h1>
              <p className="hub-hero-lead">{intro}</p>

              <div className="hub-hero-actions">
                <a className="button button-gold" href="#directory">ক্লাব খুঁজুন <ArrowRight size={15} aria-hidden /></a>
                <Link className="button button-outline hub-hero-ghost" href="/news">স্কুল সংবাদ</Link>
              </div>

              <dl className="hub-hero-stats">
                <div><dt>ক্লাব</dt><dd>{bn(summaries.length)}</dd></div>
                <div><dt>প্রকাশিত আয়োজন</dt><dd>{bn(totalEvents)}</dd></div>
                <div><dt>গ্যালারির ছবি</dt><dd>{bn(totalPhotos)}</dd></div>
              </dl>
            </div>

            <aside className="hub-hero-panel">
              <p className="hub-hero-panel-title"><Compass size={15} aria-hidden /> ক্লাবের নিজস্ব ঠিকানা</p>
              <ul className="hub-hero-domains">
                {summaries.map((summary) => (
                  <li key={summary.club.id}>
                    <a href={summary.siteUrl} target="_blank" rel="noreferrer noopener">
                      <span className="hub-hero-domain-mark">
                        {summary.club.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={summary.club.logo_url} alt="" loading="lazy" />
                        ) : (
                          <b>{(summary.club.short_code || summary.club.slug).slice(0, 3)}</b>
                        )}
                      </span>
                      <span className="hub-hero-domain-copy">
                        <strong>{summary.club.name}</strong>
                        <small>{summary.siteLabel}</small>
                      </span>
                      <ArrowUpRight size={15} aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
              <p className="hub-hero-panel-note">
                প্রতিটি ক্লাব <code>slug.okgs.info</code> ঠিকানায় আলাদা সাইট হিসেবে চলে — তথ্যকেন্দ্রের পাতা আলাদা।
              </p>
            </aside>
          </div>
        </section>

        {/* ------------------------------------------------------- directory -- */}
        <section className="section page-width" id="directory" aria-labelledby="directory-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-dot" aria-hidden />ক্লাব ডিরেক্টরি</p>
              <h2 id="directory-title">ক্লাব খুঁজুন ও ছাঁকুন</h2>
            </div>
            <p className="section-intro">
              কোড, নাম বা সাবডোমেইন দিয়ে ক্লাব বেছে নিন — প্রতিটি কার্ডে সদস্য, আয়োজন, ছবি আর ক্লাবের নিজের সাইটের
              বাটন।
            </p>
          </div>
          <ClubDirectory summaries={summaries} />
        </section>

        {/* ----------------------------------------------------------- pulse -- */}
        <section className="section page-width hub-pulse" aria-labelledby="pulse-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-dot" aria-hidden />হালনাগাদ</p>
              <h2 id="pulse-title">ক্লাবগুলোর সর্বশেষ</h2>
            </div>
            <p className="section-intro">আসন্ন আয়োজন, সাম্প্রতিক অর্জন আর নোটিশ — এক নজরে।</p>
          </div>

          <div className="hub-pulse-grid">
            <article className="hub-pulse-card">
              <h3><CalendarClock size={16} aria-hidden /> আসন্ন আয়োজন</h3>
              {upcoming.length ? (
                <ul>
                  {upcoming.map((event) => (
                    <li key={event.id}>
                      <a href={`/clubs/${event.club_slug}/events`}>
                        <span className="hub-pulse-when">{formatDate(event.event_date, "short")}</span>
                        <span className="hub-pulse-main">
                          <strong>{event.title}</strong>
                          <small>{clubName(event.club_slug)}{event.venue ? ` · ${event.venue}` : ""}</small>
                        </span>
                        {relativeDay(event.event_date) ? <em>{relativeDay(event.event_date)}</em> : null}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-note">সম্প্রতি কোনো আয়োজন প্রকাশিত হয়নি।</p>
              )}
            </article>

            <article className="hub-pulse-card">
              <h3><Trophy size={16} aria-hidden /> সাম্প্রতিক অর্জন</h3>
              {recentAchievements.length ? (
                <ul>
                  {recentAchievements.map((item) => (
                    <li key={item.id}>
                      <a href={`/clubs/${item.club_slug}/achievements`}>
                        <span className="hub-pulse-badge">{item.level || "অর্জন"}</span>
                        <span className="hub-pulse-main">
                          <strong>{item.title}</strong>
                          <small>{clubName(item.club_slug)}{item.position ? ` · ${item.position}` : ""}</small>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-note">এখনো অর্জন যুক্ত করা হয়নি।</p>
              )}
            </article>

            <article className="hub-pulse-card">
              <h3><MapPin size={16} aria-hidden /> নোটিশ বোর্ড</h3>
              {clubNotices.length ? (
                <ul>
                  {clubNotices.map((notice) => (
                    <li key={notice.id}>
                      <a href="/#notices">
                        <span className="hub-pulse-when">{formatDate(notice.published_at, "short")}</span>
                        <span className="hub-pulse-main">
                          <strong>{notice.title}</strong>
                          <small>{notice.type}{notice.club_slug ? ` · ${clubName(notice.club_slug)}` : ""}</small>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-note">নতুন নোটিশ শিগগিরই প্রকাশিত হবে।</p>
              )}
            </article>
          </div>

          <p className="hub-pulse-foot">
            <Sparkles size={14} aria-hidden />
            ক্লাবের সব ছবি, কমিটি ও লেখা ওই ক্লাবের নিজের সাইটে — কার্ডের <strong>সাইট দেখুন</strong> বাটনে চাপ দিন।
          </p>
        </section>
      </div>
    </PublicChrome>
  );
}
