import { and, desc, eq, gte, isNotNull, isNull, lte, max, type SQL } from 'drizzle-orm';
import type { MealType } from '@repfuel/shared';
import type { Database } from '../../../core/db.js';
import { meals, type MealRow } from '../schema.js';

export interface MealUpsert {
  id: string;
  userId: string;
  eatenAt: Date;
  mealType: MealType;
  foodId: string | null;
  amountG: number | null;
  quickKcal: number | null;
}

export interface MealRepo {
  findByIdAnyUser(id: string): Promise<MealRow | null>;
  list(userId: string, filter: { from?: Date; to?: Date; limit: number }): Promise<MealRow[]>;
  upsert(input: MealUpsert): Promise<MealRow>;
  softDelete(userId: string, id: string): Promise<MealRow | null>;
  /** Zuletzt geloggte Lebensmittel des Nutzers (distinct, jüngstes zuerst). */
  recentFoodIds(userId: string, limit: number): Promise<string[]>;
}

export function createMealRepo(db: Database): MealRepo {
  return {
    async findByIdAnyUser(id) {
      const rows = await db.select().from(meals).where(eq(meals.id, id)).limit(1);
      return rows[0] ?? null;
    },
    async list(userId, filter) {
      const conditions: (SQL | undefined)[] = [eq(meals.userId, userId), isNull(meals.deletedAt)];
      if (filter.from) conditions.push(gte(meals.eatenAt, filter.from));
      if (filter.to) conditions.push(lte(meals.eatenAt, filter.to));
      return db
        .select()
        .from(meals)
        .where(and(...conditions))
        .orderBy(desc(meals.eatenAt))
        .limit(filter.limit);
    },
    async upsert(input) {
      const rows = await db
        .insert(meals)
        .values({ ...input, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: meals.id,
          set: {
            eatenAt: input.eatenAt,
            mealType: input.mealType,
            foodId: input.foodId,
            amountG: input.amountG,
            quickKcal: input.quickKcal,
            deletedAt: null,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!rows[0]) throw new Error('upsert meals returned no row');
      return rows[0];
    },
    async softDelete(userId, id) {
      const rows = await db
        .update(meals)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(meals.id, id), eq(meals.userId, userId), isNull(meals.deletedAt)))
        .returning();
      return rows[0] ?? null;
    },
    async recentFoodIds(userId, limit) {
      const rows = await db
        .select({ foodId: meals.foodId, lastEatenAt: max(meals.eatenAt) })
        .from(meals)
        .where(and(eq(meals.userId, userId), isNull(meals.deletedAt), isNotNull(meals.foodId)))
        .groupBy(meals.foodId)
        .orderBy(desc(max(meals.eatenAt)))
        .limit(limit);
      return rows.map((r) => r.foodId).filter((id): id is string => id !== null);
    },
  };
}
