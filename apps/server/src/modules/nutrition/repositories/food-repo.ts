import { and, asc, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import type { Database } from '../../../core/db.js';
import { foods, type FoodRow } from '../schema.js';

export interface FoodRepo {
  searchVisible(userId: string, q: string, limit: number): Promise<FoodRow[]>;
  findVisibleById(userId: string, id: string): Promise<FoodRow | null>;
  findVisibleByIds(userId: string, ids: string[]): Promise<FoodRow[]>;
  findByBarcode(barcode: string): Promise<FoodRow | null>;
  upsertOffFood(input: {
    barcode: string;
    name: string;
    brand: string | null;
    kcalPer100: number;
    proteinPer100: number;
    carbsPer100: number;
    fatPer100: number;
  }): Promise<FoodRow>;
  createCustom(input: {
    userId: string;
    name: string;
    brand: string | null;
    kcalPer100: number;
    proteinPer100: number;
    carbsPer100: number;
    fatPer100: number;
  }): Promise<FoodRow>;
}

const visibleTo = (userId: string) =>
  and(isNull(foods.deletedAt), or(isNull(foods.userId), eq(foods.userId, userId)));

export function createFoodRepo(db: Database): FoodRepo {
  return {
    async searchVisible(userId, q, limit) {
      const pattern = `%${q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
      return db
        .select()
        .from(foods)
        .where(
          and(visibleTo(userId), or(ilike(foods.name, pattern), ilike(foods.brand, pattern))),
        )
        .orderBy(asc(foods.name))
        .limit(limit);
    },
    async findVisibleById(userId, id) {
      const rows = await db
        .select()
        .from(foods)
        .where(and(eq(foods.id, id), visibleTo(userId)))
        .limit(1);
      return rows[0] ?? null;
    },
    async findVisibleByIds(userId, ids) {
      if (ids.length === 0) return [];
      return db
        .select()
        .from(foods)
        .where(and(inArray(foods.id, ids), visibleTo(userId)));
    },
    async findByBarcode(barcode) {
      const rows = await db
        .select()
        .from(foods)
        .where(and(eq(foods.offBarcode, barcode), isNull(foods.deletedAt)))
        .limit(1);
      return rows[0] ?? null;
    },
    async upsertOffFood(input) {
      const rows = await db
        .insert(foods)
        .values({
          source: 'off',
          offBarcode: input.barcode,
          name: input.name,
          brand: input.brand,
          kcalPer100: input.kcalPer100,
          proteinPer100: input.proteinPer100,
          carbsPer100: input.carbsPer100,
          fatPer100: input.fatPer100,
          userId: null,
        })
        .onConflictDoUpdate({
          target: foods.offBarcode,
          set: {
            name: input.name,
            brand: input.brand,
            kcalPer100: input.kcalPer100,
            proteinPer100: input.proteinPer100,
            carbsPer100: input.carbsPer100,
            fatPer100: input.fatPer100,
            deletedAt: null,
          },
        })
        .returning();
      if (!rows[0]) throw new Error('upsert foods returned no row');
      return rows[0];
    },
    async createCustom(input) {
      const rows = await db
        .insert(foods)
        .values({ ...input, source: 'custom', offBarcode: null })
        .returning();
      if (!rows[0]) throw new Error('insert foods returned no row');
      return rows[0];
    },
  };
}
