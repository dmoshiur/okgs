import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Facebook,
  Globe,
  Images,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  UsersRound,
  Youtube,
} from "lucide-react";

import {
  clubSitePalette,
  clubThemeCss,
  leadershipCards,
  loadClubSite,
} from "@/lib/club-sites";

import { bn } from "@/lib/format";
import { backgroundStyle } from "@/lib/cloudinary";

import { ClubSiteSubnav } from "@/components/public/ClubSiteSubnav";
import { MobileNav } from "@/components/public/MobileNav";
import { ThemeModeToggle } from "@/components/public/ThemeModeToggle";

export const dynamic = "force-dynamic";

type ClubSiteProps = {
  params: Promise<{
    slug: string;
  }>;
};

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://okgs.info";

export async function generateMetadata({
  params,
}: ClubSiteProps): Promise<Metadata> {
  const { slug } = await params;

  const site = await loadClubSite(slug);

  if (!site) {
    return {
      title: "ক্লাব সাইট পাওয়া যায়নি",
    };
  }

  const image =
    site.cover_image_url || site.logo_url;

  const description =
    site.tagline ||
    site.about ||
    `${site.name} (${site.name_en}) ক্লাব সাইট।`;

  const canonical =
    `${siteUrl}/clubs/${site.slug}/site`;

  return {
    title: `${site.name} — ক্লাব সাইট`,
    description,

    alternates: {
      canonical,
    },

    openGraph: {
      title: `${site.name} | ${site.name_en}`,
      description,
      url: canonical,
      siteName: site.name,
      images: image ? [image] : undefined,
      type: "website",
    },

    twitter: {
      card: "summary_large_image",
      title: site.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

/**
 * The phone chrome borrows the club's brand
 * instead of the school default.
 */
export async function generateViewport({
  params,
}: ClubSiteProps): Promise<Viewport> {
  const { slug } = await params;

  const site = await loadClubSite(slug);

  if (!site) {
    return {};
  }

  const palette = await clubSitePalette(site);

  return {
    themeColor: palette.deep,
  };
}

export default async function ClubSitePage({
  params,
}: ClubSiteProps) {
  const { slug } = await params;

  const site = await loadClubSite(slug);

  if (!site) {
    notFound();
  }

  const css = await clubThemeCss(slug);

  const leaders = leadershipCards(site);

  const gallery = site.galleryItems.slice(0, 18);

  const eventRows = [
    ...site.clubEvents.map((event) => ({
      title: event.title,
      date: event.event_date || "",
      description: event.description,
      image_url: event.image_url,
    })),

    ...site.events,
  ];

  const seenEvents = new Set<string>();

  const events = eventRows.filter((event) => {
    const key =
      `${event.title.trim().normalize("NFC").toLocaleLowerCase("bn-BD")}|${event.date || ""}`;

    if (seenEvents.has(key)) {
      return false;
    }

    seenEvents.add(key);

    return true;
  });

  const stats = [
    {
      label: "সদস্য",
      value:
        site.member_count ||
        site.members.length ||
        0,
      icon: <UsersRound size={16} />,
    },
    {
      label: "আয়োজন",
      value: events.length,
      icon: <CalendarDays size={16} />,
    },
    {
      label: "ছবি",
      value: gallery.length,
      icon: <Images size={16} />,
    },
    {
      label: "প্রতিষ্ঠা",
      value: site.founded_year || 0,
      icon: <Sparkles size={16} />,
    },
  ].filter(
    (item) => Number(item.value) > 0,
  );

  /*
   * Everything below is painted from the club's own logo:
   * a palette saved by the club admin, a server-side sample
   * of the logo file, or — only when neither exists —
   * the accent pair from the studio.
   *
   * lib/club-palette.ts turns that into ramps, gradients,
   * glows and readable text colours.
   */
  const palette = await clubSitePalette(site);

  const clubStyle =
    palette.vars as React.CSSProperties;

  const heroStyle = backgroundStyle(
    site.cover_image_url,
    {
      width: 1600,
      fit: "cover",
    },
  );

  const siteNav = [
    {
      id: "about",
      label: "পরিচিতি",
      show: Boolean(
        site.about ||
          site.mission.length ||
          site.objectives.length,
      ),
    },
    {
      id: "leaders",
      label: "নেতৃত্ব",
      show: leaders.length > 0,
    },
    {
      id: "events",
      label: "আয়োজন",
      show: events.length > 0,
    },
    {
      id: "gallery",
      label: "ছবিঘর",
      show: gallery.length > 0,
    },
    {
      id: "members",
      label: "সদস্য",
      show: site.members.length > 0,
    },
    {
      id: "contact",
      label: "যোগাযোগ",
      show: true,
    },
  ]
    .filter((item) => item.show)
    .map(({ id, label }) => ({
      id,
      label,
    }));

  return (
    <div
      className="club-site"
      data-club={slug}
      data-club-palette={palette.source}
      style={clubStyle}
    >
      {css ? (
        <style
          dangerouslySetInnerHTML={{
            __html: css,
          }}
        />
      ) : null}

      <header className="club-site-hero">
        {heroStyle ? (
          <div
            className="club-site-hero-cover"
            aria-hidden="true"
            style={heroStyle}
          />
        ) : null}

        <div className="v2-wrap club-site-hero-inner">
          <div className="club-site-hero-top">
            <Link
              className="cs-back"
              href={`/clubs/${slug}`}
            >
              <ArrowLeft size={15} />
              ক্লাব তথ্যকেন্দ্র
            </Link>

            <div className="cs-hero-links">
              {site.website ? (
                <a
                  href={site.website}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Globe size={15} />
                  {site.subdomain || "ওয়েবসাইট"}
                </a>
              ) : null}

              {site.facebook ? (
                <a
                  href={site.facebook}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Facebook size={15} />
                  ফেসবুক
                </a>
              ) : null}

              {site.youtube ? (
                <a
                  href={site.youtube}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Youtube size={15} />
                  ইউটিউব
                </a>
              ) : null}

              <Link
                href={`/clubs/${slug}/admin`}
              >
                <ShieldCheck size={15} />
                ক্লাব অ্যাডমিন
              </Link>

              <ThemeModeToggle compact />
            </div>
          </div>

          <div className="club-site-hero-main">
            <span className="club-site-logo">
              {site.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={site.logo_url}
                  alt={`${site.name} এর লোগো`}
                />
              ) : (
                <span className="club-site-logo-fallback">
                  {site.short_code.slice(0, 3)}
                </span>
              )}
            </span>

            <div>
              <p className="cs-kicker">
                {site.short_code} ·{" "}
                {site.subdomain}
              </p>

              <h1>{site.name}</h1>

              <p className="cs-name-en">
                {site.name_en}
              </p>

              {site.tagline ? (
                <p className="cs-tagline">
                  {site.tagline}
                </p>
              ) : null}

              {site.motto ? (
                <p className="cs-motto">
                  “{site.motto}”
                </p>
              ) : null}
            </div>
          </div>

          <div className="cs-actions">
            <Link
              className="v2-btn"
              href={`/clubs/${slug}`}
            >
              মূল সাইটে ক্লাব পাতা
              <ArrowUpRight size={16} />
            </Link>

            {site.facebook ? (
              <a
                className="v2-btn v2-btn-ghost"
                href={site.facebook}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Facebook size={16} />
                ফেসবুক পেজ
              </a>
            ) : null}

            {site.youtube ? (
              <a
                className="v2-btn v2-btn-ghost"
                href={site.youtube}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Youtube size={16} />
                ইউটিউব
              </a>
            ) : null}

            {site.website ? (
              <a
                className="v2-btn v2-btn-ghost"
                href={site.website}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Globe size={16} />
                {site.subdomain}
              </a>
            ) : null}
          </div>

          {stats.length ? (
            <div
              className="club-site-stats"
              aria-label="ক্লাবের পরিসংখ্যান"
            >
              {stats.map((item) => (
                <article
                  className="club-site-stat"
                  key={item.label}
                >
                  <span
                    className="club-site-stat-icon"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>

                  <span className="club-site-stat-copy">
                    <small>{item.label}</small>

                    <strong>
                      {bn(item.value)}
                    </strong>
                  </span>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      {siteNav.length > 1 ? (
        <ClubSiteSubnav items={siteNav} />
      ) : null}

      <main className="v2-wrap club-site-body">
        {site.notice ? (
          <div className="cs-notice">
            <Sparkles size={16} />
            {site.notice}
          </div>
        ) : null}

        {site.about ||
        site.mission.length ||
        site.objectives.length ? (
          <section
            className="cs-section"
            id="about"
          >
            <div className="cs-head">
              <span className="v2-chip">
                আমাদের সম্পর্কে
              </span>

              <h2>
                {site.name} কী করে
              </h2>
            </div>

            {site.about ? (
              <p className="cs-lead">
                {site.about}
              </p>
            ) : null}

            <div className="cs-grid cs-grid-2">
              {site.mission.length ? (
                <article className="cs-card">
                  <h3>
                    <Target size={18} />
                    লক্ষ্য
                  </h3>

                  <ul className="cs-list">
                    {site.mission.map(
                      (item) => (
                        <li key={item}>
                          {item}
                        </li>
                      ),
                    )}
                  </ul>
                </article>
              ) : null}

              {site.objectives.length ? (
                <article className="cs-card">
                  <h3>
                    <Sparkles size={18} />
                    ক্লাবের উদ্দেশ্য
                  </h3>

                  <ol className="cs-list cs-list-num">
                    {site.objectives.map(
                      (item) => (
                        <li key={item}>
                          {item}
                        </li>
                      ),
                    )}
                  </ol>
                </article>
              ) : null}
            </div>
          </section>
        ) : null}

        {leaders.length ? (
          <section
            className="cs-section"
            id="leaders"
          >
            <div className="cs-head">
              <span className="v2-chip">
                নেতৃত্ব
              </span>

              <h2>
                সভাপতি, সম্পাদক ও কমিটি
              </h2>
            </div>

            <div className="cs-grid cs-leaders">
              {leaders.map((leader) => (
                <article
                  className="cs-leader"
                  key={`${leader.role}-${leader.name}`}
                >
                  <span className="cs-leader-photo">
                    {leader.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={leader.photo_url}
                        alt={leader.name}
                      />
                    ) : (
                      <UserRound size={30} />
                    )}
                  </span>

                  <strong>
                    {leader.name}
                  </strong>

                  <em>{leader.role}</em>

                  {leader.class_level ||
                  leader.section ? (
                    <small>
                      {leader.class_level}{" "}
                      {leader.section
                        ? `· শাখা ${leader.section}`
                        : ""}
                    </small>
                  ) : null}

                  {leader.bio ? (
                    <p>{leader.bio}</p>
                  ) : null}

                  <div className="cs-leader-links">
                    {leader.phone ? (
                      <a
                        href={`tel:${leader.phone}`}
                      >
                        <Phone size={13} />
                        {leader.phone}
                      </a>
                    ) : null}

                    {leader.email ? (
                      <a
                        href={`mailto:${leader.email}`}
                      >
                        <Mail size={13} />
                        ইমেইল
                      </a>
                    ) : null}

                    {leader.facebook ? (
                      <a
                        href={leader.facebook}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        <Facebook size={13} />
                        ফেসবুক
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {events.length ? (
          <section
            className="cs-section"
            id="events"
          >
            <div className="cs-head">
              <span className="v2-chip">
                আয়োজন
              </span>

              <h2>
                কার্যক্রম ও অনুষ্ঠান
              </h2>
            </div>

            <div className="cs-timeline">
              {events.map((event) => (
                <article
                  className="cs-event"
                  key={`${event.title}-${event.date}`}
                >
                  <span className="cs-event-dot" />

                  <div>
                    <strong>
                      {event.title}
                    </strong>

                    {event.date ? (
                      <em>
                        {event.date}
                      </em>
                    ) : null}

                    {event.description ? (
                      <p>
                        {event.description}
                      </p>
                    ) : null}
                  </div>

                  {event.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="cs-event-img"
                      src={event.image_url}
                      alt={event.title}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {gallery.length ? (
          <section
            className="cs-section"
            id="gallery"
          >
            <div className="cs-head">
              <span className="v2-chip">
                ছবিঘর
              </span>

              <h2>
                ক্লাবের ছবি
              </h2>
            </div>

            <div className="cs-gallery">
              {gallery.map(
                (item, index) => (
                  <figure
                    key={`${item.url}-${index}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={
                        item.caption ||
                        `${site.name} — ছবি ${
                          index + 1
                        }`
                      }
                      loading="lazy"
                    />

                    {item.caption ? (
                      <figcaption>
                        {item.caption}
                      </figcaption>
                    ) : null}
                  </figure>
                ),
              )}
            </div>
          </section>
        ) : null}

        {site.members.length ? (
          <section
            className="cs-section"
            id="members"
          >
            <div className="cs-head">
              <span className="v2-chip">
                সদস্য
              </span>

              <h2>
                ক্লাবের সদস্যবৃন্দ
              </h2>
            </div>

            <div className="cs-table-wrap">
              <table className="cs-table">
                <thead>
                  <tr>
                    <th>নাম</th>
                    <th>পদ</th>
                    <th>শ্রেণি</th>
                    <th>শাখা</th>
                  </tr>
                </thead>

                <tbody>
                  {site.members.map(
                    (member) => (
                      <tr key={member.id}>
                        <td>
                          {member.name}
                        </td>

                        <td>
                          {member.role ||
                            "সদস্য"}
                        </td>

                        <td>
                          {member.class_room ||
                            "—"}
                        </td>

                        <td>
                          {member.section ||
                            "—"}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section
          className="cs-section"
          id="contact"
        >
          <div className="cs-head">
            <span className="v2-chip">
              যোগাযোগ
            </span>

            <h2>
              ক্লাবে যোগ দিন
            </h2>
          </div>

          <div className="cs-grid cs-grid-3">
            <article className="cs-card">
              <h3>
                <Clock size={18} />
                সভা
              </h3>

              <p>
                {site.meeting.day ||
                  "প্রতি সপ্তাহে"}

                {site.meeting.time
                  ? ` · ${site.meeting.time}`
                  : ""}
              </p>

              <p className="v2-muted">
                {site.meeting.place ||
                  "স্কুল প্রাঙ্গণ"}
              </p>
            </article>

            <article className="cs-card">
              <h3>
                <Phone size={18} />
                ফোন
              </h3>

              <p>
                {site.contact.phone ||
                  "01711857205"}
              </p>

              <p className="v2-muted">
                {site.contact.email ||
                  "okgs2003@gmail.com"}
              </p>
            </article>

            <article className="cs-card">
              <h3>
                <MapPin size={18} />
                ঠিকানা
              </h3>

              <p>
                {site.contact.address ||
                  "স্কুল কলেজ পাড়া, কলাই সদর, জয়পুরহাট"}
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="cs-foot">
        <div className="v2-wrap cs-foot-inner">
          <div>
            <strong>{site.name}</strong>

            <p className="v2-muted">
              {site.name_en} ·{" "}
              {site.subdomain}
            </p>
          </div>

          <div className="cs-foot-links">
            <Link href="/clubs">
              সব ক্লাব
            </Link>

            <Link
              href={`/clubs/${slug}`}
            >
              ক্লাব তথ্য
            </Link>

            <Link
              href={`/clubs/${slug}/admin`}
            >
              অ্যাডমিন
            </Link>

            {site.facebook ? (
              <a
                href={site.facebook}
                target="_blank"
                rel="noreferrer noopener"
              >
                ফেসবুক
              </a>
            ) : null}

            {site.youtube ? (
              <a
                href={site.youtube}
                target="_blank"
                rel="noreferrer noopener"
              >
                ইউটিউব
              </a>
            ) : null}
          </div>
        </div>
      </footer>

      <MobileNav
        site={{
          name: site.name,
          shortName: "Main",
          tagline:
            site.tagline || site.name,
          email: site.contact.email || "",
          phone: site.contact.phone || "",
        }}
        active="clubs"
        showMenuButton={false}
      />
    </div>
  );
}