"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Slide } from "@/lib/types";
import { optimizedImage } from "@/lib/cloudinary";

interface Badge {
  year: string;
  place: string;
}

export function HeroCarousel({ slides, badge }: { slides: Slide[]; badge?: Badge }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = slides.length;
  const current = total ? slides[active % total] : undefined;

  useEffect(() => {
    if (paused || total < 2) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % total), 6200);
    return () => window.clearInterval(timer);
  }, [paused, total]);

  if (!current) {
    return (
      <div className="hero-carousel is-empty">
        <div className="page-width hero-content-wrap">
          <div className="hero-copy">
            <p className="hero-kicker"><span />ওমর কিন্ডারগার্টেন স্কুল</p>
            <h1>শিক্ষায় গড়ি আলোকিত ভবিষ্যৎ</h1>
            <p className="hero-description">হোমপেজের স্লাইড ছবি ও লেখা অ্যাডমিন প্যানেল থেকে যোগ করা যায়।</p>
            <div className="hero-actions">
              <a className="button button-gold" href="/admin">স্লাইড যোগ করুন <ArrowRight size={16} /></a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const goTo = (index: number) => setActive(((index % total) + total) % total);

  return (
    <div className="hero-carousel" role="region" aria-roledescription="carousel" aria-label="স্কুলের বিশেষ বার্তা">
      {slides.map((slide, index) => {
        const url = optimizedImage(slide.image_url, { width: 1800, fit: "cover" });
        return (
          <div
            key={slide.id}
            className={`hero-slide ${index === active ? "is-current" : ""}`}
            style={url ? { backgroundImage: `url("${url}")` } : undefined}
            aria-hidden={index !== active}
          />
        );
      })}
      <div className="hero-shade" />
      <div className="page-width hero-content-wrap">
        <div className="hero-copy" key={current.id}>
          {current.eyebrow ? <p className="hero-kicker"><span />{current.eyebrow}</p> : null}
          <h1>{current.title}</h1>
          {current.description ? <p className="hero-description">{current.description}</p> : null}
          <div className="hero-actions">
            {current.cta_href ? (
              <a className="button button-gold" href={current.cta_href}>{current.cta_label || "আরও দেখুন"} <ArrowRight size={16} /></a>
            ) : null}
            <a className="hero-text-link" href="/clubs">আমাদের ক্লাবসমূহ <ArrowRight size={15} /></a>
          </div>
        </div>
        {badge?.year || badge?.place ? (
          <div className="hero-badge">
            <span>প্রতিষ্ঠা</span>
            <strong>{badge.year || "—"}</strong>
            <i /> <small>{badge.place}</small>
          </div>
        ) : null}
      </div>
      {total > 1 ? (
        <div className="page-width hero-footer">
          <div className="hero-controls">
            <button className="circle-control" type="button" onClick={() => goTo(active - 1)} aria-label="আগের স্লাইড"><ChevronLeft size={17} /></button>
            <button className="circle-control" type="button" onClick={() => goTo(active + 1)} aria-label="পরের স্লাইড"><ChevronRight size={17} /></button>
            <button className="pause-control" type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "স্লাইড চালু করুন" : "স্লাইড থামান"}>
              {paused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
              <span>{paused ? "চালু" : "থামান"}</span>
            </button>
          </div>
          <div className="hero-progress" aria-label="স্লাইড নির্বাচন">
            {slides.map((slide, index) => (
              <button key={slide.id} type="button" className={`progress-item ${index === active ? "is-current" : ""}`} onClick={() => goTo(index)} aria-label={`স্লাইড ${index + 1}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <i><b /></i>
              </button>
            ))}
          </div>
          <span className="hero-scroll">নিচে দেখুন <ArrowRight size={15} /></span>
        </div>
      ) : null}
    </div>
  );
}
