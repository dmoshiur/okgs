"use client";

import { useEffect, useRef } from "react";
import { clubPath, clubSections, type ClubSectionSlug } from "@/lib/club-data";
import type { Club } from "@/lib/types";

export function ClubTabs({ club, active }: { club: Club; active: ClubSectionSlug }) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const selected = nav?.querySelector<HTMLElement>("[aria-current='page']");
    if (!nav || !selected) return;

    const navRect = nav.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    const centeredLeft = nav.scrollLeft + selectedRect.left - navRect.left - (nav.clientWidth - selectedRect.width) / 2;
    nav.scrollTo({ left: Math.max(0, centeredLeft), behavior: "auto" });
  }, [active]);

  return (
    <nav ref={navRef} className="club-tabs" aria-label="ক্লাবের অংশসমূহ" tabIndex={0}>
      {clubSections.map((section) => {
        const isActive = active === section.slug;
        return (
          <a
            key={section.key}
            href={clubPath(club.slug, section.slug)}
            className={`club-tab${isActive ? " is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            style={{ "--club-accent": club.accent || "#e7c27e" } as React.CSSProperties}
          >
            {section.label}
          </a>
        );
      })}
    </nav>
  );
}
