// Web Push client. Subscribes the browser to the api-server's push
// service and schedules/cancels server-side pushes so notifications fire
// even when the tab is closed (the whole point — an ADHD timer can't rely
// on the page staying foregrounded).
//
// The api-server lives at VITE_API_BASE_URL (set when it's a different
// origin from the web app); defaults to same-origin "/api".

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const CLIENT_ID_KEY = "neuropilot-client-id";

function apiUrl(path: string): string {
  return `${API_BASE}/api${path}`;
}

// Stable per-browser id used to scope subscriptions and scheduled pushes
// server-side (the app has no auth/accounts).
export function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// VAPID public keys are base64url; PushManager wants a Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

// Requests notification permission (must be called from a user gesture)
// and registers a push subscription with the server. Returns true once
// the browser is subscribed and the server has stored it. Safe to call
// repeatedly — re-subscribing is idempotent server-side.
export async function enablePush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;

    const keyRes = await fetch(apiUrl("/push/vapid-public-key"));
    if (!keyRes.ok) return false;
    const { publicKey } = (await keyRes.json()) as { publicKey: string };
    if (!publicKey) return false;

    const existing = await reg.pushManager.getSubscription();
    const subscription =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    const json = subscription.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    const res = await fetch(apiUrl("/push/subscribe"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: getClientId(),
        subscription: {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface SchedulePushInput {
  tag: string;
  title: string;
  body: string;
  url?: string;
  fireAt: Date;
}

export async function schedulePush(input: SchedulePushInput): Promise<boolean> {
  try {
    const res = await fetch(apiUrl("/push/schedule"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: getClientId(),
        tag: input.tag,
        title: input.title,
        body: input.body,
        url: input.url ?? "/",
        fireAt: input.fireAt.toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function cancelPush(tag: string): Promise<void> {
  try {
    await fetch(apiUrl("/push/cancel"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: getClientId(), tag }),
    });
  } catch {
    // Best-effort — a missed cancel just means a stray notification at
    // worst, and the server only sends to live subscriptions.
  }
}

// --- Focus-session orchestration -----------------------------------------
// One logical "session" maps to a fixed set of tagged pushes: the end
// alert plus the tiered mid-session reminders. Re-scheduling replaces them
// (server dedupes by tag); cancelling clears the whole set when the timer
// pauses/stops.

const SESSION_END_TAG = "session-end";
const SESSION_REMINDER_TAGS = ["session-r0", "session-r1", "session-r2"];
const SESSION_TAGS = [SESSION_END_TAG, ...SESSION_REMINDER_TAGS];

export interface SessionPushInput {
  title: string;
  totalSeconds: number;
  endBody: string;
  // Mid-session nudges, each at offsetSec from now.
  reminders: { offsetSec: number; message: string }[];
}

export async function scheduleSessionPushes(
  input: SessionPushInput,
): Promise<void> {
  const now = Date.now();

  const jobs: Promise<unknown>[] = [
    schedulePush({
      tag: SESSION_END_TAG,
      title: input.title,
      body: input.endBody,
      fireAt: new Date(now + input.totalSeconds * 1000),
    }),
  ];

  input.reminders.forEach((r, idx) => {
    // Skip reminders that would land at or after the session ends.
    if (r.offsetSec >= input.totalSeconds) return;
    const tag = SESSION_REMINDER_TAGS[idx];
    if (!tag) return;
    jobs.push(
      schedulePush({
        tag,
        title: input.title,
        body: r.message,
        fireAt: new Date(now + r.offsetSec * 1000),
      }),
    );
  });

  await Promise.all(jobs);
}

export async function cancelSessionPushes(): Promise<void> {
  await Promise.all(SESSION_TAGS.map(cancelPush));
}
