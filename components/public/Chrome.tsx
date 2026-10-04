import {
  ArrowUpRight,
  Facebook,
  Mail,
  MapPin,
  Phone,
  Clock,
  Youtube,
} from "lucide-react";
import type { PublicContent, SiteSetting } from "@/lib/types";
import { settingValue } from "@/lib/club-data";
import { SchoolLogo } from "@/components/public/SchoolLogo";
import { MobileNav } from "@/components/public/MobileNav";
import { VisualModeToggle } from "@/components/public/VisualModeToggle";
import { primaryNav } from "@/components/public/NavigationData";
import { optimizedImage } from "@/lib/cloudinary";
import { bn } from "@/lib/format";

export { primaryNav } from "@/components/public/NavigationData";

export function siteInfo(settings: SiteSetting[]) {
  return {
    name: settingValue(settings, "site_name", "ওমর কিন্ডারগার্টেন স্কুল এন্ড ওমর গার্টেন একাডেমি"),
    shortName: settingValue(settings, "short_name", "ওকেজিএস"),
    tagline: settingValue(settings, "tagline", "কালাই, জয়পুরহাট"),
    email: settingValue(settings, "email", "okgs2003@gmail.com"),
    phone: settingValue(settings, "phone", "01711857205"),
    secondaryPhone: settingValue(settings, "phone_secondary", "05725-56351-52"),
    admissionPhone: settingValue(settings, "admission_phone", "01329625700"),
    address: settingValue(settings, "address", "কালাই সদর, জয়পুরহাট"),
    hours: settingValue(settings, "office_hours", "রবি – বৃহস্পতি, সকাল ৮টা – দুপুর ২টা"),
    facebook: settingValue(settings, "facebook_url", ""),
    youtube: settingValue(settings, "youtube_url", ""),
    logo: settingValue(settings, "logo_url", ""),
  };
}

/**
 * Public frame: slim utility bar, sticky navigation, page body and footer.
 * Everything the header shows is data-driven (settings + the newest notice).
 */
export function PublicChrome({
  content,
  active = "",
  children,
}: {
  content: PublicContent;
  active?: string;
  children: React.ReactNode;
}) {
  const site = siteInfo(content.settings);
  const topNotice = content.notices[0];
  const year = bn(new Date().getFullYear());
  const tel = (value: string) => `tel:${value.replace(/[\s-]/g, "")}`;

  return (
    <div id="top" className="public-site">
      <a className="skip-link" href="#main">মূল অংশে যান</a>

      <div className="topline">
        <div className="page-width topline-inner">
          <span className="topline-contact">
            <Phone size={13} aria-hidden />
            <a href={tel(site.phone)}>{site.phone}</a>
            {site.secondaryPhone ? (
              <>
                <span aria-hidden>·</span>
                <a href={tel(site.secondaryPhone)}>{site.secondaryPhone}</a>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </span>
          {topNotice ? (
            <a className="topline-notice" href="/#notices" title={topNotice.title}>
              <span className="topline-dot" aria-hidden />
              {topNotice.title}
              <ArrowUpRight size={13} aria-hidden />
            </a>
          ) : (
            <a className="topline-notice" href="/#admission">
              ভর্তি তথ্য <ArrowUpRight size={13} aria-hidden />
            </a>
          )}
        </div>
      </div>

      <header className="site-header">
        <div className="page-width header-inner">
          <a href="/" className="brand" aria-label={`${site.name} — হোম`}>
            <SchoolLogo src={optimizedImage(site.logo, { width: 160 })} name={site.name} />
            <span className="brand-copy">
              <strong>{site.shortName}</strong>
              <small>{site.name}</small>
            </span>
          </a>

          <nav className="main-nav" aria-label="প্রধান মেনু">
            {primaryNav.map((item) => (
              <a key={item.key} href={item.href} className={active === item.key ? "is-active" : ""} aria-current={active === item.key ? "page" : undefined}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="header-actions">
            <VisualModeToggle />
            <a className="header-link" href="/me">
              <span>শিক্ষার্থী পোর্টাল</span>
              <ArrowUpRight size={13} aria-hidden />
            </a>
            <a className="button button-primary button-small" href="/clubs">
              ক্লাব তথ্যকেন্দ্র <ArrowUpRight size={14} aria-hidden />
            </a>
          </div>

          <MobileNav site={site} active={active} />
        </div>
      </header>

      <main id="main" className="site-main">{children}</main>

      <footer className="site-footer" id="contact">
        <div className="page-width footer-grid">
          <div className="footer-brand">
            <a href="/" className="brand">
              <SchoolLogo src={optimizedImage(site.logo, { width: 160 })} name={site.name} compact />
              <span className="brand-copy">
                <strong>{site.shortName}</strong>
                <small>{site.name}</small>
              </span>
            </a>
            <p>{site.tagline}</p>
            <a href={`mailto:${site.email}`} className="footer-email"><Mail size={14} aria-hidden /> {site.email}</a>
          </div>

          <div className="footer-links">
            <div>
              <span>তথ্যকেন্দ্র</span>
              {primaryNav.map((item) => (
                <a key={item.key} href={item.href}>{item.label}</a>
              ))}
              <a href="/admin/login">অ্যাডমিন প্যানেল <ArrowUpRight size={13} aria-hidden /></a>
            </div>
            <div>
              <span>যোগাযোগ</span>
              <p><MapPin size={14} aria-hidden /> {site.address}</p>
              <p><Phone size={14} aria-hidden /> {site.phone}</p>
              {site.admissionPhone ? <p><Phone size={14} aria-hidden /> ভর্তি/হোস্টেল: {site.admissionPhone}</p> : null}
              <p><Clock size={14} aria-hidden /> {site.hours}</p>
            </div>
            <div>
              <span>অনলাইনে</span>
              {site.facebook ? (
                <a href={site.facebook} target="_blank" rel="noreferrer"><Facebook size={14} aria-hidden /> ফেসবুক পেজ</a>
              ) : null}
              {site.youtube ? (
                <a href={site.youtube} target="_blank" rel="noreferrer"><Youtube size={14} aria-hidden /> ইউটিউব চ্যানেল</a>
              ) : null}
              <a href="/news">স্কুলের সংবাদ <ArrowUpRight size={13} aria-hidden /></a>
              <a href="/clubs">ক্লাব তালিকা <ArrowUpRight size={13} aria-hidden /></a>
            </div>
          </div>
        </div>
        <div className="page-width footer-bottom">
          <span>© {year} {site.name}</span>
          <span>সবার জন্য মানসম্মত শিক্ষা</span>
        </div>
      </footer>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  action,
  titleId,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  action?: React.ReactNode;
  /** id for the <h2>, so the surrounding <section> can point aria-labelledby at it. */
  titleId?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow"><span className="eyebrow-dot" aria-hidden />{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
      </div>
      {intro ? <p className="section-intro">{intro}</p> : null}
      {action}
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="empty-copy">{children}</p>;
}
