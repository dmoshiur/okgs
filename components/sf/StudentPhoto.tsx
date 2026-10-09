"use client";

/**
 * A student's photo, sized for the box it sits in.
 *
 * Cloudinary does the work: `f_auto,q_auto,w_300,h_400,c_fill` sends the browser
 * a 3:4 WebP/AVIF crop instead of the 4 MB original the office uploaded, which is
 * the single biggest win on the roster table — 50 rows used to pull 50 full-size
 * JPEGs before the first scroll.
 *
 * The image is lazy (`loading="lazy"` + `decoding="async"`), so rows below the
 * fold cost nothing until they are scrolled near, and a missing or dead URL
 * falls back to the student's initials instead of a broken-image glyph.
 */
import { useEffect, useMemo, useState } from "react";
import { optimizedImage } from "@/lib/cloudinary";

export type StudentPhotoSize = "xs" | "sm" | "md" | "lg";

/** Delivery width per size — the card crops to 3:4, so height is width × 4/3. */
const SIZE_WIDTH: Record<StudentPhotoSize, number> = { xs: 96, sm: 160, md: 300, lg: 600 };

function initialsOf(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]).join("") || value.slice(0, 1) || "?").toUpperCase();
}

export function StudentPhoto({
  src,
  name = "",
  size = "sm",
  className = "",
  /** Print surfaces need the image fetched immediately, not on scroll. */
  eager = false,
}: {
  src?: string | null;
  name?: string;
  size?: StudentPhotoSize;
  className?: string;
  eager?: boolean;
}) {
  const width = SIZE_WIDTH[size];
  const url = useMemo(
    () => optimizedImage(src, { width, height: Math.round((width * 4) / 3), fit: "cover" }),
    [src, width],
  );
  const [failed, setFailed] = useState(false);

  // A replaced photo is a new asset — re-arm the error handler.
  useEffect(() => setFailed(false), [url]);

  if (!url || failed) {
    return (
      <span className={`sf-photo is-fallback sf-photo-${size} ${className}`} aria-hidden="true">
        {initialsOf(name)}
      </span>
    );
  }

  return (
    <img
      key={url}
      className={`sf-photo sf-photo-${size} ${className}`}
      src={url}
      alt={name ? `${name} — photo` : ""}
      width={width}
      height={Math.round((width * 4) / 3)}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
