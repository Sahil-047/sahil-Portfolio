"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import ThemePortalOverlay from "@/components/ThemePortalOverlay";
import ThemeLightFlash from "@/components/ThemeLightFlash";
import type { ThemePortalTransition } from "@/components/ThemePortalOverlay";

type Theme = "light" | "dark";

export type ThemePortalOrigin = {
  x: number;
  y: number;
};

type ThemeContextValue = {
  theme: Theme;
  isDark: boolean;
  isTransitioning: boolean;
  toggleTheme: (origin?: ThemePortalOrigin) => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [transition, setTransition] = useState<ThemePortalTransition | null>(
    null,
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback(
    (next: Theme) => {
      if (transition) return;
      setThemeState(next);
    },
    [transition],
  );

  const toggleTheme = useCallback(
    (origin?: ThemePortalOrigin) => {
      if (transition) return;
      const to: Theme = theme === "light" ? "dark" : "light";
      const x =
        origin?.x ??
        (typeof window !== "undefined" ? window.innerWidth * 0.92 : 0);
      const y =
        origin?.y ?? (typeof window !== "undefined" ? 48 : 0);
      setTransition({ from: theme, to, x, y, id: Date.now() });
    },
    [theme, transition],
  );

  const finishTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const clearTransition = useCallback(() => {
    setTransition(null);
  }, []);

  const onLightReady = useCallback(() => {
    finishTheme("light");
  }, [finishTheme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      isTransitioning: transition !== null,
      toggleTheme,
      setTheme,
    }),
    [theme, transition, toggleTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {transition?.to === "dark" ? (
        <ThemePortalOverlay
          transition={transition}
          onThemeReady={finishTheme}
          onComplete={clearTransition}
        />
      ) : null}
      {transition?.to === "light" ? (
        <ThemeLightFlash
          id={transition.id}
          x={transition.x}
          y={transition.y}
          onThemeReady={onLightReady}
          onComplete={clearTransition}
        />
      ) : null}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
