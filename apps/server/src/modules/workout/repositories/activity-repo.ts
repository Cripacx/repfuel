import { and, desc, eq, gte, isNull, lte, type SQL } from 'drizzle-orm';
import type { ActivityType } from '@repfuel/shared';
import type { Database } from '../../../core/db.js';
import { activities, type ActivityRow } from '../schema.js';

export interface ActivityUpsert {
  id: string;
  userId: string;
  activityType: ActivityType;
  startedAt: Date;
  durationMin: number;
  kcal: number | null;
  notes: string | null;
}

export interface ActivityRepo {
  findByIdAnyUser(id: string): Promise<ActivityRow | null>;
  list(userId: string, filter: { from?: Date; to?: Date; limit: number }): Promise<ActivityRow[]>;
  upsert(input: ActivityUpsert): Promise<ActivityRow>;
  softDelete(userId: string, id: string): Promise<ActivityRow | null>;
}

export function createActivityRepo(db: Database): ActivityRepo {
  return {
    async findByIdAnyUser(id) {
      const rows = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
      return rows[0] ?? null;
    },
    async list(userId, filter) {
      const conditions: (SQL | undefined)[] = [
        eq(activities.userId, userId),
        isNull(activities.deletedAt),
      ];
      if (filter.from) conditions.push(gte(activities.startedAt, filter.from));
      if (filter.to) conditions.push(lte(activities.startedAt, filter.to));
      return db
        .select()
        .from(activities)
        .where(and(...conditions))
        .orderBy(desc(activities.startedAt))
        .limit(filter.limit);
    },
    async upsert(input) {
      const rows = await db
        .insert(activities)
        .values(input)
        .onConflictDoUpdate({
          target: activities.id,
          set: {
            activityType: input.activityType,
            startedAt: input.startedAt,
            durationMin: input.durationMin,
            kcal: input.kcal,
            notes: input.notes,
            deletedAt: null,
          },
        })
        .returning();
      if (!rows[0]) throw new Error('upsert activities returned no row');
      return rows[0];
    },
    async softDelete(userId, id) {
      const rows = await db
        .update(activities)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(activities.id, id), eq(activities.userId, userId), isNull(activities.deletedAt)),
        )
        .returning();
      return rows[0] ?? null;
    },
  };
}
