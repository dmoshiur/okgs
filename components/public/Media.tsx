"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImageOff } from "lucide-react";
import { optimizedImage, type TransformOptions } from "@/lib/cloudinary";

interface FallbackProps {
  label?: string;
  accent?: string;
  className?: string;
}

/** Shown when an asset is missing or fails to load, so layouts never collapse. */
export function MediaFallback({ label, accent = "#166534", className = "" }: FallbackProps) {
  return (
    <span className={`media-fallback ${className}`} style={{ "--media-accent": accent } as React.CSSProperties} aria-hidden="true">
      <span className="media-fallback-mark"><ImageOff size={18} /></span>
      {label ? <span className="media-fallback-label break-words">{label}</span> : null}
    </span>
  );
}

interface SmartImageProps extends FallbackProps {
  src?: string | null;
  alt: string;
  transform?: TransformOptions;
  sizes?: string;
  loading?: "lazy" | "eager";
  priority?: boolean;
}

/**
 * An image that never leaves a broken frame behind.
 *
 * Two failure modes are handled: no URL at all (the admin cleared the field or
 * deleted the asset) and a URL that 404s (the asset was removed from
 * Cloudinary). Either way the layout keeps its shape and the caption is shown
 * instead of a torn-image icon.
 *
 * The failure is tracked **per URL**: replacing a broken image with a working
 * one re-arms the `onError` handler instead of silently keeping the fallback —
 * that was the old behaviour, and it meant a replaced hero/logo stayed blank
 * until the server was restarted.
 */
export function SmartImage({ src, alt, transform, sizes, loading = "lazy", priority, label, accent, className = "" }: SmartImageProps) {
  const url = useMemo(() => optimizedImage(src, transform ?? { width: 1200 }), [src, transform]);
  const [failed, setFailed] = useState(false);

  // A new URL is a new asset — drop any stale "this one is broken" mark.
  useEffect(() => {
    setFailed(false);
  }, [url]);

  const onError = useCallback(() => setFailed(true), []);

  if (!url || failed) return <MediaFallback label={label ?? alt} accent={accent} className={className} />;

  return (
    <img
      // Remounting on URL change guarantees the browser re-requests the asset
      // (and that a lazy image does not keep the previous element's state).
      key={url}
      className={`smart-image ${className}`}
      src={url}
      alt={alt}
      loading={priority ? "eager" : loading}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      sizes={sizes}
      onError={onError}
    />
  );
}

interface SmartBackdropProps extends FallbackProps {
  src?: string | null;
  transform?: TransformOptions;
  className?: string;
  children?: React.ReactNode;
  as?: "div" | "span";
}

/**
 * Cover-image layer used by cards and hero blocks.
 *
 * A CSS `background-image` cannot fire `onError`, so a dead URL used to leave an
 * empty, silent box. The URL is probed with a detached `Image` first: while it
 * is loading the element renders its own gradient, and a failure swaps in the
 * same fallback an `<img>` would get.
 */
export function SmartBackdrop({ src, transform, className = "", children, label, accent, as: Tag = "div" }: SmartBackdropProps) {
  const url = useMemo(() => optimizedImage(src, transform ?? { width: 1400, fit: "cover" }), [src, transform]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const probe = new window.Image();
    probe.onload = () => { if (!cancelled) setFailed(false); };
    probe.onerror = () => { if (!cancelled) setFailed(true); };
    probe.src = url;
    return () => {
      cancelled = true;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [url]);

  const show = Boolean(url) && !failed;

  return (
    <Tag className={`${show ? "has-image " : ""}${className}`} style={show ? { backgroundImage: `url("${url}")` } : undefined}>
      {!show ? <MediaFallback label={label} accent={accent} /> : null}
      {children}
    </Tag>
  );
}

/**
 * Small list/table thumbnail (admin rows, console headers, club pills).
 *
 * A dead URL in one of these frames used to render the browser's broken-image
 * glyph on top of the surrounding text. Here the whole element is swapped for a
 * caller-supplied fallback — usually the resource icon — the moment the request
 * fails, and re-armed when the URL changes so a replaced image comes back.
 */
export function ThumbImage({
  src,
  alt = "",
  className = "",
  fallback = null,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const url = String(src ?? "").trim();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url || failed) return <>{fallback}</>;
  return <img className={className} src={url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

export function ExternalLinkText({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}
