"use client";

import { useState } from "react";

const officialLogoSources = [
  "https://omarkgschool.com/images/logo.png",
  "https://omarkgschool.com/images/logo.jpg",
  "https://omarkgschool.com/images/school-logo.png",
  "https://omarkgschool.com/images/logo.svg",
  "https://omarkgschool.com/favicon.ico",
];

export function OfficialLogo({ compact = false }: { compact?: boolean }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const failed = sourceIndex >= officialLogoSources.length;

  return failed ? (
    <span className={`official-logo-fallback ${compact ? "is-compact" : ""}`} aria-label="ওমর কিন্ডারগার্টেন স্কুলের লোগো">
      <span>ও</span>
    </span>
  ) : (
    <img
      className={`official-logo ${compact ? "is-compact" : ""}`}
      src={officialLogoSources[sourceIndex]}
      alt="ওমর কিন্ডারগার্টেন স্কুলের লোগো"
      onError={() => setSourceIndex((index) => index + 1)}
    />
  );
}
