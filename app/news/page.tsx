import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, CalendarDays, Newspaper } from "lucide-react";
import { getPublicContent } from "@/lib/db";
import { clubPath } from "@/lib/club-data";
import { bn, formatDate } from "@/lib/format";
import { PublicChrome, SectionHeading } from "@/components/public/Chrome";
import { SmartImage } from "@/components/public/Media";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "সংবাদ ও আপডেট",
  description: "ওমর কিন্ডারগার্টেন স্কুল ও সব ক্লাবের সর্বশেষ সংবাদ, আয়োজন ও ফলাফল।",
  alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://okgs.info"}/news` },
};

export default async function NewsIndexPage() {
  const content = await getPublicContent();
  const clubName = (slug: string) => content.clubs.find((club) => club.slug === slug)?.name ?? "";
  const categories = Array.from(new Set(content.news.map((item) => item.category).filter(Boolean)));
  const upcoming = content.club_events.filter((event) => event.event_date >= new Date().toISOString().slice(0, 10)).slice(0, 4);

  return (
    <PublicChrome content={content} active="news">
      <div className="story-page">
        <section className="journal-index-hero">
          <div className="page-width">
            <p className="eyebrow"><span className="eyebrow-dot" />স্কুল ও ক্লাবের বার্তা</p>
            <h1>সংবাদ<br /><em>ও আয়োজন</em></h1>
            <p>{bn(content.news.length)} টি প্রকাশিত সংবাদ, {bn(content.notices.length)} টি নোটিশ ও {bn(content.club_events.length)} টি ক্লাব আয়োজন একসাথে।</p>
            {categories.length ? (
              <div className="journal-chips">
                {categories.map((category) => <span key={category}>{category}</span>)}
              </div>
            ) : null}
          </div>
        </section>

        <section className="page-width journal-index-grid">
          {content.news.map((item) => (
            <article className="index-news-card" key={item.id}>
              <a className="index-news-image" href={`/news/${item.slug}`} aria-label={item.title}>
                <SmartImage src={item.image_url} alt={item.title} transform={{ width: 1000, fit: "cover" }} label={item.title} accent="#e7c27e" />
                <span>{item.category}</span>
                <i><ArrowUpRight size={18} /></i>
              </a>
              <div className="index-news-copy">
                <div>
                  <time><CalendarDays size={13} /> {formatDate(item.published_at)}</time>
                  <span>{item.author}</span>
                </div>
                <h2><a href={`/news/${item.slug}`}>{item.title}</a></h2>
                {item.excerpt ? <p>{item.excerpt}</p> : null}
                {item.club_slug ? (
                  <a className="news-club-tag" href={clubPath(item.club_slug)}>
                    {clubName(item.club_slug)} <ArrowRight size={12} />
                  </a>
                ) : null}
              </div>
            </article>
          ))}
          {!content.news.length ? (
            <p className="empty-copy"><Newspaper size={16} /> নতুন সংবাদ শিগগিরই প্রকাশিত হবে।</p>
          ) : null}
        </section>

        {upcoming.length ? (
          <section className="section page-width news-upcoming" aria-labelledby="upcoming-title">
            <SectionHeading
              eyebrow="ক্লাব ক্যালেন্ডার"
              title="আসন্ন আয়োজন"
              intro="সব ক্লাবের সামনের দিনের অনুষ্ঠান — তারিখ, স্থান ও আয়োজক একসাথে।"
              titleId="upcoming-title"
              action={<a className="text-link section-action" href="/clubs">ক্লাব তালিকা <ArrowRight size={15} aria-hidden /></a>}
            />
            <ul className="pulse-list pulse-list-plain">
              {upcoming.map((event) => (
                <li key={event.id}>
                  <a href={clubPath(event.club_slug, "events")}>
                    <span className="club-pulse-date">{formatDate(event.event_date, "short")}</span>
                    <span className="club-pulse-main">
                      <strong>{event.title}</strong>
                      <small>{clubName(event.club_slug)}{event.venue ? ` · ${event.venue}` : ""}</small>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PublicChrome>
  );
}
