"use client";

import { useState } from "react";

/**
 * School mark. Uses the logo uploaded in the admin studio (settings → logo_url)
 * and falls back to a letter mark, so the header never shows a broken image.
 */
export function SchoolLogo({
  src,
  name,
  compact = false,
}: {
  src?: string | null;
  name: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const className = `official-logo ${compact ? "is-compact" : ""}`;
  const letter = (name.trim()[0] || "অ").toString();

  if (!src || failed) {
    return (
      <span className={`official-logo-fallback ${compact ? "is-compact" : ""}`} aria-label={name}>
        <span>{letter}</span>
      </span>
    );
  }
  return <img className={className} src={src} alt={name} onError={() => setFailed(true)} />;
}
