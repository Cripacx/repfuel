import { index, numeric, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../auth/schema.js';

export const bodyWeight = pgTable(
  'body_weight',
  {
    /** Client-generierte UUID (Offline-Sync: Upsert per UUID). */
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
    weightKg: numeric('weight_kg', { precision: 5, scale: 2, mode: 'number' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('body_weight_user_id_idx').on(t.userId)],
);

export type BodyWeightRow = typeof bodyWeight.$inferSelect;
