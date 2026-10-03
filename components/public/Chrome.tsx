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
import { optimizedImage } from "@/lib/cloudinary";
import { bn } from "@/lib/format";

export const primaryNav = [
  { href: "/", label: "হোম", key: "home" },
  { href: "/clubs", label: "ক্লাবসমূহ", key: "clubs" },
  { href: "/news", label: "সংবাদ", key: "news" },
  { href: "/#notices", label: "নোটিশ", key: "notices" },
  { href: "/#gallery", label: "গ্যালারি", key: "gallery" },
  { href: "/#contact", label: "যোগাযোগ", key: "contact" },
] as const;

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

  return (
    <div id="top" className="public-site">
      <div className="topline">
        <div className="page-width topline-inner">
          <span>
            <Phone size={13} /> হেল্পলাইন: <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>
            {site.secondaryPhone ? (
              <>
                {" · "}
                <a href={`tel:${site.secondaryPhone.replace(/\s/g, "")}`}>{site.secondaryPhone}</a>
              </>
            ) : null}
            {" · "}
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </span>
          {topNotice ? (
            <a href="/#notices">
              <span className="topline-dot" /> {topNotice.title.length > 60 ? `${topNotice.title.slice(0, 58)}…` : topNotice.title}
              <ArrowUpRight size={13} />
            </a>
          ) : (
            <a href="/#admission">ভর্তি তথ্য <ArrowUpRight size={13} /></a>
          )}
        </div>
      </div>

      <header className="site-header page-width">
        <a href="/" className="brand" aria-label={`${site.name} — হোম`}>
          <SchoolLogo src={optimizedImage(site.logo, { width: 160 })} name={site.name} />
          <span className="brand-copy">
            <strong>{site.shortName}</strong>
            <small>{site.tagline}</small>
          </span>
        </a>
        <nav className="main-nav" aria-label="প্রধান মেনু">
          {primaryNav.map((item) => (
            <a key={item.key} href={item.href} className={active === item.key ? "is-active" : ""}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="header-admin" href="/admin/login">অ্যাডমিন <ArrowUpRight size={13} /></a>
          <a className="button button-green button-small" href="/clubs">ক্লাব তথ্যকেন্দ্র <ArrowUpRight size={14} /></a>
        </div>
        <MobileNav email={site.email} active={active} />
      </header>

      {children}

      <footer className="site-footer" id="contact">
        <div className="page-width footer-grid">
          <div className="footer-brand">
            <a href="/" className="brand">
              <SchoolLogo src={optimizedImage(site.logo, { width: 160 })} name={site.name} compact />
              <span className="brand-copy">
                <strong>{site.name}</strong>
                <small>{site.tagline}</small>
              </span>
            </a>
            <p>{site.tagline}</p>
            <a href={`mailto:${site.email}`} className="footer-email"><Mail size={14} /> {site.email}</a>
          </div>
          <div className="footer-links">
            <div>
              <span>তথ্যকেন্দ্র</span>
              {primaryNav.map((item) => (
                <a key={item.key} href={item.href}>{item.label}</a>
              ))}
              <a href="/admin/login">অ্যাডমিন প্যানেল <ArrowUpRight size={13} /></a>
            </div>
            <div>
              <span>যোগাযোগ</span>
              <p><MapPin size={14} /> {site.address}</p>
              <p><Phone size={14} /> {site.phone}</p>
              {site.admissionPhone ? <p><Phone size={14} /> ভর্তি/হোস্টেল: {site.admissionPhone}</p> : null}
              <p><Clock size={14} /> {site.hours}</p>
            </div>
            <div>
              <span>অনলাইনে</span>
              {site.facebook ? (
                <a href={site.facebook} target="_blank" rel="noreferrer"><Facebook size={14} /> ফেসবুক পেজ</a>
              ) : null}
              {site.youtube ? (
                <a href={site.youtube} target="_blank" rel="noreferrer"><Youtube size={14} /> ইউটিউব চ্যানেল</a>
              ) : null}
              <a href="/news">স্কুলের সংবাদ <ArrowUpRight size={13} /></a>
              <a href="/clubs">ক্লাব তালিকা <ArrowUpRight size={13} /></a>
            </div>
          </div>
        </div>
        <div className="page-width footer-bottom">
          <span>© {year} {site.name}</span>
          <span>সবার জন্য মানসম্মত শিক্ষা</span>
          <span>ওয়েবসাইট পরিচালনা: OKGS</span>
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
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  action?: React.ReactNode;
}) {
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

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="empty-copy">{children}</p>;
}
