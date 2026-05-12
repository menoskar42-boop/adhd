import { useEffect, useRef, useState } from "react";

const ALARM_SRC = "/sounds/arrival.wav";

/**
 * Loops the arrival alarm until the user taps Stop. Designed for the
 * "phone on the desk, screen on, NeuroPilot tab open" scenario — the
 * built-in browser notification can be missed in DnD, so the alarm is
 * the assertive layer.
 *
 * Browsers throttle background audio (especially iOS Safari once the
 * screen locks); that's a hard web limitation. For "phone in pocket
 * with screen off" reliability the mobile app's HIGH-importance
 * notification channel is the right tool, not this hook.
 */
export function useArrivalAlarm(): {
  isRinging: boolean;
  start: () => void;
  stop: () => void;
} {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isRinging, setIsRinging] = useState(false);

  // Lazily create the Audio element on the first call to start(). This
  // avoids touching the network until the geofence actually fires.
  const ensureAudio = (): HTMLAudioElement | null => {
    if (typeof window === "undefined" || typeof Audio === "undefined") {
      return null;
    }
    if (!audioRef.current) {
      const a = new Audio(ALARM_SRC);
      a.loop = true;
      a.volume = 0.7;
      a.preload = "auto";
      audioRef.current = a;
    }
    return audioRef.current;
  };

  const start = () => {
    const a = ensureAudio();
    if (!a) return;
    a.currentTime = 0;
    a.play()
      .then(() => setIsRinging(true))
      .catch(() => {
        // Autoplay refused (rare — the user already gestured to add the
        // task) or the file 404'd. Either way, fail silently and let
        // the browser Notification fallback do its job.
      });
  };

  const stop = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setIsRinging(false);
  };

  // Make sure a stray ring doesn't outlive the component.
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.currentTime = 0;
      }
      audioRef.current = null;
    };
  }, []);

  return { isRinging, start, stop };
}
