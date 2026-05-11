import { useEffect, useState } from "react";
import {
  applyTheme,
  getStoredTheme,
  setStoredTheme,
  type ThemeMode,
} from "@/lib/theme";

/**
 * Tracks the current theme mode (light/dark) and exposes a toggle.
 * Applies the dark class on mount and whenever the mode flips so the
 * Tailwind `dark:` variants and the inline `theme.colors` getter both
 * see the same source of truth.
 */
export function useTheme(): {
  mode: ThemeMode;
  toggle: () => void;
} {
  const [mode, setMode] = useState<ThemeMode>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  const toggle = () => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setStoredTheme(next);
    setMode(next);
  };

  return { mode, toggle };
}
