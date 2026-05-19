import { haptics } from "./haptics";

const ALERT_SRC = "/sounds/arrival.wav";

// Cached so we don't re-download on every timer end. The Audio element
// is reset to time 0 before each play so consecutive sessions all
// produce the same short attention bump.
let cachedAudio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (!cachedAudio) {
    const a = new Audio(ALERT_SRC);
    a.preload = "auto";
    a.volume = 0.6;
    cachedAudio = a;
  }
  return cachedAudio;
}

/**
 * Fire when a focus session timer hits 00:00. The text-only "خلصت
 * الجلسة!" prompt is easy to miss when the phone is on the desk and
 * the user has looked away — this is the non-visual layer:
 *
 * - a short tone (re-using the arrival WAV) for any ringer-on phone
 * - a success vibration for platforms with navigator.vibrate
 *
 * Both fail silently when the browser/OS refuses, so the visible
 * prompt remains the source of truth.
 */
export function playTimerEndAlert(): void {
  const a = getAudio();
  if (a) {
    a.currentTime = 0;
    a.play().catch(() => {
      // Autoplay blocked (very rare here — the user gestured to start
      // the session) — fall back to vibration alone.
    });
  }
  haptics.success();
}
