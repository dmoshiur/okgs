"use client";

/**
 * ThemeModeProvider — light/dark preference.
 *
 * The choice is persisted in a **cookie** (never localStorage/sessionStorage:
 * this app keeps state in the database or in cookies so a different device, or a
 * cleared browser storage, cannot change what a staff member sees). The server
 * reads the same cookie in `app/layout.tsx` and paints `data-color-scheme` before
 * the first frame, so there is no flash of the wrong theme and no inline script.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ColorScheme = "light" | "dark";
/** Cookie name — kept as an export so `lib/color-scheme.ts` and the layout agree. */
export const COLOR_SCHEME_COOKIE = "okgs-color-scheme";
/** @deprecated the value became a cookie; the alias keeps older imports working. */
export const COLOR_SCHEME_STORAGE_KEY = COLOR_SCHEME_COOKIE;
const MAX_AGE = 60 * 60 * 24 * 365;

interface ThemeModeContextValue {
  mode: ColorScheme;
  setMode: (mode: ColorScheme) => void;
  toggleMode: () => void;
  ready: boolean;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function isColorScheme(value: string | null | undefined): value is ColorScheme {
  return value === "light" || value === "dark";
}

function readCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}${
    window.location.protocol === "https:" ? "; Secure" : ""
  }`;
}

function applyColorScheme(mode: ColorScheme) {
  document.documentElement.dataset.colorScheme = mode;
  if (document.body) document.body.dataset.colorScheme = mode;
}

/** The attribute the server rendered (`<html data-color-scheme>`) is the truth. */
function serverColorScheme(): ColorScheme | null {
  const value = document.documentElement.dataset.colorScheme;
  return isColorScheme(value) ? value : null;
}

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, updateMode] = useState<ColorScheme>("light");
  const [ready, setReady] = useState(false);
  // A theme the visitor explicitly picked wins over the OS preference.
  const hasManualChoice = useRef(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const cookie = readCookie(COLOR_SCHEME_COOKIE);
    const initial: ColorScheme = serverColorScheme() ?? (isColorScheme(cookie) ? cookie : preference.matches ? "dark" : "light");
    hasManualChoice.current = isColorScheme(cookie);
    applyColorScheme(initial);
    updateMode(initial);
    setReady(true);

    const onSystemChange = (event: MediaQueryListEvent) => {
      if (hasManualChoice.current) return;
      const next: ColorScheme = event.matches ? "dark" : "light";
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
    writeCookie(COLOR_SCHEME_COOKIE, next);
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
