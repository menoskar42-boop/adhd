// Registers the service worker that powers Web Push. Safe to call on
// every load — registration is idempotent. The actual push subscription
// (PushManager + VAPID) is wired separately once permission is granted.

export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // Register after load so it never competes with first paint.
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration can fail on insecure origins (non-HTTPS) or in
      // private modes — push simply won't be available, the in-app
      // foreground notifications still work.
    });
  });
}
