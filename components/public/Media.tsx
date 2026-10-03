"use client";

import { useState } from "react";
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
      {label ? <span className="media-fallback-label">{label}</span> : null}
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

export function SmartImage({ src, alt, transform, sizes, loading = "lazy", priority, label, accent, className = "" }: SmartImageProps) {
  const url = optimizedImage(src, transform ?? { width: 1200 });
  const [failed, setFailed] = useState(false);

  if (!url || failed) return <MediaFallback label={label ?? alt} accent={accent} className={className} />;

  return (
    <img
      className={`smart-image ${className}`}
      src={url}
      alt={alt}
      loading={priority ? "eager" : loading}
      decoding="async"
      sizes={sizes}
      onError={() => setFailed(true)}
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

/** Cover-image style layer used by cards and hero blocks. */
export function SmartBackdrop({ src, transform, className = "", children, label, accent, as: Tag = "div" }: SmartBackdropProps) {
  const url = optimizedImage(src, transform ?? { width: 1400, fit: "cover" });
  return (
    <Tag className={`${url ? "has-image " : ""}${className}`} style={url ? { backgroundImage: `url("${url}")` } : undefined}>
      {!url ? <MediaFallback label={label} accent={accent} /> : null}
      {children}
    </Tag>
  );
}

export function ExternalLinkText({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}
