// Foreground geofence: works while the tab is open and the device awake.
// Pair with the Wake Lock hook so the screen stays on. The browser does not
// offer reliable background geolocation across platforms (notably iOS Safari),
// so a true mobile-style geofence isn't available — this is the closest we
// can get.

import {
  deleteScheduledTask,
  getScheduledTasks,
  getTask,
  setNextTask,
  setTask,
} from "./storage";

export interface GeofenceTarget {
  placeId: string;
  latitude: number;
  longitude: number;
}

const RADIUS_METERS = 100;
const EARTH_RADIUS_M = 6_371_000;

let watchId: number | null = null;
let targets: GeofenceTarget[] = [];
const visited = new Set<string>();
let arrivalCallback: ((placeId: string) => void) | null = null;

/**
 * Subscribe to geofence arrival events so the UI can refresh its task state
 * from storage. The callback receives the placeId of the place that was
 * just entered. Returns an unsubscribe function. Only one subscriber is
 * supported at a time.
 */
export function onArrival(cb: (placeId: string) => void): () => void {
  arrivalCallback = cb;
  return () => {
    if (arrivalCallback === cb) arrivalCallback = null;
  };
}

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function notify(body: string): void {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification("NeuroPilot 📍", { body });
}

// Read the FIFO-oldest scheduled task tied to the given place, promote it
// to active when nothing else is running, or queue it as the next task
// otherwise. Removes the chosen scheduled task from the list either way.
function handleArrival(placeId: string): void {
  const scheduled = getScheduledTasks();
  const arrival = scheduled
    .filter((t) => t.locationId === placeId)
    .sort((a, b) => a.createdAt - b.createdAt)[0];

  if (!arrival) {
    const active = getTask();
    if (active) notify(`وصلت! حان وقت مهمتك: ${active.title}`);
    else notify("وصلت لمكانك");
    arrivalCallback?.(placeId);
    return;
  }

  deleteScheduledTask(arrival.id);
  const active = getTask();
  const promoted = {
    title: arrival.title,
    sessions: [],
    currentDuration: arrival.currentDuration,
    locationId: arrival.locationId,
  };

  if (!active) {
    setTask(promoted);
    notify(`حان وقت مهمتك: ${arrival.title}`);
  } else {
    setNextTask(promoted);
    notify(`وصلت! مهمتك الجاية جاهزة: ${arrival.title}`);
  }

  arrivalCallback?.(placeId);
}

export async function requestPermissions(): Promise<boolean> {
  // Notification permission is best-effort. The arrival notification is a
  // nice-to-have — the in-app waiting screen and next-task banner are the
  // primary UX. Crucially, on platforms where Notification is unavailable
  // (e.g. iOS Safari in a non-PWA tab) or denied, we must NOT bail out
  // here, otherwise the geolocation prompt below never fires.
  if ("Notification" in window && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      // Silently ignore — proceed to geolocation regardless.
    }
  }
  if (!("geolocation" in navigator)) return false;
  // Trigger the browser's geolocation prompt. The result tells us whether
  // the geofence can run.
  return new Promise<boolean>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  });
}

/**
 * Replace the set of places the foreground watcher is monitoring. Each
 * arrival fires once per place per session (deduped via the `visited`
 * set). An empty list stops the watcher entirely.
 */
export function setGeofenceTargets(next: GeofenceTarget[]): void {
  if (!("geolocation" in navigator)) return;
  // Stop any previous watcher but keep `visited` so we don't re-fire the
  // same place when targets are rearranged.
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  targets = next;
  if (targets.length === 0) return;

  // Drop visited entries for places that are no longer in the target list
  // so a future re-add can trigger again.
  const activeIds = new Set(targets.map((t) => t.placeId));
  for (const id of Array.from(visited)) {
    if (!activeIds.has(id)) visited.delete(id);
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const here = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      for (const t of targets) {
        if (visited.has(t.placeId)) continue;
        const d = distanceMeters(here, t);
        if (d <= RADIUS_METERS) {
          visited.add(t.placeId);
          handleArrival(t.placeId);
        }
      }
    },
    () => {
      // Ignore transient errors; user may move out of GPS range etc.
    },
    { enableHighAccuracy: true, maximumAge: 30_000, timeout: 60_000 },
  );
}

/** Stop the watcher and forget which places we've already fired for. */
export function stopGeofence(): void {
  if (watchId !== null && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
  targets = [];
  visited.clear();
}

export function isGeofenceActive(): boolean {
  return watchId !== null;
}

/**
 * @deprecated Compat shim while Home.tsx migrates to setGeofenceTargets.
 * Treats the single coordinate as one anonymous target.
 */
export function startGeofence(latitude: number, longitude: number): void {
  setGeofenceTargets([{ placeId: "__legacy__", latitude, longitude }]);
}
