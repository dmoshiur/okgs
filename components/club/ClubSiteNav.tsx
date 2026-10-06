"use client";

import { useEffect, useRef, useState } from "react";

export interface ClubSiteNavItem {
  id: string;
  label: string;
}

/**
 * The club site's section rail.
 *
 * Renders every section as an anchor (works without JavaScript), keeps the pill
 * for the section you are reading centred on phones, and never touches the URL —
 * so `alssm.okgs.info` stays one clean address.
 */
export function ClubSiteNav({ items }: { items: ClubSiteNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const trackRef = useRef<HTMLDivElement>(null);
  const key = items.map((item) => item.id).join("|");

  useEffect(() => {
    const ids = key ? key.split("|") : [];
    if (!ids.length) return;

    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!sections.length) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.scrollY + Math.max(140, window.innerHeight * 0.3);
      let current = sections[0].id;
      for (const section of sections) {
        if (section.offsetTop <= line) current = section.id;
      }
      setActive((previous) => (previous === current ? previous : current));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [key]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const pill = track.querySelector<HTMLElement>(`[data-section="${active}"]`);
    if (!pill) return;
    const left = pill.offsetLeft - track.clientWidth / 2 + pill.clientWidth / 2;
    track.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  if (items.length < 2) return null;

  return (
    <div className="clx-rail">
      <nav className="clx-wrap clx-rail-inner" aria-label="ক্লাব সাইটের অংশসমূহ">
        <div className="clx-rail-track" ref={trackRef}>
          {items.map((item) => (
            <a
              key={item.id}
              data-section={item.id}
              href={`#${item.id}`}
              className={`clx-rail-pill${active === item.id ? " is-active" : ""}`}
              aria-current={active === item.id ? "true" : undefined}
              onClick={() => setActive(item.id)}
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
