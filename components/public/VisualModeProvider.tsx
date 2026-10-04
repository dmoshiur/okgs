"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { VISUAL_MODE_STORAGE_KEY, visualThemes, type VisualMode } from "@/lib/design-themes";

interface VisualModeContextValue {
  mode: VisualMode;
  setMode: (mode: VisualMode) => void;
  toggleMode: () => void;
  ready: boolean;
}

const VisualModeContext = createContext<VisualModeContextValue | null>(null);

export function VisualModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, updateMode] = useState<VisualMode>("academic");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VISUAL_MODE_STORAGE_KEY);
      if (saved === "academic" || saved === "science-fair") updateMode(saved);
    } catch {
      // Storage can be unavailable in private browsing; the in-memory switch still works.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.body.dataset.visualMode = mode;
    Object.entries(visualThemes[mode].tokens).forEach(([name, value]) => {
      document.body.style.setProperty(name, value);
    });
    try {
      window.localStorage.setItem(VISUAL_MODE_STORAGE_KEY, mode);
    } catch {
      // Keep the current mode for this visit if persistence is blocked.
    }
  }, [mode, ready]);

  const setMode = useCallback((next: VisualMode) => updateMode(next), []);
  const toggleMode = useCallback(() => updateMode((current) => current === "academic" ? "science-fair" : "academic"), []);
  const value = useMemo(() => ({ mode, setMode, toggleMode, ready }), [mode, setMode, toggleMode, ready]);

  return <VisualModeContext.Provider value={value}>{children}</VisualModeContext.Provider>;
}

export function useVisualMode() {
  const value = useContext(VisualModeContext);
  if (!value) throw new Error("useVisualMode must be used within VisualModeProvider");
  return value;
}
