import webpush from "web-push";
import { logger } from "./logger";

// VAPID identifies our server to push services. Keys are provided via env
// (generate once with `npx web-push generate-vapid-keys`). Push is simply
// disabled — not fatal — when they're absent, so the rest of the API and
// local dev keep working without secrets configured.

const publicKey = process.env["VAPID_PUBLIC_KEY"] ?? "";
const privateKey = process.env["VAPID_PRIVATE_KEY"] ?? "";
// Push services require a contact (mailto: or https:) in the VAPID subject.
const subject = process.env["VAPID_SUBJECT"] ?? "mailto:menoskar42@gmail.com";

export const pushEnabled = Boolean(publicKey && privateKey);
export const vapidPublicKey = publicKey;

if (pushEnabled) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  logger.info("Web Push configured");
} else {
  logger.warn(
    "Web Push disabled: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to enable",
  );
}

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface SendResult {
  ok: boolean;
  // True when the push service reports the subscription is gone (404/410)
  // and the caller should delete it.
  gone: boolean;
}

export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<SendResult> {
  if (!pushEnabled) return { ok: false, gone: false };

  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: target.keys },
      JSON.stringify(payload),
    );
    return { ok: true, gone: false };
  } catch (err) {
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    const gone = statusCode === 404 || statusCode === 410;
    if (!gone) {
      logger.error({ err, endpoint: target.endpoint }, "Push send failed");
    }
    return { ok: false, gone };
  }
}
