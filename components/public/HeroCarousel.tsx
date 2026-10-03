"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Slide } from "@/lib/types";

export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const safeSlides = slides.length ? slides : [{
    id: "fallback",
    eyebrow: "Omar Kindergarten School",
    title: "A bright beginning for every possibility.",
    description: "A warm, future-facing school where curious minds grow generous futures.",
    cta_label: "Discover OKGS",
    cta_href: "#about",
    image_url: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=2000&q=88",
    accent: "#e8be74",
    sort_order: 1,
    is_active: true,
    created_at: "",
    updated_at: "",
  } satisfies Slide];
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = safeSlides[active % safeSlides.length];

  useEffect(() => {
    if (paused || safeSlides.length < 2) return;
    const timer = window.setInterval(() => {
      setActive((index) => (index + 1) % safeSlides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [paused, safeSlides.length]);

  function goTo(index: number) {
    setActive((index + safeSlides.length) % safeSlides.length);
  }

  return (
    <div className="hero-carousel" aria-roledescription="carousel" aria-label="OKGS highlights">
      {safeSlides.map((slide, index) => (
        <div
          key={slide.id}
          className={`hero-slide ${index === active ? "is-current" : ""}`}
          style={{ backgroundImage: `url("${slide.image_url}")` }}
          aria-hidden={index !== active}
        />
      ))}
      <div className="hero-shade" />
      <div className="hero-content-wrap page-width">
        <div className="hero-copy" key={current.id}>
          <p className="eyebrow eyebrow-light"><span className="eyebrow-dot" />{current.eyebrow}</p>
          <h1>{current.title}</h1>
          <p className="hero-description">{current.description}</p>
          <div className="hero-actions">
            <a className="button button-gold" href={current.cta_href}>
              {current.cta_label} <ArrowRight size={16} strokeWidth={2.5} />
            </a>
            <a className="text-link text-link-light" href="#about">Our point of view <ArrowRight size={15} /></a>
          </div>
        </div>
        <div className="hero-side-note">
          <div className="hero-side-top"><span>EST.</span><strong>1998</strong></div>
          <div className="hero-side-rule" />
          <p>Growing curious minds and generous futures, one day at a time.</p>
          <span className="hero-side-mark">OKGS / 01</span>
        </div>
      </div>
      <div className="hero-footer page-width">
        <div className="hero-controls">
          <button className="circle-control" type="button" onClick={() => goTo(active - 1)} aria-label="Previous slide"><ChevronLeft size={17} /></button>
          <button className="circle-control" type="button" onClick={() => goTo(active + 1)} aria-label="Next slide"><ChevronRight size={17} /></button>
          <button className="pause-control" type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Play slides" : "Pause slides"}>
            {paused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
            <span>{paused ? "Play" : "Pause"}</span>
          </button>
        </div>
        <div className="hero-progress" aria-label="Select a slide">
          {safeSlides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              className={`progress-item ${index === active ? "is-current" : ""}`}
              onClick={() => goTo(index)}
              aria-label={`Go to slide ${index + 1}`}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <i><b /></i>
            </button>
          ))}
        </div>
        <span className="hero-scroll">Scroll to explore <ArrowRight size={15} /></span>
      </div>
    </div>
  );
}
