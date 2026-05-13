import { useEffect } from "react";

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

interface WakeLockNavigator {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
}

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    const nav = navigator as Navigator & WakeLockNavigator;
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (cancelled) {
          await lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        lock.addEventListener("release", () => {
          if (sentinel === lock) sentinel = null;
          // iOS Safari (and some Android browsers) silently release the
          // wake lock on big state churn — e.g., toast/overlay popping
          // up at the end of a session. Re-acquire as long as the page
          // is still visible; otherwise wait for visibilitychange.
          if (!cancelled && document.visibilityState === "visible") {
            acquire();
          }
        });
      } catch {
        // browser refused (e.g., no user gesture, hidden tab) — silent fallback
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    // Safety-net poll. The release event is best-effort across browsers
    // — iOS Safari in particular sometimes drops the lock silently after
    // OS-level interruptions (incoming notification, Control Center,
    // Low Power Mode, audio session change, app switcher peek). Every
    // 10 seconds, if we've lost the sentinel and the page is still
    // visible, request a new one. Idempotent: while a lock is held this
    // does nothing.
    const POLL_MS = 10_000;
    const pollId = setInterval(() => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      if (sentinel && !sentinel.released) return;
      sentinel = null;
      acquire();
    }, POLL_MS);

    // Re-acquire on the next user gesture too. iOS treats Wake Lock as
    // gesture-dependent and may refuse a request that came from a timer.
    // Touch / click are guaranteed-fresh gestures.
    const onUserGesture = () => {
      if (!cancelled && !sentinel) acquire();
    };
    document.addEventListener("touchstart", onUserGesture, { passive: true });
    document.addEventListener("click", onUserGesture, { passive: true });

    return () => {
      cancelled = true;
      clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("touchstart", onUserGesture);
      document.removeEventListener("click", onUserGesture);
      if (sentinel && !sentinel.released) {
        sentinel.release().catch(() => {});
      }
      sentinel = null;
    };
  }, [active]);
}
