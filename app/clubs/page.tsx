import type { Metadata } from "next";
import { ArrowRight, CalendarClock, MapPin, Trophy } from "lucide-react";
import { getPublicContent } from "@/lib/db";
import { settingValue, summarizeAll } from "@/lib/club-data";
import { isUpcoming, formatDate, relativeDay } from "@/lib/format";
import { PublicChrome, SectionHeading } from "@/components/public/Chrome";
import { InternalPageHeader, InternalPageShell } from "@/components/public/InternalPage";
import { ClubDirectory } from "@/components/public/ClubDirectory";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://okgs.info";

export const metadata: Metadata = {
  title: "ক্লাব তথ্যকেন্দ্র",
  description:
    "ওমর কিন্ডারগার্টেন স্কুলের সব ক্লাবের আয়োজন, সদস্য কমিটি, গ্যালারি, অর্জন ও লেখা — এক জায়গায় হালনাগাদ তথ্য।",
  alternates: { canonical: `${siteUrl}/clubs` },
};

export default async function ClubsPage() {
  const content = await getPublicContent();
  const summaries = summarizeAll(content);
  const intro = settingValue(
    content.settings,
    "club_mission",
    "স্কুলের সব ক্লাবের আয়োজন, সদস্য, ছবি ও অর্জন — একটিই জায়গায়, সবার জন্য উন্মুক্ত।",
  );

  const upcoming = content.club_events
    .filter((event) => isUpcoming(event.event_date))
    .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))
    .slice(0, 6);
  const clubName = (slug: string) => content.clubs.find((club) => club.slug === slug)?.name ?? "";

  const recentAchievements = content.club_achievements.slice(0, 4);
  const clubNotices = content.notices.filter((notice) => notice.club_slug || notice.type === "কার্যক্রম").slice(0, 3);

  return (
    <PublicChrome content={content} active="clubs" internal contextLabel="ক্লাব তথ্যকেন্দ্র">
      <InternalPageShell className="club-directory-page">
        <InternalPageHeader
          className="club-index-hero"
          breadcrumb={[{ label: "ক্লাবসমূহ" }]}
          eyebrow="সহশিক্ষা কার্যক্রম"
          title={<>সব ক্লাবের তথ্য<br /><em>এক জায়গায়।</em></>}
          description={intro}
          actionsClassName="club-index-actions"
          actions={
            <>
              <a className="button button-gold" href="#directory">ক্লাব দেখুন <ArrowRight size={15} /></a>
              <a className="club-index-link" href="/#admission">ভর্তি তথ্য <ArrowRight size={14} /></a>
            </>
          }
        />

        <section className="section page-width reveal" id="directory" aria-labelledby="directory-title">
          <SectionHeading
            eyebrow="ক্লাব ডিরেক্টরি"
            title="ক্লাব খুঁজুন ও ছাঁকুন"
            intro="কোড বা নাম দিয়ে ক্লাব বেছে নিন — প্রতিটি কার্ডে সদস্য, আয়োজন ও ছবির হালনাগাদ তথ্য।"
            titleId="directory-title"
          />
          <ClubDirectory summaries={summaries} />
        </section>

        <section className="section page-width club-pulse-section">
          <div className="club-pulse-grid">
            <article className="club-pulse-card">
              <h2><CalendarClock size={16} /> আসন্ন আয়োজন</h2>
              {upcoming.length ? (
                <ul className="club-pulse-list">
                  {upcoming.map((event) => (
                    <li key={event.id}>
                      <a href={`/clubs/${event.club_slug}/events`}>
                        <span className="club-pulse-date">{formatDate(event.event_date, "short")}</span>
                        <span className="club-pulse-main">
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

            <article className="club-pulse-card">
              <h2><Trophy size={16} /> সাম্প্রতিক অর্জন</h2>
              {recentAchievements.length ? (
                <ul className="club-pulse-list">
                  {recentAchievements.map((item) => (
                    <li key={item.id}>
                      <a href={`/clubs/${item.club_slug}/achievements`}>
                        <span className="club-pulse-badge">{item.level || "অর্জন"}</span>
                        <span className="club-pulse-main">
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

            <article className="club-pulse-card">
              <h2><MapPin size={16} /> নোটিশ বোর্ড</h2>
              {clubNotices.length ? (
                <ul className="club-pulse-list">
                  {clubNotices.map((notice) => (
                    <li key={notice.id}>
                      <a href="/#notices">
                        <span className="club-pulse-date">{formatDate(notice.published_at, "short")}</span>
                        <span className="club-pulse-main">
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
        </section>
      </InternalPageShell>
    </PublicChrome>
  );
}
