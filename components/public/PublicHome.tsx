import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  ExternalLink,
  Instagram,
  Mail,
  MapPin,
  MessagesSquare,
  Palette,
  Quote,
  Sparkles,
  Sprout,
  Trophy,
  Atom,
} from "lucide-react";
import { normalizeClubDomain } from "@/lib/content-config";
import type { Club, NewsItem, PublicContent, SiteSetting } from "@/lib/types";
import { HeroCarousel } from "@/components/public/HeroCarousel";
import { MobileNav } from "@/components/public/MobileNav";

function settingValue(settings: SiteSetting[], key: string, fallback: string) {
  return settings.find((setting) => setting.key === key)?.value || fallback;
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-GB", options).format(new Date(value));
}

function clubIcon(name: string) {
  if (name === "Palette") return <Palette size={22} strokeWidth={1.7} />;
  if (name === "Atom") return <Atom size={22} strokeWidth={1.7} />;
  if (name === "Trophy") return <Trophy size={22} strokeWidth={1.7} />;
  if (name === "MessagesSquare") return <MessagesSquare size={22} strokeWidth={1.7} />;
  if (name === "Sprout") return <Sprout size={22} strokeWidth={1.7} />;
  return <Sparkles size={22} strokeWidth={1.7} />;
}

function Logo() {
  return (
    <a href="#top" className="brand" aria-label="OKGS home">
      <span className="brand-mark"><span>O</span></span>
      <span className="brand-copy"><strong>OKGS</strong><small>Omar Kindergarten School</small></span>
    </a>
  );
}

function SectionHeading({ eyebrow, title, intro, action }: { eyebrow: string; title: string; intro?: string; action?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow"><span className="eyebrow-dot" />{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {intro ? <p className="section-intro">{intro}</p> : null}
      {action}
    </div>
  );
}

function NoticeList({ notices }: { notices: PublicContent["notices"] }) {
  return (
    <div className="notice-list">
      {notices.slice(0, 4).map((notice, index) => (
        <article className="notice-item" key={notice.id}>
          <div className="notice-number">0{index + 1}</div>
          <div className="notice-content">
            <div className="notice-meta"><span>{notice.type}</span><time>{formatDate(notice.published_at)}</time></div>
            <h3>{notice.title}</h3>
            <p>{notice.body}</p>
          </div>
          <ArrowUpRight className="notice-arrow" size={19} />
        </article>
      ))}
      {!notices.length ? <p className="empty-copy">New campus notes will appear here soon.</p> : null}
    </div>
  );
}

function NewsCard({ item, featured = false }: { item: NewsItem; featured?: boolean }) {
  return (
    <article className={`news-card ${featured ? "news-card-featured" : ""}`}>
      <a href={`/news/${item.slug}`} className="news-image" style={{ backgroundImage: `url("${item.image_url}")` }} aria-label={`Read ${item.title}`}>
        <span className="image-label">{item.category}</span>
        <span className="image-arrow"><ArrowUpRight size={18} /></span>
      </a>
      <div className="news-card-copy">
        <div className="news-meta"><time>{formatDate(item.published_at)}</time><span>{item.author}</span></div>
        <h3><a href={`/news/${item.slug}`}>{item.title}</a></h3>
        <p>{item.excerpt}</p>
        <a className="text-link" href={`/news/${item.slug}`}>Read story <ArrowRight size={15} /></a>
      </div>
    </article>
  );
}

function ClubCard({ club }: { club: Club }) {
  const href = club.domain || `https://${club.slug}.okgs.info`;
  return (
    <a className="club-card" href={href} style={{ "--club-accent": club.accent } as React.CSSProperties}>
      <div className="club-photo" style={{ backgroundImage: `url("${club.image_url}")` }}>
        <span className="club-icon">{clubIcon(club.icon)}</span>
        <span className="club-open"><ExternalLink size={14} /> Portal</span>
      </div>
      <div className="club-card-copy">
        <span className="club-index">0{club.sort_order}</span>
        <h3>{club.name}</h3>
        <p className="club-tagline">{club.tagline}</p>
        <p>{club.description}</p>
        <span className="club-link">Visit {club.slug}.okgs.info <ArrowUpRight size={15} /></span>
      </div>
    </a>
  );
}

export function PublicHome({ content }: { content: PublicContent }) {
  const about = settingValue(content.settings, "about", "OKGS is a warm, future-facing school where children learn to notice deeply, make bravely and care generously.");
  const mission = settingValue(content.settings, "mission", "Grow curious minds. Grounded hearts. Generous futures.");
  const email = settingValue(content.settings, "email", "hello@okgs.info");
  const address = settingValue(content.settings, "address", "12 Orchard Lane, Dhaka 1212");
  const schoolName = settingValue(content.settings, "site_name", "Omar Kindergarten School");
  const tagline = settingValue(content.settings, "tagline", "A bright beginning for every possibility.");
  const featuredNews = content.news.find((item) => item.is_featured) || content.news[0];
  const supportingNews = content.news.filter((item) => item.id !== featuredNews?.id).slice(0, 2);

  return (
    <div id="top" className="public-site">
      <div className="topline"><div className="page-width topline-inner"><span><span className="status-pulse" /> Admissions for 2027 are now open</span><a href="mailto:admissions@okgs.info">Start a conversation <ArrowUpRight size={13} /></a></div></div>
      <header className="site-header page-width">
        <Logo />
        <nav className="main-nav" aria-label="Primary navigation">
          <a href="#about">Our story</a>
          <a href="#community">Community</a>
          <a href="#clubs">Clubs</a>
          <a href="#news">Journal</a>
        </nav>
        <div className="header-actions"><a className="header-admin" href="/admin/login">Admin <ArrowUpRight size={13} /></a><a className="button button-dark button-small" href={`mailto:${email}`}>Visit OKGS <ArrowUpRight size={14} /></a></div>
        <MobileNav email={email} />
      </header>

      <main>
        <section className="hero-section"><HeroCarousel slides={content.slides} /></section>

        <section className="intro-band page-width">
          <div className="intro-word">OKGS <span>/</span> 2026</div>
          <p>We believe the best education does more than prepare children for the world. <strong>It helps them imagine what the world could become.</strong></p>
          <a className="round-arrow" href="#about" aria-label="Explore our story"><ArrowDownRight size={21} /></a>
        </section>

        <section className="section page-width notices-section" id="notices">
          <SectionHeading eyebrow="Stay in the know" title="What’s happening" intro="The notes, invitations and little moments that keep our community moving together." action={<a className="text-link section-action" href="#updates">View all updates <ArrowRight size={15} /></a>} />
          <div className="notices-layout"><NoticeList notices={content.notices} /><aside className="notice-aside"><div className="aside-art"><span className="aside-sun" /><span className="aside-orbit orbit-one" /><span className="aside-orbit orbit-two" /><span className="aside-star">✦</span><span className="aside-art-label">A place to<br /><b>begin</b></span></div><div className="aside-caption"><span>01 / 04</span><p>There is always something worth noticing.</p></div></aside></div>
        </section>

        <section className="banner-section page-width">
          <div className="banner-grid">
            {content.banners.slice(0, 2).map((banner) => <a key={banner.id} href={banner.cta_href} className="feature-banner" style={{ "--banner-image": `url("${banner.image_url}")`, "--banner-accent": banner.accent } as React.CSSProperties}><div className="banner-overlay" /><div className="banner-content"><span className="banner-label">{banner.label}</span><h3>{banner.title}</h3><p>{banner.description}</p><span className="banner-link">{banner.cta_label} <ArrowUpRight size={15} /></span></div></a>)}
          </div>
        </section>

        <section className="story-section" id="about">
          <div className="page-width story-grid">
            <div className="story-stamp"><span className="stamp-circle">✦</span><span>Since<br /><b>1998</b></span></div>
            <div className="story-heading"><p className="eyebrow eyebrow-light"><span className="eyebrow-dot" />The OKGS point of view</p><h2>Education with<br /><em>more room</em> to wonder.</h2></div>
            <div className="story-copy"><p className="story-lead">{about}</p><p>We make space for strong foundations and surprising directions. Our teachers notice the whole child, then build learning that meets them with both challenge and care.</p><a className="button button-gold" href="#community">Meet our community <ArrowRight size={16} /></a></div>
          </div>
          <div className="story-bottom page-width"><span>Curiosity</span><span>Character</span><span>Contribution</span><span className="story-mission">{mission}</span></div>
        </section>

        <section className="section page-width community-section" id="community">
          <SectionHeading eyebrow="The whole picture" title="A community in motion" intro="A school is made from the everyday: the questions, gestures and shared rituals that help children feel they belong." />
          <div className="community-grid"><div className="community-photo photo-large" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1544776193-352d25ca82cd?auto=format&fit=crop&w=1400&q=85)" }}><span className="photo-note">Play is serious work.</span></div><div className="community-stat"><span className="stat-icon"><Sparkles size={19} /></span><strong>01</strong><h3>Wonder<br />first.</h3><p>We start with what children are already asking, then give the question somewhere beautiful to go.</p></div><div className="community-photo photo-small" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=900&q=85)" }}><span className="photo-note">Make it together.</span></div><div className="community-stat stat-soft"><span className="stat-icon"><Check size={19} /></span><strong>02</strong><h3>Care is<br />a craft.</h3><p>Kindness is not an extra here. It is how we learn, lead and leave a place better.</p></div></div>
        </section>

        <section className="section page-width journal-section" id="news">
          <SectionHeading eyebrow="From the OKGS journal" title="Latest stories" action={<a className="text-link section-action" href="/news">Open the journal <ArrowRight size={15} /></a>} />
          {featuredNews ? <div className="news-layout"><NewsCard item={featuredNews} featured /><div className="news-side-list">{supportingNews.map((item) => <NewsCard key={item.id} item={item} />)}{!supportingNews.length ? <p className="empty-copy">More stories are on their way.</p> : null}</div></div> : <p className="empty-copy">Our next story is being written now.</p>}
        </section>

        <section className="clubs-section" id="clubs">
          <div className="page-width"><SectionHeading eyebrow="Find your people" title="Five ways to get involved" intro="There is more than one way to be brilliant. Follow a question, a feeling or a new friend." action={<span className="clubs-count">05 <small>student clubs</small></span>} /><div className="clubs-grid">{content.clubs.slice(0, 5).map((club) => <ClubCard key={club.id} club={club} />)}</div></div>
        </section>

        <section className="section page-width updates-section" id="updates">
          <SectionHeading eyebrow="A little closer" title="Latest updates" intro="The short version of what is happening around campus this week." />
          <div className="updates-layout"><div className="updates-intro"><div className="updates-squiggle">✳</div><h3>Keep the<br /><em>conversation</em><br />going.</h3><p>Questions are welcome. Ideas are encouraged. We would love to hear from you.</p><a className="text-link" href={`mailto:${email}`}>{email} <ArrowUpRight size={15} /></a></div><div className="timeline">{content.updates.slice(0, 5).map((update, index) => <article className="timeline-item" key={update.id}><div className="timeline-date"><span>{formatDate(update.date, { day: "2-digit" })}</span><small>{formatDate(update.date, { month: "short" })}</small></div><div className="timeline-line"><i /></div><div className="timeline-copy"><span>{update.kind}</span><h3>{update.title}</h3><p>{update.description}</p></div><ChevronRight size={18} className="timeline-arrow" /> </article>)}{!content.updates.length ? <p className="empty-copy">Updates will appear here soon.</p> : null}</div></div>
        </section>

        <section className="closing-cta page-width"><div><p className="eyebrow"><span className="eyebrow-dot" />Your next chapter</p><h2>Come see what<br /><em>could be.</em></h2></div><a className="button button-dark" href={`mailto:${email}`}>Plan a visit <ArrowUpRight size={17} /></a><span className="closing-spark">✦</span></section>
      </main>

      <footer className="site-footer"><div className="page-width footer-grid"><div className="footer-brand"><Logo /><p>{tagline}</p><a href={`mailto:${email}`} className="footer-email">{email} <ArrowUpRight size={14} /></a></div><div className="footer-links"><div><span>Explore</span><a href="#about">Our story</a><a href="#community">Community</a><a href="#clubs">Clubs</a><a href="#news">Journal</a></div><div><span>Visit</span><a href={`mailto:${email}`}>Get in touch</a><a href="#notices">Campus notes</a><a href="/admin/login">Admin portal</a></div><div><span>Find us</span><p><MapPin size={14} />{address}</p><p><Mail size={14} />{email}</p><p><Instagram size={14} />@okgsschool</p></div></div></div><div className="page-width footer-bottom"><span>© 2026 {schoolName}</span><span>Made with care for curious minds.</span><span>Privacy / Accessibility</span></div></footer>
    </div>
  );
}
