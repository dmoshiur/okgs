"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Images, Users } from "lucide-react";
import type { Club, Slide } from "@/lib/types";
import { SmartImage } from "@/components/public/Media";
import { bn } from "@/lib/format";

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
  club: Club;
  chip?: string;
}

/**
 * "Slider by category" — the homepage club showcase. Each club is a category:
 * pick a club and the track fills with that club's slides and gallery pictures,
 * plus a link to the club's own website.
 */
export function ClubShowcase({ clubs, slides, counts = {} }: ShowcaseProps) {
  const [active, setActive] = useState<string>("all");

  const cards: Card[] = useMemo(() => {
    const list: Card[] = [];
    for (const club of clubs) {
      const clubSlides = slides.filter((slide) => slide.club_slug === club.slug);
      const gallery = String(club.gallery_urls ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (active === "all") {
        list.push({
          key: `club-${club.id}`,
          image: club.cover_image_url || club.image_url || gallery[0] || clubSlides[0]?.image_url || "",
          title: club.name,
          text: club.tagline || club.description,
          href: `/clubs/${club.slug}`,
          club,
          chip: club.short_code || undefined,
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
          club,
          chip: slide.eyebrow || `স্লাইড ${bn(index + 1)}`,
        }),
      );
      gallery.forEach((image, index) =>
        list.push({
          key: `gallery-${club.id}-${index}`,
          image,
          title: club.name,
          text: `গ্যালারি ছবি ${bn(index + 1)} — ${counts[club.slug] ? `${bn(counts[club.slug])} টি ছবি` : "ক্লাব গ্যালারি"}`,
          href: `/clubs/${club.slug}/gallery`,
          club,
          chip: "গ্যালারি",
        }),
      );

      list.push({
        key: `site-${club.id}`,
        image: club.logo_url || club.image_url || "",
        title: club.domain || club.subdomain || `${club.short_code ?? club.slug}.okgs.info`,
        text: club.name_en || "ক্লাবের নিজস্ব সাইটে সব আয়োজন, কমিটি ও গ্যালারি।",
        href: club.domain || club.subdomain || `/clubs/${club.slug}`,
        club,
        chip: "নিজস্ব সাইট",
      });
    }
    return list;
  }, [active, clubs, counts, slides]);

  if (!clubs.length) return null;

  return (
    <section className="v2 v2-sec" id="clubs-showcase">
      <div className="v2-wrap">
        <div className="v2-sec-head">
          <div>
            <p className="v2-chip v2-chip-accent"><Images size={14} /> ক্লাব স্লাইডার</p>
            <h2>ক্লাব অনুযায়ী ছবি ও আয়োজন</h2>
            <p>যে ক্লাবের ছবি দেখতে চান, তার নামে চাপ দিন — স্কুলের পাঁচটি সক্রিয় ক্লাব, প্রতিটির নিজস্ব সাইট সহ।</p>
          </div>
          <a className="text-link" href="/clubs">
            সব ক্লাব এক পাতায় <ArrowUpRight size={15} />
          </a>
        </div>

        <div className="showcase-tabs" role="tablist" aria-label="ক্লাব ক্যাটাগরি">
          <button type="button" className={`showcase-tab ${active === "all" ? "is-on" : ""}`} onClick={() => setActive("all")}>
            <Users size={15} /> সব ক্লাব
          </button>
          {clubs.map((club) => (
            <button
              key={club.id}
              type="button"
              role="tab"
              aria-selected={active === club.slug}
              className={`showcase-tab ${active === club.slug ? "is-on" : ""}`}
              onClick={() => setActive(club.slug)}
            >
              {club.logo_url ? <img src={club.logo_url} alt="" /> : null}
              {club.short_code ? `${club.short_code} · ` : ""}
              {club.name}
            </button>
          ))}
        </div>

        <div className="showcase-track" style={{ marginTop: 18 }}>
          {cards.map((card) => {
            const external = /^https?:/i.test(card.href);
            return (
              <a
                key={card.key}
                className="showcase-card"
                href={card.href}
                {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                style={{ borderTop: `4px solid ${card.club.accent || "var(--okgs-accent)"}` }}
              >
                {card.image ? <SmartImage className="bg" src={card.image} alt={card.title} transform={{ width: 800, fit: "cover" }} /> : null}
                {card.club.logo_url ? <SmartImage className="showcase-logo" src={card.club.logo_url} alt={`${card.club.name} লোগো`} transform={{ width: 120 }} /> : null}
                {card.chip ? <span className="v2-chip" style={{ alignSelf: "flex-start", background: "rgba(255,255,255,.18)", color: "#fff", borderColor: "rgba(255,255,255,.3)" }}>{card.chip}</span> : null}
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <span style={{ marginTop: 10, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  দেখুন <ArrowUpRight size={14} />
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
