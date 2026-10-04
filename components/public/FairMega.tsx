import { ArrowUpRight, CalendarDays, MapPin, Ticket, Users } from "lucide-react";
import type { PublicContent } from "@/lib/types";
import { readFlag, readSetting } from "@/lib/site";
import { bn, formatDate } from "@/lib/format";
import { Countdown } from "@/components/public/Countdown";
import { SmartImage } from "@/components/public/Media";

/**
 * The ultra-big science-fair banner that sits on top of the homepage.
 *
 * Everything on it (title, dates, logo, buttons, countdown) comes from the
 * database, so the school can retitle the fair — or hide the banner entirely —
 * from the console without a deploy.
 */
export function FairMega({ content, fairHref }: { content: PublicContent; fairHref?: string }) {
  const settings = content.settings;
  const enabled = readFlag(settings, "fair_banner_enabled", true);
  if (!enabled) return null;

  const slug = readSetting(settings, "fair_mode_slug");
  const fair = content.fairs.find((item) => item.slug === slug) || content.fairs.find((item) => item.is_featured) || content.fairs[0];
  if (!fair) return null;

  const href = fairHref || `/fair/${fair.slug}`;
  const kicker = readSetting(settings, "fair_banner_kicker", fair.tagline);
  const title = readSetting(settings, "fair_banner_title", fair.name);
  const sub = readSetting(settings, "fair_banner_subtitle", fair.description);
  const registrationOpen = readFlag(settings, "fair_registration_open", true);
  const logo = fair.logo_url || readSetting(settings, "fair_logo_url");
  const startsOn = fair.starts_on;
  const sameDay = fair.ends_on && fair.ends_on === fair.starts_on;

  return (
    <section className="v2 fair-mega" aria-label={fair.name}>
      <div className="v2-wrap fair-mega-inner">
        <div>
          <p className="fair-mega-kicker">
            <CalendarDays size={15} />
            {kicker || (startsOn ? formatDate(startsOn) : "তারিখ শিগগিরই")}
          </p>
          <h1 className="fair-mega-title">
            {title}
            {sub ? <span>{sub}</span> : null}
          </h1>
          <div className="fair-mega-facts">
            {startsOn ? (
              <span>
                <CalendarDays size={13} style={{ display: "inline", verticalAlign: -2 }} />{" "}
                {formatDate(startsOn)}
                {fair.ends_on && !sameDay ? ` – ${formatDate(fair.ends_on)}` : ""} · {fair.intro_time || "সারাদিন"}
              </span>
            ) : null}
            {fair.venue ? (
              <span>
                <MapPin size={13} style={{ display: "inline", verticalAlign: -2 }} /> {fair.venue}
              </span>
            ) : null}
            {fair.fee ? <span>নিবন্ধন ফি {bn(fair.fee)} টাকা</span> : <span>নিবন্ধন ফ্রি</span>}
            {registrationOpen && fair.registration_deadline ? <span>নিবন্ধন শেষ {formatDate(fair.registration_deadline)}</span> : null}
          </div>
          <div className="fair-mega-actions">
            <a className="v2-btn" href={registrationOpen ? `${href}#register` : href}>
              <Ticket size={17} /> {registrationOpen ? "নিবন্ধন করুন" : "মেলা দেখুন"}
            </a>
            <a className="v2-btn v2-btn-ghost" href="/sf/login">
              <Users size={17} /> শিক্ষার্থী / শিক্ষক লগইন
            </a>
            <a className="v2-btn v2-btn-ghost" href="/clubs">
              ক্লাবসমূহ <ArrowUpRight size={15} />
            </a>
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {logo ? <SmartImage className="fair-mega-logo" src={logo} alt={fair.name} transform={{ width: 200 }} /> : null}
          {startsOn ? <Countdown date={startsOn} /> : null}
          {fair.results_note ? (
            <div style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.26)", fontSize: 14 }}>
              <strong style={{ display: "block", marginBottom: 4 }}>ফলাফল / ঘোষণা</strong>
              <span style={{ opacity: 0.9 }}>{fair.results_note}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
