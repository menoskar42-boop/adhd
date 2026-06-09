/* NeuroPilot service worker.
 *
 * Sole job today: receive Web Push messages and surface them as system
 * notifications, even when no tab is open. The push payload is JSON:
 *   { "title": "...", "body": "...", "url": "/", "tag": "..." }
 * All fields optional; sensible Arabic defaults below.
 *
 * No offline caching here on purpose — the app is online-first and a
 * stale cache would be worse than a network fetch for an ADHD tool that
 * must always reflect the latest task state.
 */

self.addEventListener("install", () => {
  // Activate this SW immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of already-open clients without a reload.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Non-JSON payload — fall back to raw text as the body.
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "NeuroPilot";
  const options = {
    body: data.body || "حان وقت مهمتك 💙",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "neuropilot",
    renotify: true,
    dir: "rtl",
    lang: "ar",
    data: { url: data.url || "/" },
    // Vibrate where the platform honours it (Android).
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab if one is open.
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(targetUrl).catch(() => {});
            return undefined;
          }
        }
        // Otherwise open a fresh one.
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
        return undefined;
      }),
  );
});
