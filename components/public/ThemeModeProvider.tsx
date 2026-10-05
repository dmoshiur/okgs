"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ColorScheme = "light" | "dark";
export const COLOR_SCHEME_STORAGE_KEY = "okgs-color-scheme";

interface ThemeModeContextValue {
  mode: ColorScheme;
  setMode: (mode: ColorScheme) => void;
  toggleMode: () => void;
  ready: boolean;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function isColorScheme(value: string | null): value is ColorScheme {
  return value === "light" || value === "dark";
}

function applyColorScheme(mode: ColorScheme) {
  document.documentElement.dataset.colorScheme = mode;
  if (document.body) document.body.dataset.colorScheme = mode;
}

/** OS theme by default; an explicit toggle is saved as a durable override. */
export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, updateMode] = useState<ColorScheme>("light");
  const [ready, setReady] = useState(false);
  const hasManualChoice = useRef(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    } catch {
      // Keep the current visit usable when storage is disabled.
    }

    const hasSavedPreference = isColorScheme(stored);
    hasManualChoice.current = hasSavedPreference;
    const initial: ColorScheme = hasSavedPreference ? (stored as ColorScheme) : preference.matches ? "dark" : "light";
    applyColorScheme(initial);
    updateMode(initial);
    setReady(true);

    const onSystemChange = (event: MediaQueryListEvent) => {
      if (hasManualChoice.current) return;
      const next = event.matches ? "dark" : "light";
      applyColorScheme(next);
      updateMode(next);
    };

    preference.addEventListener?.("change", onSystemChange);
    return () => preference.removeEventListener?.("change", onSystemChange);
  }, []);

  const setMode = useCallback((next: ColorScheme) => {
    hasManualChoice.current = true;
    updateMode(next);
    applyColorScheme(next);
    try {
      window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next);
    } catch {
      // The chosen mode still applies until the page is closed.
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = useMemo(() => ({ mode, setMode, toggleMode, ready }), [mode, setMode, toggleMode, ready]);
  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const value = useContext(ThemeModeContext);
  if (!value) throw new Error("useThemeMode must be used within ThemeModeProvider");
  return value;
}
