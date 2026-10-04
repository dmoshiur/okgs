import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Phone,
  Quote,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { PublicContent } from "@/lib/types";
import { clubPath, settingValue, summarizeAll } from "@/lib/club-data";
import { bn, formatDate, isUpcoming } from "@/lib/format";
import { paragraphs } from "@/lib/content-config";
import { PublicChrome, SectionHeading } from "@/components/public/Chrome";
import { HeroCarousel } from "@/components/public/HeroCarousel";
import { ClubCard } from "@/components/public/ClubCard";
import { GalleryViewer } from "@/components/public/GalleryViewer";
import { IconByName } from "@/lib/icons";
import { SmartImage } from "@/components/public/Media";
import { FairMega } from "@/components/public/FairMega";
import { ClubShowcase } from "@/components/public/ClubShowcase";

function NoticeRow({ notice, index }: { notice: PublicContent["notices"][number]; index: number }) {
  return (
    <article className="notice-item">
      <span className="notice-number">{bn(index + 1).padStart(2, "০")}</span>
      <div>
        <div className="notice-meta">
          <span>{notice.type}</span>
          <time>{formatDate(notice.published_at)}</time>
        </div>
        <h3>{notice.title}</h3>
        <p>{notice.body}</p>
        {notice.club_slug ? (
          <a className="notice-club-link" href={clubPath(notice.club_slug)}>সংশ্লিষ্ট ক্লাব <ArrowUpRight size={13} /></a>
        ) : null}
      </div>
      <ArrowUpRight className="notice-arrow" size={18} />
    </article>
  );
}

export function PublicHome({ content }: { content: PublicContent }) {
  const settings = content.settings;
  const about = settingValue(settings, "about");
  const aboutExtra = settingValue(settings, "about_extra");
  const mission = settingValue(settings, "mission");
  const founder = settingValue(settings, "founder");
  const admissionNote = settingValue(settings, "admission_note", settingValue(settings, "tagline"));
  const galleryNote = settingValue(settings, "gallery_note");
  const quoteText = settingValue(settings, "quote_text");
  const quoteAuthor = settingValue(settings, "quote_author");
  const aboutImage = settingValue(settings, "about_image_url");
  const admissionImage = settingValue(settings, "admission_image_url");
  const phone = settingValue(settings, "phone", "01711857205");
  const admissionPhone = settingValue(settings, "admission_phone", phone);

  const clubSummaries = summarizeAll(content);
  const featuredNews = content.news.find((item) => item.is_featured) || content.news[0];
  const otherNews = content.news.filter((item) => item.id !== featuredNews?.id).slice(0, 2);
  const upcomingEvents = content.club_events
    .filter((event) => isUpcoming(event.event_date))
    .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))
    .slice(0, 5);
  const clubNameFor = (slug: string) => content.clubs.find((club) => club.slug === slug)?.name ?? "";
  const stats = content.stats.filter((stat) => stat.value).slice(0, 4);
  const totalAchievements = content.club_achievements.length;

  return (
    <PublicChrome content={content} active="home">
      <main>
        <FairMega content={content} />

        <section className="hero-section">
          <HeroCarousel
            slides={content.slides}
            badge={{ year: settingValue(settings, "hero_badge_year", "২০০৩"), place: settingValue(settings, "hero_badge_place", "কালাই, জয়পুরহাট") }}
          />
        </section>

        <ClubShowcase
          clubs={clubSummaries.map((summary) => summary.club)}
          slides={content.slides}
          counts={Object.fromEntries(clubSummaries.map((summary) => [summary.club.slug, summary.counts.gallery]))}
        />

        <section className="notice-ribbon">
          <div className="page-width notice-ribbon-inner">
            <span className="notice-ribbon-label"><Sparkles size={15} /> সাম্প্রতিক নোটিশ</span>
            <p>{content.notices[0]?.title || "নতুন নোটিশ শিগগিরই প্রকাশিত হবে"}</p>
            <a href="#notices">সব নোটিশ <ArrowRight size={15} /></a>
          </div>
        </section>

        <section className="section page-width about-section" id="about">
          <SectionHeading
            eyebrow="আমাদের পরিচয়"
            title="শিক্ষায় গড়ি আলোকিত ভবিষ্যৎ"
            intro="প্লে থেকে দশম শ্রেণি পর্যন্ত আবাসিক ও অনাবাসিক পাঠদান, আর ছয়টি ক্লাবের পূর্ণাঙ্গ সহশিক্ষা কার্যক্রম।"
            action={
              <a className="text-link section-action" href="/clubs">
                ক্লাব তথ্যকেন্দ্র <ArrowUpRight size={15} />
              </a>
            }
          />
          <div className="about-grid">
            <div className="about-image">
              <SmartImage src={aboutImage} alt="ক্যাম্পাস" priority transform={{ width: 1100, height: 900, fit: "cover" }} accent="#166534" label="ক্যাম্পাস" />
              {founder ? <span>প্রতিষ্ঠা: {settingValue(settings, "hero_badge_year", "২০০৩")}</span> : null}
            </div>
            <div className="about-copy">
              {about ? <p className="about-lead">{about}</p> : null}
              {founder ? <p>{founder}</p> : null}
              {aboutExtra ? <p>{aboutExtra}</p> : null}
              {mission ? <p>{mission}</p> : null}
              <div className="about-actions">
                <a className="button button-green" href="/clubs">আমাদের ক্লাবসমূহ <ArrowRight size={16} /></a>
                <a className="text-link" href="#contact">যোগাযোগ <ArrowUpRight size={14} /></a>
              </div>
            </div>
          </div>
        </section>

        {stats.length ? (
          <section className="stats-strip">
            <div className="page-width stats-grid">
              {stats.map((stat) => (
                <div key={stat.id}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="section page-width clubs-section" id="clubs">
          <SectionHeading
            eyebrow="সহশিক্ষা কার্যক্রম"
            title="আমাদের ক্লাবসমূহ"
            intro="প্রতিটি ক্লাবের আয়োজন, কমিটি, ছবি ও অর্জন নিজস্ব পাতায় — সবই অ্যাডমিন প্যানেল থেকে হালনাগাদ হয়।"
            action={<span className="clubs-count">{bn(clubSummaries.length).padStart(2, "০")} <small>টি ক্লাব</small></span>}
          />
          <div className="clubs-grid">
            {clubSummaries.map((summary) => <ClubCard key={summary.club.id} summary={summary} />)}
          </div>
          <div className="clubs-foot">
            <a className="button button-green" href="/clubs">সব ক্লাবের তথ্য <ArrowRight size={15} /></a>
            <span className="clubs-foot-note">{bn(totalAchievements)} টি প্রকাশিত অর্জন · {bn(upcomingEvents.length)} টি আসন্ন আয়োজন</span>
          </div>
        </section>

        <section className="section page-width club-pulse-strip" id="club-pulse">
          <SectionHeading eyebrow="ক্লাব ক্যালেন্ডার" title="এই সময়ের আয়োজন" intro="সব ক্লাবের আসন্ন অনুষ্ঠান এক নজরে।" />
          {upcomingEvents.length ? (
            <div className="pulse-list">
              {upcomingEvents.map((event) => (
                <a key={event.id} className="pulse-row" href={clubPath(event.club_slug, "events")} style={{ "--club-accent": content.clubs.find((club) => club.slug === event.club_slug)?.accent || "#e7c27e" } as React.CSSProperties}>
                  <span className="pulse-when"><CalendarClock size={13} /> {formatDate(event.event_date, "short")}</span>
                  <span className="pulse-main">
                    <strong>{event.title}</strong>
                    <small>{clubNameFor(event.club_slug)}{event.venue ? ` · ${event.venue}` : ""}</small>
                  </span>
                  <span className="pulse-type">{event.event_type || "আয়োজন"}</span>
                  <ChevronRight size={17} />
                </a>
              ))}
            </div>
          ) : (
            <p className="empty-copy">সম্প্রতি কোনো আয়োজন প্রকাশিত হয়নি।</p>
          )}
        </section>

        <section className="section page-width facilities-section" id="facilities">
          <SectionHeading
            eyebrow="ক্যাম্পাস সুবিধা"
            title="শেখার জন্য সুন্দর পরিবেশ"
            intro="শিক্ষার্থীদের নিরাপদ, আনন্দময় ও আধুনিক শিক্ষাজীবনের জন্য প্রয়োজনীয় সুবিধা।"
          />
          <div className="facility-grid">
            {content.facilities.map((facility) => (
              <article className="facility-card" key={facility.id}>
                <span className="facility-icon"><IconByName name={facility.icon} size={22} /></span>
                <h3>{facility.title}</h3>
                <p>{facility.description}</p>
              </article>
            ))}
            {!content.facilities.length ? <p className="empty-copy">সুবিধার তালিকা শিগগিরই যুক্ত হবে।</p> : null}
          </div>
        </section>

        <section className="admission-section" id="admission">
          <div className="page-width admission-grid">
            <div className="admission-copy">
              <p className="eyebrow eyebrow-light"><span className="eyebrow-dot" />ভর্তি চলছে</p>
              <h2>আপনার সন্তানের<br /><em>উজ্জ্বল ভবিষ্যৎ</em> শুরু হোক।</h2>
              <p>{admissionNote}</p>
              <div className="admission-actions">
                <a className="button button-gold" href="#contact">যোগাযোগ করুন <ArrowUpRight size={16} /></a>
                <a className="admission-phone" href={`tel:${admissionPhone.replace(/\s/g, "")}`}><Phone size={15} /> {admissionPhone}</a>
              </div>
            </div>
            <div className="admission-image">
              <SmartImage src={admissionImage} alt="ভর্তি কার্যালয়" transform={{ width: 1000, height: 900, fit: "cover" }} accent="#14532d" label="ভর্তি কার্যালয়" />
              <span>আবাসিক / অনাবাসিক</span>
            </div>
          </div>
        </section>

        <section className="section page-width notices-section" id="notices">
          <SectionHeading
            eyebrow="সর্বশেষ ঘোষণা"
            title="নোটিশ বোর্ড"
            intro="স্কুল ও ক্লাবের গুরুত্বপূর্ণ খবর এক জায়গায়।"
            action={<a className="text-link section-action" href="/clubs">ক্লাবের খবর <ArrowRight size={15} /></a>}
          />
          <div className="notice-list">
            {content.notices.slice(0, 4).map((notice, index) => <NoticeRow key={notice.id} notice={notice} index={index} />)}
            {!content.notices.length ? <p className="empty-copy">নতুন নোটিশ শিগগিরই প্রকাশিত হবে।</p> : null}
          </div>
        </section>

        <section className="section page-width journal-section" id="news">
          <SectionHeading
            eyebrow="সংবাদ ও আপডেট"
            title="স্কুলের খবর"
            intro="ক্যাম্পাসের কার্যক্রম, সাফল্য ও নতুন সংবাদ।"
            action={<a className="text-link section-action" href="/news">সব সংবাদ <ArrowRight size={15} /></a>}
          />
          {featuredNews ? (
            <div className="news-layout">
              <NewsCard item={featuredNews} />
              {otherNews.length ? <div className="news-side-list">{otherNews.map((item) => <NewsCard key={item.id} item={item} />)}</div> : null}
            </div>
          ) : (
            <p className="empty-copy">নতুন সংবাদ শিগগিরই প্রকাশিত হবে।</p>
          )}
        </section>

        <section className="section updates-section">
          <div className="page-width">
            <SectionHeading eyebrow="দৈনন্দিন খবর" title="সর্বশেষ আপডেট" intro="স্কুলের চলমান কার্যক্রমের সংক্ষিপ্ত খবর।" />
            <div className="updates-list">
              {content.updates.slice(0, 4).map((update, index) => (
                <article className="update-row" key={update.id}>
                  <span className="update-number">{bn(index + 1).padStart(2, "০")}</span>
                  <span className="update-date"><CalendarClock size={14} />{formatDate(update.date)}</span>
                  <div>
                    <span className="update-kind">{update.kind}</span>
                    <h3>{update.title}</h3>
                    <p>{update.description}</p>
                  </div>
                  <ChevronRight size={17} />
                </article>
              ))}
              {!content.updates.length ? <p className="empty-copy">আপডেট শিগগিরই প্রকাশিত হবে।</p> : null}
            </div>
          </div>
        </section>

        {content.teachers.length ? (
          <section className="section page-width teachers-section" id="teachers">
            <SectionHeading
              eyebrow="আমাদের শিক্ষকবৃন্দ"
              title="অভিজ্ঞ ও নিবেদিতপ্রাণ"
              intro="শিক্ষার্থীদের এগিয়ে নিতে আমাদের শিক্ষকমণ্ডলী প্রতিদিন কাজ করে চলেছেন।"
            />
            <div className="teacher-grid">
              {content.teachers.slice(0, 6).map((teacher) => (
                <article className="teacher-card" key={teacher.id}>
                  <div className="teacher-photo">
                    <SmartImage src={teacher.photo_url} alt={teacher.name} transform={{ width: 520, height: 640, fit: "cover" }} label={teacher.name} accent="#166534" />
                  </div>
                  <h3>{teacher.name}</h3>
                  <p>{teacher.role}</p>
                  {teacher.subject ? <p className="teacher-subject">{teacher.subject}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="section page-width gallery-section" id="gallery">
          <SectionHeading
            eyebrow="ছবিতে ক্যাম্পাস"
            title="আমাদের গ্যালারি"
            intro="শিক্ষা, বিজ্ঞান, সংস্কৃতি ও আনন্দের কিছু মুহূর্ত।"
            action={<span className="clubs-count"><Trophy size={14} /> {bn(content.gallery.length)} <small>টি ছবি</small></span>}
          />
          <GalleryViewer
            columns={4}
            items={content.gallery.slice(0, 8).map((item) => ({
              src: item.image_url,
              caption: item.caption,
              meta: [item.event_name, formatDate(item.taken_on)].filter(Boolean).join(" · "),
            }))}
          />
          {galleryNote ? (
            <div className="gallery-note"><Sparkles size={18} /><span>{galleryNote}</span></div>
          ) : null}
        </section>

        {quoteText ? (
          <section className="quote-section">
            <div className="page-width quote-inner">
              <Quote size={34} />
              <blockquote>
                {quoteText}
                {quoteAuthor ? <cite>{quoteAuthor}</cite> : null}
              </blockquote>
            </div>
          </section>
        ) : null}

        <section className="closing-cta page-width">
          <div>
            <p className="eyebrow"><span className="eyebrow-dot" />আপনার পাশে আমরা</p>
            <h2>আজই কথা বলুন<br /><em>ওমর পরিবারের সাথে।</em></h2>
            {paragraphs(settingValue(settings, "club_mission")).length ? <p className="closing-note">{settingValue(settings, "club_mission")}</p> : null}
          </div>
          <a className="button button-green" href={`tel:${phone.replace(/\s/g, "")}`}>হেল্পলাইনে কল করুন <Phone size={16} /></a>
        </section>
      </main>
    </PublicChrome>
  );
}

function NewsCard({ item }: { item: PublicContent["news"][number] }) {
  const club = item.club_slug ? { slug: item.club_slug } : null;
  return (
    <article className="news-card">
      <a href={`/news/${item.slug}`} className="news-image">
        <SmartImage src={item.image_url} alt={item.title} transform={{ width: 900, fit: "cover" }} label={item.title} accent="#e7c27e" />
        <span>{item.category}</span>
        <i><ArrowUpRight size={17} /></i>
      </a>
      <div className="news-card-copy">
        <div className="news-meta">
          <time>{formatDate(item.published_at)}</time>
          <span>{item.author}</span>
        </div>
        <h3><a href={`/news/${item.slug}`}>{item.title}</a></h3>
        {item.excerpt ? <p>{item.excerpt}</p> : null}
        <div className="news-card-foot">
          <a className="text-link" href={`/news/${item.slug}`}>বিস্তারিত পড়ুন <ArrowRight size={15} /></a>
          {club ? <a className="news-club-tag" href={clubPath(club.slug)}>সংশ্লিষ্ট ক্লাব <ArrowUpRight size={12} /></a> : null}
        </div>
      </div>
    </article>
  );
}
