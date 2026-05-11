// Tiny haptic helper for the web. Uses navigator.vibrate where the
// platform supports it (Android Chrome, some Linux desktops). Silently
// no-ops everywhere else (iOS Safari, most desktops) so callers can fire
// hapticLight() without checking.

type Pattern = number | number[];

function vibrate(pattern: Pattern): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw on rapid repeats — ignore.
  }
}

export const haptics = {
  /** Brief tap for routine confirmations (start, pause, place chip). */
  light(): void {
    vibrate(10);
  },
  /** Slightly longer for impactful actions (add task, complete). */
  medium(): void {
    vibrate(25);
  },
  /** Double bump for celebratory moments (session done). */
  success(): void {
    vibrate([15, 60, 30]);
  },
  /** Short triple bump for warnings (permission denied, distraction). */
  warning(): void {
    vibrate([20, 40, 20]);
  },
};
