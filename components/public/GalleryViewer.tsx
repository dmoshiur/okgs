"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { optimizedImage } from "@/lib/cloudinary";
import { SmartImage } from "@/components/public/Media";
import { bn } from "@/lib/format";
import { EmptyState } from "@/components/public/InternalPage";

export interface GalleryItem {
  src: string;
  caption?: string;
  meta?: string;
}

/** Grid + keyboard-navigable lightbox for club and campus photos. */
export function GalleryViewer({
  items,
  accent = "#e7c27e",
  columns = 4,
  emptyLabel = "এখনো কোনো ছবি যুক্ত করা হয়নি।",
}: {
  items: GalleryItem[];
  accent?: string;
  columns?: 3 | 4 | 5;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

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

  if (!items.length) return <EmptyState className="empty-note" message={emptyLabel} />;

  const active = open === null ? null : items[open];

  return (
    <>
      <div className={`gallery-grid gallery-cols-${columns}`}>
        {items.map((item, index) => (
          <button
            key={`${item.src}-${index}`}
            type="button"
            className="gallery-tile"
            onClick={() => setOpen(index)}
            style={{ "--club-accent": accent } as React.CSSProperties}
            aria-label={item.caption || `ছবি ${index + 1} দেখুন`}
          >
            <SmartImage src={item.src} alt={item.caption || ""} transform={{ width: 620, fit: "cover" }} label={item.caption || "ছবি"} />
            {item.caption ? (
              <span className="gallery-tile-caption">
                <strong>{item.caption}</strong>
                {item.meta ? <small>{item.meta}</small> : null}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {active ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="ছবি" onClick={(event) => event.target === event.currentTarget && close()}>
          <button className="lightbox-close" type="button" onClick={close} aria-label="বন্ধ করুন"><X size={20} /></button>
          {items.length > 1 ? (
            <>
              <button className="lightbox-nav lightbox-prev" type="button" onClick={() => step(-1)} aria-label="আগের ছবি"><ChevronLeft size={22} /></button>
              <button className="lightbox-nav lightbox-next" type="button" onClick={() => step(1)} aria-label="পরের ছবি"><ChevronRight size={22} /></button>
            </>
          ) : null}
          <figure className="lightbox-figure">
            <SmartImage src={active.src} alt={active.caption || ""} transform={{ width: 1600 }} label={active.caption || "ছবি"} />
            <figcaption>
              {active.caption ? <strong>{active.caption}</strong> : null}
              {active.meta ? <span>{active.meta}</span> : null}
              <em>{bn((open ?? 0) + 1)} / {bn(items.length)}</em>
            </figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}
