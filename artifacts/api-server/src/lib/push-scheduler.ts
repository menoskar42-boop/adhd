import { and, eq, lte, sql } from "drizzle-orm";
import {
  db,
  scheduledPushesTable,
  pushSubscriptionsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { pushEnabled, sendPush } from "./web-push";

const POLL_INTERVAL_MS = 15_000;
// Give up after this many delivery attempts so a permanently broken push
// service endpoint can't be retried forever.
const MAX_ATTEMPTS = 5;

let timer: NodeJS.Timeout | null = null;
let ticking = false;

async function deliverDuePushes(): Promise<void> {
  // Atomically claim due rows by flipping pending -> sending and returning
  // them. Two server instances can't grab the same row, so no double-send.
  const claimed = await db
    .update(scheduledPushesTable)
    .set({ status: "sending" })
    .where(
      and(
        eq(scheduledPushesTable.status, "pending"),
        lte(scheduledPushesTable.fireAt, sql`now()`),
      ),
    )
    .returning();

  if (claimed.length === 0) return;

  for (const push of claimed) {
    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.clientId, push.clientId));

    let anyOk = false;
    for (const sub of subs) {
      const result = await sendPush(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        { title: push.title, body: push.body, url: push.url, tag: push.tag },
      );
      if (result.ok) anyOk = true;
      if (result.gone) {
        // Subscription expired/unsubscribed — prune it.
        await db
          .delete(pushSubscriptionsTable)
          .where(eq(pushSubscriptionsTable.id, sub.id));
      }
    }

    if (anyOk) {
      await db
        .update(scheduledPushesTable)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(scheduledPushesTable.id, push.id));
    } else {
      // No subscription, or every send failed. Retry until the cap, then
      // mark failed so it stops being claimed.
      const attempts = push.attempts + 1;
      const exhausted = attempts >= MAX_ATTEMPTS || subs.length === 0;
      await db
        .update(scheduledPushesTable)
        .set({ status: exhausted ? "failed" : "pending", attempts })
        .where(eq(scheduledPushesTable.id, push.id));
    }
  }

  logger.info({ count: claimed.length }, "Processed due pushes");
}

async function tick(): Promise<void> {
  if (ticking) return; // Skip if the previous tick is still running.
  ticking = true;
  try {
    await deliverDuePushes();
  } catch (err) {
    logger.error({ err }, "Push scheduler tick failed");
  } finally {
    ticking = false;
  }
}

export function startPushScheduler(): void {
  if (timer) return;
  if (!pushEnabled) {
    logger.warn("Push scheduler not started (Web Push disabled)");
    return;
  }

  // Recover any rows left in 'sending' by a previous crash mid-tick.
  db.update(scheduledPushesTable)
    .set({ status: "pending" })
    .where(eq(scheduledPushesTable.status, "sending"))
    .catch((err) => logger.error({ err }, "Failed to recover stuck pushes"));

  timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
  // Don't let the poll loop keep the process alive on its own.
  timer.unref?.();
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "Push scheduler started");

  void tick();
}
