"use client";

import { Sparkles, Telescope } from "lucide-react";
import { useVisualMode } from "@/components/public/VisualModeProvider";

export function VisualModeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, toggleMode, ready } = useVisualMode();
  const isFair = mode === "science-fair";
  const label = isFair ? "বিজ্ঞান মেলা" : "একাডেমিক";

  return (
    <button
      className={`visual-mode-toggle${compact ? " visual-mode-toggle-compact" : ""}${isFair ? " is-fair" : ""}`}
      type="button"
      onClick={toggleMode}
      aria-pressed={isFair}
      aria-label={`বর্তমান ${label}। ${isFair ? "একাডেমিক" : "বিজ্ঞান মেলা"} মোডে পরিবর্তন করুন`}
      title={isFair ? "একাডেমিক মোডে ফিরুন" : "বিজ্ঞান মেলা মোড চালু করুন"}
      disabled={!ready}
    >
      {isFair ? <Sparkles size={15} aria-hidden /> : <Telescope size={15} aria-hidden />}
      {!compact && <span>{isFair ? "বিজ্ঞান মেলা" : "একাডেমিক"}</span>}
      <span className="visual-mode-indicator" aria-hidden />
    </button>
  );
}
