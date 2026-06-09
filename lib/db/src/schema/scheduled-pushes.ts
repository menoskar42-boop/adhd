import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A push the server must deliver at `fireAt`. Persisted so a server
// restart never loses a pending timer-end or reminder — the scheduler
// re-reads pending rows from here on boot.
//
// `tag` + `clientId` together identify a logical reminder so the client
// can cancel/replace it (e.g. user stops the focus timer before it ends).
// `status` walks pending -> sent | failed | cancelled.
export const scheduledPushesTable = pgTable(
  "scheduled_pushes",
  {
    id: serial("id").primaryKey(),
    clientId: text("client_id").notNull(),
    tag: text("tag").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url").notNull().default("/"),
    fireAt: timestamp("fire_at").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("scheduled_pushes_due_idx").on(table.status, table.fireAt),
    index("scheduled_pushes_client_tag_idx").on(table.clientId, table.tag),
  ],
);

export const insertScheduledPushSchema = createInsertSchema(
  scheduledPushesTable,
).omit({ id: true, status: true, attempts: true, sentAt: true, createdAt: true });
export type InsertScheduledPush = z.infer<typeof insertScheduledPushSchema>;
export type ScheduledPush = typeof scheduledPushesTable.$inferSelect;
