// Two palettes for the brand. Dark is warm (1B1F22) rather than pure
// black so it stays comfortable for long focus sessions. Mirrors the
// web counterpart but with mobile-specific persistence via
// AsyncStorage and the system preference via React Native's
// Appearance module.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";

export type ThemeMode = "light" | "dark";

const KEY = "neuropilot-theme";

export interface Palette {
  background: string;
  runningBackground: string;
  surface: string;
  text: string;
  textMuted: string;
  primary: string;
  accent: string;
  border: string;
}

const lightPalette: Palette = {
  background: "#F5F7F6",
  runningBackground: "#EAF1EC",
  surface: "#FFFFFF",
  text: "#2E2E2E",
  textMuted: "#6B7E80",
  primary: "#4A6FA5",
  accent: "#7FB069",
  border: "#E0E7E3",
};

const darkPalette: Palette = {
  background: "#1B1F22",
  runningBackground: "#1F2A23",
  surface: "#262B2F",
  text: "#E8E8E8",
  textMuted: "#9AA8AA",
  primary: "#8AA8D6",
  accent: "#A6C98A",
  border: "#2E3438",
};

export function paletteFor(mode: ThemeMode): Palette {
  return mode === "dark" ? darkPalette : lightPalette;
}

export async function getStoredTheme(): Promise<ThemeMode> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

export async function setStoredTheme(mode: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, mode);
  } catch {}
}
