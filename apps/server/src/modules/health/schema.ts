import {
  doublePrecision,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
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

export const healthMetrics = pgTable(
  'health_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    metric: text('metric').notNull(),
    value: doublePrecision('value').notNull(),
    measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
    source: text('source').notNull(),
  },
  (t) => [
    index('health_metrics_user_id_idx').on(t.userId),
    // Idempotenter Ingest: gleicher Messpunkt überschreibt statt zu duplizieren.
    uniqueIndex('health_metrics_unique_point').on(t.userId, t.metric, t.measuredAt, t.source),
  ],
);

/** Pro-User-API-Tokens für den Health-Ingest (Bearer, Hash-Speicherung). */
export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('api_tokens_user_id_idx').on(t.userId)],
);

export type HealthMetricRow = typeof healthMetrics.$inferSelect;
export type ApiTokenRow = typeof apiTokens.$inferSelect;
