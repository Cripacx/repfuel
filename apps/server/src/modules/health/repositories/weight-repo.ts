import { and, desc, eq, gte, isNull, lte, type SQL } from 'drizzle-orm';
import type { Database } from '../../../core/db.js';
import { bodyWeight, type BodyWeightRow } from '../schema.js';

export interface WeightUpsert {
  id: string;
  userId: string;
  measuredAt: Date;
  weightKg: number;
}

export interface WeightRepo {
  findByIdAnyUser(id: string): Promise<BodyWeightRow | null>;
  list(userId: string, filter: { from?: Date; to?: Date; limit: number }): Promise<BodyWeightRow[]>;
  upsert(input: WeightUpsert): Promise<BodyWeightRow>;
  softDelete(userId: string, id: string): Promise<BodyWeightRow | null>;
}

export function createWeightRepo(db: Database): WeightRepo {
  return {
    async findByIdAnyUser(id) {
      const rows = await db.select().from(bodyWeight).where(eq(bodyWeight.id, id)).limit(1);
      return rows[0] ?? null;
    },
    async list(userId, filter) {
      const conditions: (SQL | undefined)[] = [
        eq(bodyWeight.userId, userId),
        isNull(bodyWeight.deletedAt),
      ];
      if (filter.from) conditions.push(gte(bodyWeight.measuredAt, filter.from));
      if (filter.to) conditions.push(lte(bodyWeight.measuredAt, filter.to));
      return db
        .select()
        .from(bodyWeight)
        .where(and(...conditions))
        .orderBy(desc(bodyWeight.measuredAt))
        .limit(filter.limit);
    },
    async upsert(input) {
      const rows = await db
        .insert(bodyWeight)
        .values({ ...input, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: bodyWeight.id,
          set: {
            measuredAt: input.measuredAt,
            weightKg: input.weightKg,
            deletedAt: null,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!rows[0]) throw new Error('upsert body_weight returned no row');
      return rows[0];
    },
    async softDelete(userId, id) {
      const rows = await db
        .update(bodyWeight)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(eq(bodyWeight.id, id), eq(bodyWeight.userId, userId), isNull(bodyWeight.deletedAt)),
        )
        .returning();
      return rows[0] ?? null;
    },
  };
}
