"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Slide } from "@/lib/types";
import { SmartImage } from "@/components/public/Media";

interface Badge {
  year: string;
  place: string;
}

export interface HeroFact {
  label: string;
  value: string;
}

/**
 * Editorial hero: copy on the left, a framed image stage on the right.
 * Slide data, autoplay, pause and the numbered progress controls all stay
 * data-driven — only the composition changed.
 */
export function HeroCarousel({
  slides,
  badge,
  facts = [],
}: {
  slides: Slide[];
  badge?: Badge;
  facts?: HeroFact[];
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = slides.length;
  const current = total ? slides[active % total] : undefined;

  useEffect(() => {
    if (paused || total < 2) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % total), 7000);
    return () => window.clearInterval(timer);
  }, [paused, total]);

  const goTo = (index: number) => setActive(((index % total) + total) % total);

  /* ---------------------------------------------------------- empty state */
  if (!current) {
    return (
      <div className="page-width">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="hero-eyebrow"><span aria-hidden />ওমর কিন্ডারগার্টেন স্কুল</p>
            <h1>শিক্ষায় গড়ি আলোকিত ভবিষ্যৎ</h1>
            <p className="hero-description">
              হোমপেজের স্লাইড ছবি ও লেখা অ্যাডমিন প্যানেল থেকে যোগ করা যায় — ততক্ষণ প্রতিষ্ঠানের পরিচিতি এখানেই থাকছে।
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="/clubs">
                ক্লাব তথ্যকেন্দ্র <ArrowRight size={16} aria-hidden />
              </a>
              <a className="button button-outline" href="/admin/login">
                স্লাইড যোগ করুন <ArrowUpRight size={15} aria-hidden />
              </a>
            </div>
            {facts.length ? (
              <ul className="hero-facts">
                {facts.map((fact) => (
                  <li key={fact.label}><strong>{fact.value}</strong> {fact.label}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="hero-visual">
            <div className="hero-stage">
              <SmartImage src="/media/campus-building.svg" alt="ক্যাম্পাস" priority transform={{ width: 1200, fit: "cover" }} />
            </div>
            {badge?.year || badge?.place ? (
              <div className="hero-badge">
                <span>প্রতিষ্ঠা</span>
                <strong>{badge.year || "—"}</strong>
                <small>{badge.place}</small>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-width">
      <div className="hero-grid">
        <div className="hero-copy" key={current.id}>
          <p className="hero-eyebrow">
            <span aria-hidden />
            {current.eyebrow || "ওমর কিন্ডারগার্টেন স্কুল"}
          </p>
          <h1>{current.title}</h1>
          {current.description ? <p className="hero-description">{current.description}</p> : null}
          <div className="hero-actions">
            <a className="button button-primary" href={current.cta_href || "/clubs"}>
              {current.cta_label || "আরও দেখুন"} <ArrowRight size={16} aria-hidden />
            </a>
            <a className="button button-outline" href="/clubs">
              আমাদের ক্লাবসমূহ <ArrowUpRight size={15} aria-hidden />
            </a>
          </div>
          {facts.length ? (
            <ul className="hero-facts">
              {facts.map((fact) => (
                <li key={fact.label}><strong>{fact.value}</strong> {fact.label}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="hero-visual">
          <div className="hero-stage" role="region" aria-roledescription="carousel" aria-label="স্কুলের বিশেষ বার্তা">
            {slides.map((slide, index) => (
              <SmartImage
                key={slide.id}
                className={index === active ? "is-current" : ""}
                src={slide.image_url}
                alt={slide.title}
                priority={index === 0}
                loading={index === 0 ? "eager" : "lazy"}
                transform={{ width: 1200, height: 960, fit: "cover" }}
                label={slide.title}
                accent={slide.accent || undefined}
              />
            ))}
          </div>

          {badge?.year || badge?.place ? (
            <div className="hero-badge">
              <span>প্রতিষ্ঠা</span>
              <strong>{badge.year || "—"}</strong>
              <small>{badge.place}</small>
            </div>
          ) : null}

          {total > 1 ? (
            <div className="hero-controls">
              <div className="hero-control-group">
                <button className="circle-control" type="button" onClick={() => goTo(active - 1)} aria-label="আগের স্লাইড">
                  <ChevronLeft size={17} aria-hidden />
                </button>
                <button className="circle-control" type="button" onClick={() => goTo(active + 1)} aria-label="পরের স্লাইড">
                  <ChevronRight size={17} aria-hidden />
                </button>
                <button
                  className="pause-control"
                  type="button"
                  onClick={() => setPaused(!paused)}
                  aria-label={paused ? "স্লাইড চালু করুন" : "স্লাইড থামান"}
                  aria-pressed={paused}
                >
                  {paused ? <Play size={12} fill="currentColor" aria-hidden /> : <Pause size={12} fill="currentColor" aria-hidden />}
                  <span>{paused ? "চালু করুন" : "থামান"}</span>
                </button>
              </div>
              <div className="hero-progress" aria-label="স্লাইড নির্বাচন">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    aria-current={index === active ? "true" : undefined}
                    className={`progress-item ${index === active ? "is-current" : ""}`}
                    onClick={() => goTo(index)}
                    aria-label={`স্লাইড ${index + 1}: ${slide.title}`}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <i aria-hidden><b /></i>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
