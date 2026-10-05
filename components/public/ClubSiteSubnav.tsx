"use client";

import { useEffect, useState } from "react";

export interface ClubSiteNavItem {
  id: string;
  label: string;
}

export function ClubSiteSubnav({ items }: { items: ClubSiteNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id || "");

  useEffect(() => {
    if (!items.length) return;
    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.15, 0.5] },
    );
    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="cs-subnav v2-wrap" aria-label="Կ্লাব সাইটের অংশসমূহ">
      <div className="cs-subnav-track">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`cs-subnav-pill${active === item.id ? " is-active" : ""}`}
            aria-current={active === item.id ? "location" : undefined}
            onClick={() => setActive(item.id)}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
