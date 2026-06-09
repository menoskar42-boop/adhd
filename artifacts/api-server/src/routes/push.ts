import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  pushSubscriptionsTable,
  scheduledPushesTable,
} from "@workspace/db";
import {
  SubscribePushBody,
  UnsubscribePushBody,
  SchedulePushBody,
  CancelScheduledPushBody,
} from "@workspace/api-zod";
import { pushEnabled, vapidPublicKey } from "../lib/web-push";

const router: IRouter = Router();

router.get("/push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

router.post("/push/subscribe", async (req, res) => {
  const parsed = SubscribePushBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid subscription" });
    return;
  }
  const { clientId, subscription } = parsed.data;

  // Upsert on endpoint: the same browser re-subscribing keeps one row but
  // may move to a different clientId / refreshed keys.
  await db
    .insert(pushSubscriptionsTable)
    .values({
      clientId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: {
        clientId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updatedAt: new Date(),
      },
    });

  res.json({ ok: true });
});

router.post("/push/unsubscribe", async (req, res) => {
  const parsed = UnsubscribePushBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  await db
    .delete(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, parsed.data.endpoint));

  res.json({ ok: true });
});

router.post("/push/schedule", async (req, res) => {
  if (!pushEnabled) {
    res.status(503).json({ error: "Push not configured" });
    return;
  }
  const parsed = SchedulePushBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid schedule request" });
    return;
  }
  const { clientId, tag, title, body, url, fireAt } = parsed.data;

  // Replace any existing pending push for this logical reminder so a
  // re-scheduled timer doesn't fire twice.
  await db
    .update(scheduledPushesTable)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(scheduledPushesTable.clientId, clientId),
        eq(scheduledPushesTable.tag, tag),
        eq(scheduledPushesTable.status, "pending"),
      ),
    );

  const [row] = await db
    .insert(scheduledPushesTable)
    .values({
      clientId,
      tag,
      title,
      body,
      url: url ?? "/",
      fireAt,
    })
    .returning({ id: scheduledPushesTable.id });

  res.json({ id: row.id });
});

router.post("/push/cancel", async (req, res) => {
  const parsed = CancelScheduledPushBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { clientId, tag } = parsed.data;

  const cancelled = await db
    .update(scheduledPushesTable)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(scheduledPushesTable.clientId, clientId),
        eq(scheduledPushesTable.tag, tag),
        eq(scheduledPushesTable.status, "pending"),
      ),
    )
    .returning({ id: scheduledPushesTable.id });

  res.json({ cancelled: cancelled.length });
});

export default router;
