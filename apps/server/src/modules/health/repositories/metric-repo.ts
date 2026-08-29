import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import type { Database } from '../../../core/db.js';
import { healthMetrics, type HealthMetricRow } from '../schema.js';

export interface MetricUpsert {
  userId: string;
  metric: string;
  value: number;
  measuredAt: Date;
  source: string;
}

export interface MetricRepo {
  upsertMany(entries: MetricUpsert[]): Promise<number>;
  list(input: {
    userId: string;
    metric: string;
    from?: Date;
    to?: Date;
    limit: number;
  }): Promise<HealthMetricRow[]>;
  listAll(userId: string): Promise<HealthMetricRow[]>;
}

export function createMetricRepo(db: Database): MetricRepo {
  return {
    async upsertMany(entries) {
      if (entries.length === 0) return 0;
      const rows = await db
        .insert(healthMetrics)
        .values(entries)
        .onConflictDoUpdate({
          target: [
            healthMetrics.userId,
            healthMetrics.metric,
            healthMetrics.measuredAt,
            healthMetrics.source,
          ],
          set: { value: sql`excluded.value` },
        })
        .returning({ id: healthMetrics.id });
      return rows.length;
    },
    async list({ userId, metric, from, to, limit }) {
      const conditions = [eq(healthMetrics.userId, userId), eq(healthMetrics.metric, metric)];
      if (from) conditions.push(gte(healthMetrics.measuredAt, from));
      if (to) conditions.push(lte(healthMetrics.measuredAt, to));
      return db
        .select()
        .from(healthMetrics)
        .where(and(...conditions))
        .orderBy(asc(healthMetrics.measuredAt))
        .limit(limit);
    },
    async listAll(userId) {
      return db
        .select()
        .from(healthMetrics)
        .where(eq(healthMetrics.userId, userId))
        .orderBy(asc(healthMetrics.measuredAt));
    },
  };
}
