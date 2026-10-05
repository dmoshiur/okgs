"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/components/public/ThemeModeProvider";

export function ThemeModeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, toggleMode, ready } = useThemeMode();
  const isDark = mode === "dark";
  const Icon = isDark ? Sun : Moon;
  const action = isDark ? "লাইট মোড চালু করুন" : "ডার্ক মোড চালু করুন";
  const label = ready ? (isDark ? "ডার্ক" : "লাইট") : "থিম";

  return (
    <button
      className={`theme-mode-toggle${compact ? " theme-mode-toggle-compact" : ""}${isDark ? " is-dark" : ""}`}
      type="button"
      onClick={toggleMode}
      aria-label={action}
      aria-pressed={isDark}
      title={action}
      disabled={!ready}
    >
      <Icon size={16} aria-hidden />
      {!compact ? <span>{label} মোড</span> : <span className="sr-only">{label} মোড</span>}
    </button>
  );
}
