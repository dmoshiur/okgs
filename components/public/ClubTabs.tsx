"use client";

import { useEffect, useRef } from "react";
import { clubPath, clubSections, type ClubSectionSlug } from "@/lib/club-data";
import type { Club } from "@/lib/types";
import { normalizeHexColor, readableTextColor } from "@/lib/club-colors";

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

  const accent = normalizeHexColor(club.accent, "#2563eb");

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
            style={{
              "--club-accent": accent,
              "--club-accent-text": `color-mix(in srgb, ${accent} 56%, var(--ink))`,
              "--club-accent-ink": readableTextColor(accent),
              "--club-accent-wash": `color-mix(in srgb, ${accent} 10%, var(--surface))`,
              "--club-accent-line": `color-mix(in srgb, ${accent} 26%, var(--line))`,
            } as React.CSSProperties}
          >
            {section.label}
          </a>
        );
      })}
    </nav>
  );
}
