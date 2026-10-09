"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Images, Users } from "lucide-react";
import type { Club, Slide } from "@/lib/types";
import { SmartImage } from "@/components/public/Media";
import { bn } from "@/lib/format";
import { clubSiteLabel, clubSiteUrl } from "@/lib/club-urls";

interface ShowcaseProps {
  clubs: Club[];
  slides: Slide[];
  /** Extra "category" labels from the gallery (club slug → count). */
  counts?: Record<string, number>;
}

interface Card {
  key: string;
  image: string;
  title: string;
  text: string;
  href: string;
  external?: boolean;
  chip?: string;
  logo?: string;
}

function galleryUrls(club: Club) {
  return String(club.gallery_urls ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * "Slider by category" — the homepage club showcase. Each club is a category:
 * pick a club and the grid fills with that club's slides and gallery pictures,
 * plus a link to the club's own website.
 *
 * Rebuilt as a responsive media grid: no horizontal overflow, and tiles
 * have content-driven heights so full club names stay visible. Descriptions
 * remain clamped, but headings are never shortened.
 */
export function ClubShowcase({ clubs, slides, counts = {} }: ShowcaseProps) {
  const [active, setActive] = useState<string>("all");

  const cards: Card[] = useMemo(() => {
    const list: Card[] = [];
    for (const club of clubs) {
      const clubSlides = slides.filter((slide) => slide.club_slug === club.slug);
      const gallery = galleryUrls(club);

      if (active === "all") {
        list.push({
          key: `club-${club.id}`,
          image: club.cover_image_url || club.image_url || gallery[0] || clubSlides[0]?.image_url || "",
          title: club.name,
          text: club.tagline || club.description,
          href: `/clubs/${club.slug}`,
          chip: club.short_code || undefined,
          logo: club.logo_url || undefined,
        });
        continue;
      }

      if (club.slug !== active) continue;

      clubSlides.forEach((slide, index) =>
        list.push({
          key: `slide-${slide.id}`,
          image: slide.image_url,
          title: slide.title,
          text: slide.description,
          href: slide.cta_href || `/clubs/${club.slug}`,
          external: /^https?:/i.test(slide.cta_href || ""),
          chip: slide.eyebrow || `স্লাইড ${bn(index + 1)}`,
        }),
      );
      gallery.forEach((image, index) =>
        list.push({
          key: `gallery-${club.id}-${index}`,
          image,
          title: club.name,
          text: counts[club.slug] ? `${bn(counts[club.slug])} টি ছবির গ্যালারি` : "ক্লাব গ্যালারি",
          href: `/clubs/${club.slug}/gallery`,
          chip: "গ্যালারি",
        }),
      );

      const siteHref = clubSiteUrl({ slug: club.slug, subdomain: club.subdomain, website: club.domain });
      list.push({
        key: `site-${club.id}`,
        image: club.logo_url || club.image_url || "",
        title: clubSiteLabel({ slug: club.slug, subdomain: club.subdomain, website: club.domain }),
        text: club.tagline || club.name_en || "ক্লাবের নিজের সাইটে সব আয়োজন, কমিটি ও গ্যালারি।",
        href: siteHref,
        external: true,
        chip: "নিজস্ব সাইট",
        logo: club.logo_url || undefined,
      });
    }
    return list;
  }, [active, clubs, counts, slides]);

  if (!clubs.length) return null;

  return (
    <section className="section showcase-section reveal" id="clubs-showcase" aria-labelledby="showcase-title">
      <div className="page-width">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span className="eyebrow-dot" aria-hidden />ক্লাব গ্যালারি</p>
            <h2 id="showcase-title">ক্লাব অনুযায়ী ছবি ও আয়োজন</h2>
          </div>
          <p className="section-intro">
            যে ক্লাবের ছবি দেখতে চান, তার নামে চাপ দিন — প্রতিটি ক্লাবের আয়োজন, গ্যালারি ও নিজস্ব সাইট এক জায়গায়।
          </p>
          <a className="text-link section-action" href="/clubs">
            সব ক্লাব এক পাতায় <ArrowUpRight size={15} aria-hidden />
          </a>
        </div>

        <div className="showcase-tabs" role="group" aria-label="ক্লাব ক্যাটাগরি">
          <button
            type="button"
            aria-pressed={active === "all"}
            className={`showcase-tab ${active === "all" ? "is-on" : ""}`}
            onClick={() => setActive("all")}
          >
            <Users size={15} aria-hidden /> সব ক্লাব
          </button>
          {clubs.map((club) => (
            <button
              key={club.id}
              type="button"
              aria-pressed={active === club.slug}
              className={`showcase-tab ${active === club.slug ? "is-on" : ""}`}
              onClick={() => setActive(club.slug)}
            >
              {club.logo_url ? <SmartImage src={club.logo_url} alt="" transform={{ width: 80 }} label={club.short_code || club.name} /> : null}
              {club.short_code || club.name}
            </button>
          ))}
        </div>

        {cards.length ? (
          <div className="showcase-grid">
            {cards.map((card) => (
              <a
                key={card.key}
                className="showcase-card"
                href={card.href}
                {...(card.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
              >
                {card.image ? (
                  <SmartImage className="bg" src={card.image} alt={card.title} transform={{ width: 760, height: 570, fit: "cover" }} label={card.title} />
                ) : null}
                {card.logo ? <SmartImage className="showcase-logo" src={card.logo} alt="" transform={{ width: 120 }} /> : null}
                {card.chip ? <span className="showcase-chip">{card.chip}</span> : null}
                <h3>{card.title}</h3>
                {card.text ? <p>{card.text}</p> : null}
                <span className="showcase-more">দেখুন <ArrowUpRight size={14} aria-hidden /></span>
              </a>
            ))}
          </div>
        ) : (
          <div className="showcase-empty">
            <Images size={22} aria-hidden />
            <p>এই ক্লাবের জন্য এখনো ছবি যুক্ত করা হয়নি — অ্যাডমিন স্টুডিও থেকে যোগ করা যাবে।</p>
          </div>
        )}
      </div>
    </section>
  );
}
