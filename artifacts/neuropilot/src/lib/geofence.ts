// Foreground geofence: works while the tab is open and the device awake.
// Pair with the Wake Lock hook so the screen stays on. The browser does not
// offer reliable background geolocation across platforms (notably iOS Safari),
// so a true mobile-style geofence isn't available — this is the closest we
// can get.

import { getTask } from "./storage";

const RADIUS_METERS = 100;
const EARTH_RADIUS_M = 6_371_000;

let watchId: number | null = null;
let target: { latitude: number; longitude: number } | null = null;
let alreadyEntered = false;

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

function fireArrivalNotification(): void {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const task = getTask();
  const title = task?.title ?? "مهمتك";
  new Notification("NeuroPilot 📍", { body: `حان وقت مهمتك: ${title}` });
}

export async function requestPermissions(): Promise<boolean> {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }
  if (!("geolocation" in navigator)) return false;
  // Force a one-shot fix to trigger the browser's permission prompt.
  return new Promise<boolean>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  });
}

export function startGeofence(latitude: number, longitude: number): void {
  if (!("geolocation" in navigator)) return;
  stopGeofence();
  target = { latitude, longitude };
  alreadyEntered = false;
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (!target || alreadyEntered) return;
      const d = distanceMeters(target, {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (d <= RADIUS_METERS) {
        alreadyEntered = true;
        fireArrivalNotification();
        stopGeofence();
      }
    },
    () => {
      // Ignore transient errors; user may move out of GPS range etc.
    },
    { enableHighAccuracy: true, maximumAge: 30_000, timeout: 60_000 },
  );
}

export function stopGeofence(): void {
  if (watchId !== null && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
  target = null;
  alreadyEntered = false;
}

export function isGeofenceActive(): boolean {
  return watchId !== null;
}
