import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per browser/device push endpoint. The same person on phone +
// laptop yields two rows. `clientId` is a stable id the web app generates
// and stores in localStorage so we can scope scheduled pushes to a user
// without an auth system. `endpoint` is the push service URL and is the
// natural unique key — re-subscribing with the same browser returns the
// same endpoint, so we upsert on it.
export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    clientId: text("client_id").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("push_subscriptions_client_id_idx").on(table.clientId)],
);

export const insertPushSubscriptionSchema = createInsertSchema(
  pushSubscriptionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
