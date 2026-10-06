"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { optimizedImage } from "@/lib/cloudinary";
import { bn } from "@/lib/format";

export interface ClubSitePhoto {
  url: string;
  caption?: string;
  meta?: string;
}

/**
 * Photo wall for a club site: a responsive mosaic with a real lightbox
 * (keyboard arrows, escape, swipe-free tap targets), sized so a phone never
 * has to scroll sideways.
 */
export function ClubSiteGallery({
  photos,
  clubName,
  limit = 24,
}: {
  photos: ClubSitePhoto[];
  clubName: string;
  limit?: number;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const items = photos.slice(0, limit);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (delta: number) => setOpen((current) => (current === null ? current : (current + delta + items.length) % items.length)),
    [items.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close, step]);

  if (!items.length) return null;
  const active = open === null ? null : items[open];

  return (
    <>
      <div className="clx-wall">
        {items.map((photo, index) => (
          <button
            key={`${photo.url}-${index}`}
            type="button"
            className="clx-shot"
            onClick={() => setOpen(index)}
            aria-label={photo.caption || `${clubName} — ছবি ${bn(index + 1)} বড় করে দেখুন`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={optimizedImage(photo.url, { width: 760, fit: "cover" })} alt={photo.caption || ""} loading="lazy" decoding="async" />
            <span className="clx-shot-veil" aria-hidden />
            <span className="clx-shot-zoom" aria-hidden><Expand size={15} /></span>
            {photo.caption || photo.meta ? (
              <span className="clx-shot-copy">
                {photo.caption ? <strong>{photo.caption}</strong> : null}
                {photo.meta ? <small>{photo.meta}</small> : null}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {active ? (
        <div
          className="clx-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${clubName} — ছবি`}
          onClick={(event) => event.target === event.currentTarget && close()}
        >
          <button className="clx-lightbox-close" type="button" onClick={close} aria-label="বন্ধ করুন">
            <X size={20} />
          </button>

          {items.length > 1 ? (
            <>
              <button className="clx-lightbox-nav is-prev" type="button" onClick={() => step(-1)} aria-label="আগের ছবি">
                <ChevronLeft size={22} />
              </button>
              <button className="clx-lightbox-nav is-next" type="button" onClick={() => step(1)} aria-label="পরের ছবি">
                <ChevronRight size={22} />
              </button>
            </>
          ) : null}

          <figure className="clx-lightbox-figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={optimizedImage(active.url, { width: 1600 })} alt={active.caption || ""} />
            <figcaption>
              {active.caption ? <strong>{active.caption}</strong> : null}
              <span>
                {active.meta ? `${active.meta} · ` : ""}
                {bn((open ?? 0) + 1)} / {bn(items.length)}
              </span>
            </figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}
