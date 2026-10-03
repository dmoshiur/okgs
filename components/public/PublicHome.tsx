import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BusFront,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Facebook,
  GraduationCap,
  Home,
  Library,
  Mail,
  MapPin,
  Monitor,
  Phone,
  Quote,
  ShieldCheck,
  Sparkles,
  Trophy,
  Utensils,
  Users,
} from "lucide-react";
import type { Club, NewsItem, PublicContent, SiteSetting } from "@/lib/types";
import { normalizeClubDomain } from "@/lib/content-config";
import { HeroCarousel } from "@/components/public/HeroCarousel";
import { MobileNav } from "@/components/public/MobileNav";
import { OfficialLogo } from "@/components/public/OfficialLogo";

const officialBase = "https://omarkgschool.com/images";

const teachers = [
  { name: "ওমর আব্দুল আজিজ তালুকদার", role: "অধ্যক্ষ", image: `${officialBase}/teacher-omar.jpg` },
  { name: "মোঃ রহমতুল্লাহ পিকে", role: "সহকারী প্রধান শিক্ষক", image: `${officialBase}/teacher-rahomotullah.jpg` },
  { name: "মোঃ মেহেরুল ইসলাম", role: "সহকারী শিক্ষক", image: `${officialBase}/teacher-meherul.jpg` },
  { name: "মোছাঃ ফাতেমা আক্তার", role: "সহকারী শিক্ষিকা", image: `${officialBase}/teacher-fatema.jpg` },
  { name: "মোছাঃ রোজিনা আক্তার রোজি", role: "হিসাব কর্মকর্তা", image: `${officialBase}/staff-rozina.png` },
];

const gallery = [
  { src: `${officialBase}/hero-building.jpg`, alt: "স্কুলের মূল ভবন" },
  { src: `${officialBase}/hero-assembly.jpg`, alt: "শিক্ষার্থীদের এসেম্বলি" },
  { src: `${officialBase}/hero-punjabi-day.jpg`, alt: "পাঞ্জাবি ডে" },
  { src: `${officialBase}/gallery-1.jpg`, alt: "স্কুলের কার্যক্রম" },
  { src: `${officialBase}/gallery-2.jpg`, alt: "আর্ট প্রতিযোগিতা" },
  { src: `${officialBase}/gallery-3.jpg`, alt: "শিক্ষার্থীদের কার্যক্রম" },
  { src: `${officialBase}/gallery-4.jpg`, alt: "শিক্ষার্থীরা" },
  { src: `${officialBase}/science-fair-2.jpg`, alt: "বিজ্ঞান মেলা" },
];

const facilities = [
  { icon: BusFront, title: "বাস সার্ভিস", text: "শিক্ষার্থীদের যাতায়াতের জন্য নিজস্ব বাসের ব্যবস্থা।" },
  { icon: ShieldCheck, title: "শিক্ষার্থীর নিরাপত্তা", text: "সি.সি ক্যামেরায় সার্বক্ষণিক তত্ত্বাবধান ও ইভটিজিং প্রতিরোধ সেল।" },
  { icon: Home, title: "আবাসিক ব্যবস্থা", text: "ছেলে ও মেয়েদের জন্য আলাদা, শান্ত ও নিরাপদ আবাসিক ভবন।" },
  { icon: Monitor, title: "কম্পিউটার ল্যাব", text: "আধুনিক কম্পিউটার ল্যাব ও সবার জন্য কম্পিউটার শিক্ষা।" },
  { icon: Library, title: "সমৃদ্ধ পাঠাগার", text: "দুই হাজারের বেশি বই নিয়ে নিজস্ব পাঠাগার।" },
  { icon: Utensils, title: "ক্যান্টিন", text: "স্কুল ক্যাম্পাসেই স্বাস্থ্যসম্মত খাবারের নিজস্ব ক্যান্টিন।" },
];

function settingValue(settings: SiteSetting[], key: string, fallback: string) {
  return settings.find((setting) => setting.key === key)?.value || fallback;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function Logo() {
  return <a href="#top" className="brand" aria-label="ওমর কিন্ডারগার্টেন স্কুল - হোম"><OfficialLogo /><span className="brand-copy"><strong>ওমর কিন্ডারগার্টেন স্কুল</strong><small>ওমর গার্টেন একাডেমি · কালাই, জয়পুরহাট</small></span></a>;
}

function SectionHeading({ eyebrow, title, intro, action }: { eyebrow: string; title: string; intro?: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div><p className="eyebrow"><span className="eyebrow-dot" />{eyebrow}</p><h2>{title}</h2></div>{intro ? <p className="section-intro">{intro}</p> : null}{action}</div>;
}

function NoticeList({ notices }: { notices: PublicContent["notices"] }) {
  return <div className="notice-list">{notices.slice(0, 3).map((notice, index) => <article className="notice-item" key={notice.id}><span className="notice-number">০{index + 1}</span><div><div className="notice-meta"><span>{notice.type}</span><time>{formatDate(notice.published_at)}</time></div><h3>{notice.title}</h3><p>{notice.body}</p></div><ArrowUpRight className="notice-arrow" size={18} /></article>)}{!notices.length ? <p className="empty-copy">নতুন নোটিশ শিগগিরই প্রকাশিত হবে।</p> : null}</div>;
}

function NewsCard({ item }: { item: NewsItem }) {
  return <article className="news-card"><a href={`/news/${item.slug}`} className="news-image" style={{ backgroundImage: `url("${item.image_url}")` }} aria-label={item.title}><span>{item.category}</span><i><ArrowUpRight size={17} /></i></a><div className="news-card-copy"><div className="news-meta"><time>{formatDate(item.published_at)}</time><span>{item.author}</span></div><h3><a href={`/news/${item.slug}`}>{item.title}</a></h3><p>{item.excerpt}</p><a className="text-link" href={`/news/${item.slug}`}>বিস্তারিত পড়ুন <ArrowRight size={15} /></a></div></article>;
}

function ClubCard({ club }: { club: Club }) {
  const href = normalizeClubDomain(club.domain || "", club.slug);
  return <a className="club-card" href={href} style={{ "--club-accent": club.accent } as React.CSSProperties}><div className="club-photo" style={{ backgroundImage: `url("${club.image_url}")` }}><span className="club-icon"><Sparkles size={20} /></span><span className="club-open">ক্লাব প্রোফাইল <ExternalArrow /></span></div><div className="club-card-copy"><span className="club-index">০{club.sort_order}</span><h3>{club.name}</h3><p className="club-tagline">{club.tagline}</p><p>{club.description}</p><span className="club-link">প্রবেশ করুন <ArrowUpRight size={15} /></span></div></a>;
}

function ExternalArrow() {
  return <ArrowUpRight size={13} />;
}

export function PublicHome({ content }: { content: PublicContent }) {
  const about = settingValue(content.settings, "about", "ওমর কিন্ডারগার্টেন স্কুল ও ওমর গার্টেন একাডেমি জয়পুরহাট জেলার কালাই উপজেলা সদরে অবস্থিত একটি স্বনামধন্য শিক্ষা প্রতিষ্ঠান।");
  const mission = settingValue(content.settings, "mission", "মানসম্মত শিক্ষা, শৃঙ্খলা ও মানবিক মূল্যবোধে গড়ে তুলি আগামী প্রজন্ম।");
  const email = settingValue(content.settings, "email", "okgs2003@gmail.com");
  const address = settingValue(content.settings, "address", "কালাই সদর, জয়পুরহাট");
  const phone = settingValue(content.settings, "phone", "01711857205");
  const secondaryPhone = settingValue(content.settings, "phone_secondary", "05725-56351-52");
  const schoolName = settingValue(content.settings, "site_name", "ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি");
  const featuredNews = content.news.find((item) => item.is_featured) || content.news[0];
  const otherNews = content.news.filter((item) => item.id !== featuredNews?.id).slice(0, 2);

  return <div id="top" className="public-site">
    <div className="topline"><div className="page-width topline-inner"><span><Phone size={13} /> হেল্পলাইন: <a href={`tel:${phone}`}>{phone}</a> · <a href={`mailto:${email}`}>{email}</a></span><a href="#admission">২০২৬ শিক্ষাবর্ষে ভর্তি চলছে <ArrowUpRight size={13} /></a></div></div>
    <header className="site-header page-width"><Logo /><nav className="main-nav" aria-label="প্রধান মেনু"><a href="#about">আমাদের সম্পর্কে</a><a href="#facilities">সুবিধাসমূহ</a><a href="#clubs">ক্লাবসমূহ</a><a href="#gallery">গ্যালারি</a><a href="#contact">যোগাযোগ</a></nav><div className="header-actions"><a className="header-admin" href="/admin/login">অ্যাডমিন <ArrowUpRight size={13} /></a><a className="button button-green button-small" href="#admission">ভর্তি তথ্য <ArrowUpRight size={14} /></a></div><MobileNav email={email} /></header>

    <main>
      <section className="hero-section"><HeroCarousel slides={content.slides} /></section>
      <section className="notice-ribbon"><div className="page-width notice-ribbon-inner"><span className="notice-ribbon-label"><Sparkles size={15} /> জরুরি নোটিশ</span><p>{content.notices[0]?.title || "নতুন নোটিশ শিগগিরই প্রকাশিত হবে"}</p><a href="#notices">সব নোটিশ <ArrowRight size={15} /></a></div></section>

      <section className="section page-width about-section" id="about"><SectionHeading eyebrow="আমাদের পরিচয়" title="শিক্ষায় গড়ি আলোকিত ভবিষ্যৎ" intro="প্লে থেকে দশম শ্রেণি পর্যন্ত আবাসিক ও অনাবাসিক পাঠদান।" action={<a className="text-link section-action" href="https://omarkgschool.com/about.html">বিস্তারিত ইতিহাস <ArrowUpRight size={15} /></a>} /><div className="about-grid"><div className="about-image" style={{ backgroundImage: `url("${officialBase}/mission.jpg")` }}><span>প্রতিষ্ঠা: ২০০৩</span></div><div className="about-copy"><p className="about-lead">{about}</p><p>বিশিষ্ট শিক্ষানুরাগী আলহাজ্ব আব্দুর রশিদ তালুকদার ২০০৩ সালের ১লা জানুয়ারি প্রতিষ্ঠানটি প্রতিষ্ঠা করেন। আজ এখানে রয়েছে নিজস্ব পাঠাগার, আধুনিক কম্পিউটার ল্যাব, আবাসিক ব্যবস্থা ও স্কুল বাস।</p><p>{mission}</p><a className="button button-green" href="https://omarkgschool.com/about.html">আমাদের ইতিহাস <ArrowRight size={16} /></a></div></div></section>

      <section className="stats-strip"><div className="page-width stats-grid"><div><strong>২০০৩</strong><span>প্রতিষ্ঠা সাল</span></div><div><strong>১১০০+</strong><span>শিক্ষার্থী</span></div><div><strong>৮০</strong><span>শিক্ষক-কর্মচারী</span></div><div><strong>১০০%</strong><span>পাবলিক পরীক্ষায় পাশ</span></div></div></section>

      <section className="section page-width facilities-section" id="facilities"><SectionHeading eyebrow="ক্যাম্পাস সুবিধা" title="শেখার জন্য সুন্দর পরিবেশ" intro="শিক্ষার্থীদের নিরাপদ, আনন্দময় ও আধুনিক শিক্ষাজীবনের জন্য প্রয়োজনীয় সুবিধা।" /><div className="facility-grid">{facilities.map(({ icon: Icon, title, text }) => <article className="facility-card" key={title}><span className="facility-icon"><Icon size={22} /></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <section className="admission-section" id="admission"><div className="page-width admission-grid"><div className="admission-copy"><p className="eyebrow eyebrow-light"><span className="eyebrow-dot" />ভর্তি চলছে</p><h2>আপনার সন্তানের<br /><em>উজ্জ্বল ভবিষ্যৎ</em> শুরু হোক।</h2><p>প্লে থেকে দশম শ্রেণি পর্যন্ত আবাসিক ও অনাবাসিক ভর্তি চলছে। প্রি-প্রাইমারিতে আবাকাস, স্পোকেন ইংলিশ, কম্পিউটার ও কুরআন শিক্ষায় বিশেষ গুরুত্ব দেওয়া হয়।</p><div className="admission-actions"><a className="button button-gold" href="https://omarkgschool.com/admission.html">ভর্তি সংক্রান্ত তথ্য <ArrowUpRight size={16} /></a><a className="admission-phone" href="tel:01329625700"><Phone size={15} /> ০১৩২৯-৬২৫৭০০</a></div></div><div className="admission-image" style={{ backgroundImage: `url("${officialBase}/admission-notice.jpg")` }}><span>আবাসিক / অনাবাসিক</span></div></div></section>

      <section className="section page-width notices-section" id="notices"><SectionHeading eyebrow="সর্বশেষ ঘোষণা" title="নোটিশ বোর্ড" intro="স্কুলের গুরুত্বপূর্ণ খবর ও ঘোষণা এক জায়গায়।" action={<a className="text-link section-action" href="https://omarkgschool.com/">আরও দেখুন <ArrowRight size={15} /></a>} /><NoticeList notices={content.notices} /></section>

      <section className="section page-width clubs-section" id="clubs"><SectionHeading eyebrow="সহশিক্ষা কার্যক্রম" title="আমাদের ক্লাবসমূহ" intro="শিক্ষার্থীদের প্রতিভা, কৌতূহল ও নেতৃত্ব বিকাশে সক্রিয় ক্লাব।" action={<span className="clubs-count">০৫ <small>টি ক্লাব</small></span>} /><div className="clubs-grid">{content.clubs.slice(0, 5).map((club) => <ClubCard key={club.id} club={club} />)}</div></section>

      <section className="section page-width journal-section" id="news"><SectionHeading eyebrow="সংবাদ ও আপডেট" title="স্কুলের খবর" intro="ক্যাম্পাসের কার্যক্রম, সাফল্য ও নতুন সংবাদ।" action={<a className="text-link section-action" href="/news">সব সংবাদ <ArrowRight size={15} /></a>} />{featuredNews ? <div className="news-layout"><NewsCard item={featuredNews} />{otherNews.length ? <div className="news-side-list">{otherNews.map((item) => <NewsCard key={item.id} item={item} />)}</div> : null}</div> : <p className="empty-copy">নতুন সংবাদ শিগগিরই প্রকাশিত হবে।</p>}</section>

      <section className="section updates-section"><div className="page-width"><SectionHeading eyebrow="দৈনন্দিন খবর" title="সর্বশেষ আপডেট" intro="স্কুলের চলমান কার্যক্রমের সংক্ষিপ্ত খবর।" /><div className="updates-list">{content.updates.slice(0, 4).map((update, index) => <article className="update-row" key={update.id}><span className="update-number">০{index + 1}</span><span className="update-date"><CalendarDays size={14} />{formatDate(update.date)}</span><div><span className="update-kind">{update.kind}</span><h3>{update.title}</h3><p>{update.description}</p></div><ChevronRight size={17} /></article>)}{!content.updates.length ? <p className="empty-copy">আপডেট শিগগিরই প্রকাশিত হবে।</p> : null}</div></div></section>

      <section className="section page-width teachers-section" id="teachers"><SectionHeading eyebrow="আমাদের শিক্ষকবৃন্দ" title="অভিজ্ঞ ও নিবেদিতপ্রাণ" intro="শিক্ষার্থীদের এগিয়ে নিতে আমাদের শিক্ষকমণ্ডলী প্রতিদিন কাজ করে চলেছেন।" /><div className="teacher-grid">{teachers.map((teacher) => <article className="teacher-card" key={teacher.name}><div className="teacher-photo" style={{ backgroundImage: `url("${teacher.image}")` }} /><h3>{teacher.name}</h3><p>{teacher.role}</p></article>)}</div></section>

      <section className="section page-width gallery-section" id="gallery"><SectionHeading eyebrow="ছবিতে ক্যাম্পাস" title="আমাদের গ্যালারি" intro="শিক্ষা, বিজ্ঞান, সংস্কৃতি ও আনন্দের কিছু মুহূর্ত।" action={<a className="text-link section-action" href="https://omarkgschool.com/gallery">সব ছবি <ArrowRight size={15} /></a>} /><div className="gallery-grid">{gallery.map((item) => <a href={item.src} target="_blank" rel="noreferrer" key={item.src}><img src={item.src} alt={item.alt} /></a>)}</div><div className="gallery-note"><Sparkles size={18} /><span><strong>ART ODYSSEY</strong> — প্রতি বছর আয়োজিত বিজ্ঞান মেলা, ক্র্যাফটিং, নাটক, গান, কবিতা ও আইসিটি প্রতিযোগিতা।</span></div></section>

      <section className="quote-section"><div className="page-width quote-inner"><Quote size={34} /><blockquote>“বাংলাদেশের অন্যতম সেরা শিক্ষা প্রতিষ্ঠান।”<cite>— একজন অভিভাবক</cite></blockquote></div></section>
      <section className="closing-cta page-width"><div><p className="eyebrow"><span className="eyebrow-dot" />আপনার পাশে আমরা</p><h2>আজই কথা বলুন<br /><em>ওমর পরিবারের সাথে।</em></h2></div><a className="button button-green" href={`tel:${phone}`}>হেল্পলাইনে কল করুন <Phone size={16} /></a></section>
    </main>

    <footer className="site-footer" id="contact"><div className="page-width footer-grid"><div className="footer-brand"><Logo /><p>২০০৩ সাল থেকে মানসম্মত শিক্ষায় নিবেদিত।</p><a href={`mailto:${email}`} className="footer-email"><Mail size={14} /> {email}</a></div><div className="footer-links"><div><span>দ্রুত লিংক</span><a href="#about">আমাদের সম্পর্কে</a><a href="#facilities">সুবিধাসমূহ</a><a href="#clubs">ক্লাবসমূহ</a><a href="#gallery">গ্যালারি</a></div><div><span>যোগাযোগ</span><p><MapPin size={14} /> {address}</p><p><Phone size={14} /> {phone}</p><p><Phone size={14} /> {secondaryPhone}</p><p><Mail size={14} /> {email}</p></div><div><span>অনলাইন</span><a href="https://www.facebook.com/omarkgschool/" target="_blank" rel="noreferrer"><Facebook size={14} /> ফেসবুক পেজ</a><a href="https://www.youtube.com/channel/UCE-VL9Ap-kLeKuvM1D3mmYA" target="_blank" rel="noreferrer"><PlayIcon /> ইউটিউব চ্যানেল</a><a href="/admin/login">অ্যাডমিন প্যানেল <ArrowUpRight size={13} /></a></div></div></div><div className="page-width footer-bottom"><span>© ২০২৬ {schoolName}</span><span>সবার জন্য মানসম্মত শিক্ষা</span><span>ওয়েবসাইট পরিচালনা: OKGS</span></div></footer>
  </div>;
}

function PlayIcon() {
  return <span className="play-icon">▶</span>;
}
