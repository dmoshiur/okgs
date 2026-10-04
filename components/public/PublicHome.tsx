import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Images,
  Phone,
  Quote,
  Sparkles,
  Trophy,
  Users,
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
      <span className="notice-number" aria-hidden>{bn(index + 1).padStart(2, "০")}</span>
      <div>
        <div className="notice-meta">
          <span>{notice.type}</span>
          <time dateTime={notice.published_at}>{formatDate(notice.published_at)}</time>
        </div>
        <h3>{notice.title}</h3>
        <p>{notice.body}</p>
        {notice.club_slug ? (
          <a className="notice-club-link" href={clubPath(notice.club_slug)}>সংশ্লিষ্ট ক্লাব <ArrowUpRight size={13} aria-hidden /></a>
        ) : null}
      </div>
      <ArrowUpRight className="notice-arrow" size={18} aria-hidden />
    </article>
  );
}

/** Shown until the first real photos are uploaded — intentional, not a grey box. */
const campusPlaceholders = [
  { src: "/media/campus-assembly.svg", label: "সকালের সমাবেশ" },
  { src: "/media/campus-lab.svg", label: "বিজ্ঞানাগার" },
  { src: "/media/campus-library.svg", label: "গ্রন্থাগার" },
  { src: "/media/campus-ground.svg", label: "খেলার মাঠ" },
];

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
  const siteName = settingValue(settings, "site_name", "ওমর কিন্ডারগার্টেন স্কুল");
  const shortName = settingValue(settings, "short_name", "OKGS");
  const foundedYear = settingValue(settings, "hero_badge_year", "২০০৩");
  const place = settingValue(settings, "hero_badge_place", "কালাই, জয়পুরহাট");
  const address = settingValue(settings, "address", place);

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
  const totalPhotos = content.gallery.length;
  const tel = `tel:${phone.replace(/[\s-]/g, "")}`;

  return (
    <PublicChrome content={content} active="home">
      <div className="home-main">
        <section className="hero" aria-label="প্রতিষ্ঠানের পরিচিতি">
          <HeroCarousel
            slides={content.slides}
            badge={{ year: foundedYear, place }}
            facts={[
              { value: foundedYear, label: "সালে প্রতিষ্ঠিত" },
              { value: bn(clubSummaries.length), label: "টি সহশিক্ষা ক্লাব" },
              { value: place, label: "" },
            ].filter((fact) => fact.value)}
          />
        </section>

        <section className="notice-ribbon" aria-label="সাম্প্রতিক নোটিশ">
          <div className="page-width notice-ribbon-inner">
            <span className="notice-ribbon-label"><Sparkles size={14} aria-hidden /> সাম্প্রতিক নোটিশ</span>
            <p>{content.notices[0]?.title || "নতুন নোটিশ শিগগিরই প্রকাশিত হবে"}</p>
            <a href="#notices">সব নোটিশ <ArrowRight size={15} aria-hidden /></a>
          </div>
        </section>

        <FairMega content={content} />

        {/* ---------------------------------------------- our institution --- */}
        <section className="section page-width reveal" id="about" aria-labelledby="about-title">
          <div className="about-grid">
            <div className="about-visual">
              <div className="about-image">
                <SmartImage
                  src={aboutImage}
                  alt={`${siteName} — ক্যাম্পাস`}
                  transform={{ width: 1100, height: 830, fit: "cover" }}
                  accent="#0b2136"
                  label="ক্যাম্পাস"
                />
                <span><Trophy size={14} aria-hidden /> প্রতিষ্ঠা {foundedYear}</span>
              </div>
            </div>

            <div className="about-copy">
              <p className="eyebrow"><span className="eyebrow-dot" aria-hidden />আমাদের প্রতিষ্ঠান</p>
              <h2 id="about-title">{siteName}</h2>
              {about ? <p className="about-lead">{about}</p> : null}
              {founder ? <p>{founder}</p> : null}
              {aboutExtra ? <p>{aboutExtra}</p> : null}
              {mission ? <p>{mission}</p> : null}

              <dl className="about-meta">
                <div>
                  <dt>প্রতিষ্ঠা</dt>
                  <dd>{foundedYear}</dd>
                </div>
                <div>
                  <dt>অবস্থান</dt>
                  <dd>{address}</dd>
                </div>
                <div>
                  <dt>প্রতিষ্ঠানের ধরন</dt>
                  <dd>কিন্ডারগার্টেন থেকে দশম শ্রেণি · আবাসিক ও অনাবাসিক</dd>
                </div>
                <div>
                  <dt>একাডেমিক ফোকাস</dt>
                  <dd>{content.clubs.length ? content.clubs.map((club) => club.name).slice(0, 2).join(", ") : "বিজ্ঞান, ভাষা ও সংস্কৃতি"}</dd>
                </div>
              </dl>

              <div className="about-actions">
                <a className="button button-primary" href="/clubs">
                  আমাদের ক্লাবসমূহ <ArrowRight size={16} aria-hidden />
                </a>
                <a className="text-link" href="#contact">
                  যোগাযোগ করুন <ArrowUpRight size={14} aria-hidden />
                </a>
              </div>
            </div>
          </div>
        </section>

        {stats.length ? (
          <section className="stats-strip" aria-label="এক নজরে">
            <div className="page-width">
              <div className="stats-grid">
                {stats.map((stat) => (
                  <div key={stat.id}>
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* --------------------------------------------------------- clubs --- */}
        <section className="section page-width clubs-section reveal" id="clubs" aria-labelledby="clubs-title">
          <SectionHeading
            eyebrow="সহশিক্ষা কার্যক্রম"
            title="আমাদের ক্লাবসমূহ"
            titleId="clubs-title"
            intro="প্রতিটি ক্লাবের আয়োজন, কমিটি, ছবি ও অর্জন নিজস্ব পাতায় — সবই অ্যাডমিন প্যানেল থেকে হালনাগাদ হয়।"
            action={
              <span className="clubs-count">
                {bn(clubSummaries.length).padStart(2, "০")} <small>টি ক্লাব</small>
              </span>
            }
          />
          <div className="clubs-grid">
            {clubSummaries.map((summary) => <ClubCard key={summary.club.id} summary={summary} />)}
          </div>
          <div className="clubs-foot">
            <div>
              <a className="button button-primary" href="/clubs">
                সব ক্লাবের তথ্য <ArrowRight size={15} aria-hidden />
              </a>
            </div>
            <span className="clubs-foot-note">
              {bn(totalAchievements)} টি প্রকাশিত অর্জন · {bn(upcomingEvents.length)} টি আসন্ন আয়োজন · {bn(totalPhotos)} টি ছবি
            </span>
          </div>
        </section>

        <ClubShowcase
          clubs={clubSummaries.map((summary) => summary.club)}
          slides={content.slides}
          counts={Object.fromEntries(clubSummaries.map((summary) => [summary.club.slug, summary.counts.gallery]))}
        />

        {/* ---------------------------------------------- club calendar ----- */}
        <section className="section page-width club-pulse-strip reveal" id="club-pulse" aria-labelledby="pulse-title">
          <SectionHeading
            eyebrow="ক্লাব ক্যালেন্ডার"
            title="এই সময়ের আয়োজন"
            titleId="pulse-title"
            intro="সব ক্লাবের আসন্ন অনুষ্ঠান, তারিখ ও স্থান এক নজরে।"
          />
          {upcomingEvents.length ? (
            <div className="pulse-list">
              {upcomingEvents.map((event) => (
                <a
                  key={event.id}
                  className="pulse-row"
                  href={clubPath(event.club_slug, "events")}
                  style={{ "--club-accent": content.clubs.find((club) => club.slug === event.club_slug)?.accent || "#c8963e" } as React.CSSProperties}
                >
                  <span className="pulse-when"><CalendarClock size={13} aria-hidden /> {formatDate(event.event_date, "short")}</span>
                  <span className="pulse-main">
                    <strong>{event.title}</strong>
                    <small>{clubNameFor(event.club_slug)}{event.venue ? ` · ${event.venue}` : ""}</small>
                  </span>
                  <span className="pulse-type">{event.event_type || "আয়োজন"}</span>
                  <ChevronRight size={17} aria-hidden />
                </a>
              ))}
            </div>
          ) : (
            <p className="empty-copy">সম্প্রতি কোনো আয়োজন প্রকাশিত হয়নি।</p>
          )}
        </section>

        {/* ---------------------------------------------------- facilities --- */}
        <section className="section page-width section-line reveal" id="facilities" aria-labelledby="facilities-title">
          <SectionHeading
            eyebrow="ক্যাম্পাস সুবিধা"
            title="শেখার জন্য সুন্দর পরিবেশ"
            titleId="facilities-title"
            intro="শিক্ষার্থীদের নিরাপদ, আনন্দময় ও আধুনিক শিক্ষাজীবনের জন্য প্রয়োজনীয় সুবিধা।"
          />
          <div className="facility-grid">
            {content.facilities.map((facility) => (
              <article className="facility-card" key={facility.id}>
                <span className="facility-icon" aria-hidden><IconByName name={facility.icon} size={22} /></span>
                <h3>{facility.title}</h3>
                <p>{facility.description}</p>
              </article>
            ))}
            {!content.facilities.length ? <p className="empty-copy">সুবিধার তালিকা শিগগিরই যুক্ত হবে।</p> : null}
          </div>
        </section>

        {/* ----------------------------------------------------- admission --- */}
        <section className="admission-section" id="admission" aria-labelledby="admission-title">
          <div className="page-width admission-grid">
            <div className="admission-copy">
              <p className="eyebrow eyebrow-light"><span className="eyebrow-dot" aria-hidden />ভর্তি চলছে</p>
              <h2 id="admission-title">আপনার সন্তানের <em>উজ্জ্বল ভবিষ্যৎ</em> শুরু হোক।</h2>
              <p>{admissionNote}</p>
              <div className="admission-actions">
                <a className="button button-accent" href="#contact">
                  যোগাযোগ করুন <ArrowUpRight size={16} aria-hidden />
                </a>
                <a className="admission-phone" href={tel}>
                  <Phone size={15} aria-hidden /> {admissionPhone}
                </a>
              </div>
            </div>
            <div className="admission-image">
              <SmartImage
                src={admissionImage}
                alt="ভর্তি কার্যালয়"
                transform={{ width: 1000, height: 800, fit: "cover" }}
                accent="#0b2136"
                label="ভর্তি কার্যালয়"
              />
              <span>আবাসিক / অনাবাসিক</span>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- notices --- */}
        <section className="section page-width reveal" id="notices" aria-labelledby="notices-title">
          <SectionHeading
            eyebrow="সর্বশেষ ঘোষণা"
            title="নোটিশ বোর্ড"
            titleId="notices-title"
            intro="স্কুল ও ক্লাবের গুরুত্বপূর্ণ খবর এক জায়গায়।"
            action={<a className="text-link section-action" href="/news">সংবাদ ও আপডেট <ArrowRight size={15} aria-hidden /></a>}
          />
          <div className="notice-list">
            {content.notices.slice(0, 4).map((notice, index) => <NoticeRow key={notice.id} notice={notice} index={index} />)}
            {!content.notices.length ? <p className="empty-copy" style={{ padding: 24 }}>নতুন নোটিশ শিগগিরই প্রকাশিত হবে।</p> : null}
          </div>
        </section>

        {/* ---------------------------------------------------------- news --- */}
        <section className="section page-width reveal" id="news" aria-labelledby="news-title">
          <SectionHeading
            eyebrow="সংবাদ ও আপডেট"
            title="স্কুলের খবর"
            titleId="news-title"
            intro="ক্যাম্পাসের কার্যক্রম, সাফল্য ও নতুন সংবাদ।"
            action={<a className="text-link section-action" href="/news">সব সংবাদ <ArrowRight size={15} aria-hidden /></a>}
          />
          {featuredNews ? (
            <div className="news-layout">
              <NewsCard item={featuredNews} featured />
              {otherNews.length ? (
                <div className="news-side-list">
                  {otherNews.map((item) => <NewsCard key={item.id} item={item} />)}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="empty-copy">নতুন সংবাদ শিগগিরই প্রকাশিত হবে।</p>
          )}
        </section>

        {/* ------------------------------------------------------- updates --- */}
        <section className="updates-section reveal" aria-labelledby="updates-title">
          <div className="page-width">
            <SectionHeading
              eyebrow="দৈনন্দিন খবর"
              title="সর্বশেষ আপডেট"
            titleId="updates-title"
              intro="স্কুলের চলমান কার্যক্রমের সংক্ষিপ্ত খবর।"
            />
            <div className="updates-list">
              {content.updates.slice(0, 4).map((update, index) => (
                <article className="update-row" key={update.id}>
                  <span className="update-number" aria-hidden>{bn(index + 1).padStart(2, "০")}</span>
                  <span className="update-date"><CalendarClock size={14} aria-hidden />{formatDate(update.date)}</span>
                  <div>
                    <span className="update-kind">{update.kind}</span>
                    <h3>{update.title}</h3>
                    <p>{update.description}</p>
                  </div>
                  <ChevronRight size={17} aria-hidden />
                </article>
              ))}
              {!content.updates.length ? <p className="empty-copy" style={{ padding: 24 }}>আপডেট শিগগিরই প্রকাশিত হবে।</p> : null}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ teachers --- */}
        {content.teachers.length ? (
          <section className="section page-width reveal" id="teachers" aria-labelledby="teachers-title">
            <SectionHeading
              eyebrow="আমাদের শিক্ষকবৃন্দ"
              title="অভিজ্ঞ ও নিবেদিতপ্রাণ"
            titleId="teachers-title"
              intro="শিক্ষার্থীদের এগিয়ে নিতে আমাদের শিক্ষকমণ্ডলী প্রতিদিন কাজ করে চলেছেন।"
              action={<span className="clubs-count"><Users size={14} aria-hidden /> {bn(content.teachers.length)} <small>জন শিক্ষক</small></span>}
            />
            <div className="teacher-grid">
              {content.teachers.slice(0, 6).map((teacher) => (
                <article className="teacher-card" key={teacher.id}>
                  <div className="teacher-photo">
                    <SmartImage
                      src={teacher.photo_url}
                      alt={teacher.name}
                      transform={{ width: 520, height: 400, fit: "cover" }}
                      label={teacher.name}
                      accent="#0b2136"
                    />
                  </div>
                  <h3>{teacher.name}</h3>
                  <p>{teacher.role}</p>
                  {teacher.subject ? <p className="teacher-subject">{teacher.subject}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {/* ------------------------------------------------------- gallery --- */}
        <section className="section page-width reveal" id="gallery" aria-labelledby="gallery-title">
          <SectionHeading
            eyebrow="ছবিতে ক্যাম্পাস"
            title="আমাদের গ্যালারি"
            titleId="gallery-title"
            intro="শিক্ষা, বিজ্ঞান, সংস্কৃতি ও আনন্দের কিছু মুহূর্ত।"
            action={
              <span className="clubs-count">
                <Images size={14} aria-hidden /> {bn(totalPhotos)} <small>টি ছবি</small>
              </span>
            }
          />
          {totalPhotos ? (
            <GalleryViewer
              columns={4}
              items={content.gallery.slice(0, 8).map((item) => ({
                src: item.image_url,
                caption: item.caption,
                meta: [item.event_name, formatDate(item.taken_on)].filter(Boolean).join(" · "),
              }))}
            />
          ) : (
            <div className="gallery-grid gallery-cols-4">
              {campusPlaceholders.map((shot) => (
                <figure className="gallery-tile gallery-tile-static" key={shot.src}>
                  <img src={shot.src} alt="" loading="lazy" decoding="async" />
                  <figcaption className="gallery-tile-caption">
                    <strong>{shot.label}</strong>
                    <small>নমুনা চিত্র</small>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {galleryNote ? (
            <div className="gallery-note"><Sparkles size={18} aria-hidden /><span>{galleryNote}</span></div>
          ) : null}
        </section>

        {quoteText ? (
          <section className="quote-section" aria-label="উদ্ধৃতি">
            <div className="page-width quote-inner">
              <Quote size={30} aria-hidden />
              <blockquote>
                {quoteText}
                {quoteAuthor ? <cite>{quoteAuthor}</cite> : null}
              </blockquote>
            </div>
          </section>
        ) : null}

        <section className="closing-cta page-width" aria-labelledby="closing-title">
          <div>
            <p className="eyebrow"><span className="eyebrow-dot" aria-hidden />আপনার পাশে আমরা</p>
            <h2 id="closing-title">আজই কথা বলুন <em>{shortName} পরিবারের সাথে।</em></h2>
            {paragraphs(settingValue(settings, "club_mission")).length ? (
              <p className="closing-note">{settingValue(settings, "club_mission")}</p>
            ) : null}
          </div>
          <a className="button button-primary" href={tel}>হেল্পলাইনে কল করুন <Phone size={16} aria-hidden /></a>
        </section>
      </div>
    </PublicChrome>
  );
}

function NewsCard({ item, featured = false }: { item: PublicContent["news"][number]; featured?: boolean }) {
  const club = item.club_slug ? { slug: item.club_slug } : null;
  return (
    <article className="news-card">
      <a href={`/news/${item.slug}`} className="news-image" tabIndex={-1} aria-hidden>
        <SmartImage src={item.image_url} alt={item.title} transform={{ width: 1000, fit: "cover" }} label={item.title} accent="#c8963e" />
        {item.category ? <span>{item.category}</span> : null}
        {featured ? <i><ArrowUpRight size={17} aria-hidden /></i> : null}
      </a>
      <div className="news-card-copy">
        <div className="news-meta">
          <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
          {item.author ? <span>{item.author}</span> : null}
        </div>
        <h3><a href={`/news/${item.slug}`}>{item.title}</a></h3>
        {item.excerpt ? <p>{item.excerpt}</p> : null}
        <div className="news-card-foot">
          <a className="text-link" href={`/news/${item.slug}`}>বিস্তারিত পড়ুন <ArrowRight size={15} aria-hidden /></a>
          {club ? <a className="news-club-tag" href={clubPath(club.slug)}>সংশ্লিষ্ট ক্লাব <ArrowUpRight size={12} aria-hidden /></a> : null}
        </div>
      </div>
    </article>
  );
}
