"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Slide } from "@/lib/types";

export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const safeSlides = slides.length ? slides : [{
    id: "fallback",
    eyebrow: "ওমর কিন্ডারগার্টেন স্কুল",
    title: "শিক্ষায় গড়ি আলোকিত ভবিষ্যৎ",
    description: "২০০৩ সাল থেকে কালাই, জয়পুরহাটে মানসম্মত শিক্ষায় নিবেদিত।",
    cta_label: "ভর্তি তথ্য",
    cta_href: "#admission",
    image_url: "https://omarkgschool.com/images/mission.jpg",
    accent: "#d97706",
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
    const timer = window.setInterval(() => setActive((index) => (index + 1) % safeSlides.length), 6200);
    return () => window.clearInterval(timer);
  }, [paused, safeSlides.length]);

  const goTo = (index: number) => setActive((index + safeSlides.length) % safeSlides.length);

  return (
    <div className="hero-carousel" aria-roledescription="carousel" aria-label="স্কুলের বিশেষ বার্তা">
      {safeSlides.map((slide, index) => (
        <div key={slide.id} className={`hero-slide ${index === active ? "is-current" : ""}`} style={{ backgroundImage: `url("${slide.image_url}")` }} aria-hidden={index !== active} />
      ))}
      <div className="hero-shade" />
      <div className="page-width hero-content-wrap">
        <div className="hero-copy" key={current.id}>
          <p className="hero-kicker"><span />{current.eyebrow}</p>
          <h1>{current.title}</h1>
          <p className="hero-description">{current.description}</p>
          <div className="hero-actions">
            <a className="button button-gold" href={current.cta_href}>{current.cta_label} <ArrowRight size={16} /></a>
            <a className="hero-text-link" href="#about">আমাদের সম্পর্কে <ArrowRight size={15} /></a>
          </div>
        </div>
        <div className="hero-badge"><span>প্রতিষ্ঠা</span><strong>২০০৩</strong><i /> <small>কালাই, জয়পুরহাট</small></div>
      </div>
      <div className="page-width hero-footer">
        <div className="hero-controls">
          <button className="circle-control" type="button" onClick={() => goTo(active - 1)} aria-label="আগের স্লাইড"><ChevronLeft size={17} /></button>
          <button className="circle-control" type="button" onClick={() => goTo(active + 1)} aria-label="পরের স্লাইড"><ChevronRight size={17} /></button>
          <button className="pause-control" type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "স্লাইড চালু করুন" : "স্লাইড থামান"}>{paused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}<span>{paused ? "চালু" : "থামান"}</span></button>
        </div>
        <div className="hero-progress" aria-label="স্লাইড নির্বাচন">
          {safeSlides.map((slide, index) => <button key={slide.id} type="button" className={`progress-item ${index === active ? "is-current" : ""}`} onClick={() => goTo(index)} aria-label={`স্লাইড ${index + 1}`}><span>০{index + 1}</span><i><b /></i></button>)}
        </div>
        <span className="hero-scroll">নিচে দেখুন <ArrowRight size={15} /></span>
      </div>
    </div>
  );
}
