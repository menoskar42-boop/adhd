// Two palettes for the brand. The dark set is biased warm (not pure
// blacks) which reads softer for long focus sessions and avoids the
// "OLED black" look that can feel oppressive at night.

export type ThemeMode = "light" | "dark";

const lightColors = {
  background: "#F5F7F6",
  primary: "#4A6FA5",
  accent: "#7FB069",
  text: "#2E2E2E",
};

const darkColors = {
  background: "#1B1F22",
  primary: "#8AA8D6",
  accent: "#A6C98A",
  text: "#E8E8E8",
};

const KEY = "neuropilot-theme";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(KEY);
  if (stored === "dark" || stored === "light") return stored;
  // Fall back to the OS preference.
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function setStoredTheme(mode: ThemeMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, mode);
  applyTheme(mode);
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
}

export function colorsFor(mode: ThemeMode) {
  return mode === "dark" ? darkColors : lightColors;
}

/**
 * Live colour bag the rest of the app reads via `theme.colors`. It's
 * a getter so reads pick up the latest mode without re-importing.
 */
export const theme = {
  get colors() {
    return colorsFor(getStoredTheme());
  },
};
