"use client";

/**
 * VisualModeProvider — the academic / science-fair paint of the public site.
 *
 * Persistence is a cookie (this project bans localStorage and sessionStorage for
 * any state), and the server reads the same cookie in `app/layout.tsx` so the
 * first paint already carries the right tokens.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { VISUAL_MODE_COOKIE, visualThemes, type VisualMode } from "@/lib/design-themes";

interface VisualModeContextValue {
  mode: VisualMode;
  setMode: (mode: VisualMode) => void;
  toggleMode: () => void;
  ready: boolean;
}

const VisualModeContext = createContext<VisualModeContextValue | null>(null);

function isVisualMode(value: string | null | undefined): value is VisualMode {
  return value === "academic" || value === "science-fair";
}

function paint(mode: VisualMode) {
  if (document.body) document.body.dataset.visualMode = mode;
  // Palette tokens live on <html>; the color-scheme layer can then override them
  // on <body> without fighting inline styles when dark mode is selected.
  Object.entries(visualThemes[mode].tokens).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });
}

export function VisualModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, updateMode] = useState<VisualMode>("academic");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const attribute = document.body?.dataset.visualMode;
    const cookie = decodeURIComponent(document.cookie.match(new RegExp(`(?:^|; )${VISUAL_MODE_COOKIE}=([^;]*)`))?.[1] ?? "");
    const initial = isVisualMode(attribute) ? attribute : isVisualMode(cookie) ? cookie : "academic";
    updateMode(initial);
    paint(initial);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    paint(mode);
    document.cookie = `${VISUAL_MODE_COOKIE}=${encodeURIComponent(mode)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}${
      window.location.protocol === "https:" ? "; Secure" : ""
    }`;
  }, [mode, ready]);

  const setMode = useCallback((next: VisualMode) => updateMode(next), []);
  const toggleMode = useCallback(() => updateMode((current) => (current === "academic" ? "science-fair" : "academic")), []);
  const value = useMemo(() => ({ mode, setMode, toggleMode, ready }), [mode, setMode, toggleMode, ready]);

  return <VisualModeContext.Provider value={value}>{children}</VisualModeContext.Provider>;
}

export function useVisualMode() {
  const value = useContext(VisualModeContext);
  if (!value) throw new Error("useVisualMode must be used within VisualModeProvider");
  return value;
}
