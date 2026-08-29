import { randomUUID } from 'node:crypto';
import type { FoodRepo } from '../repositories/food-repo.js';
import type { MealRepo, MealUpsert } from '../repositories/meal-repo.js';
import type { FoodRow, MealRow } from '../schema.js';
import type { OffClient, OffProduct } from '../services/off-client.js';

export function makeFood(overrides: Partial<FoodRow> = {}): FoodRow {
  return {
    id: randomUUID(),
    source: 'custom',
    offBarcode: null,
    name: 'Oats',
    brand: null,
    kcalPer100: 372,
    proteinPer100: 13.5,
    carbsPer100: 58.7,
    fatPer100: 7,
    userId: null,
    createdAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

export function fakeFoodRepo(seed: FoodRow[] = []): FoodRepo & { rows: FoodRow[] } {
  const rows = [...seed];
  const visible = (userId: string) =>
    rows.filter((r) => !r.deletedAt && (r.userId === null || r.userId === userId));
  return {
    rows,
    async searchVisible(userId, q, limit) {
      const needle = q.toLowerCase();
      return visible(userId)
        .filter(
          (r) =>
            r.name.toLowerCase().includes(needle) ||
            (r.brand ?? '').toLowerCase().includes(needle),
        )
        .slice(0, limit);
    },
    async findVisibleById(userId, id) {
      return visible(userId).find((r) => r.id === id) ?? null;
    },
    async findVisibleByIds(userId, ids) {
      return visible(userId).filter((r) => ids.includes(r.id));
    },
    async findByBarcode(barcode) {
      return rows.find((r) => r.offBarcode === barcode && !r.deletedAt) ?? null;
    },
    async upsertOffFood(input) {
      const existing = rows.find((r) => r.offBarcode === input.barcode);
      if (existing) {
        Object.assign(existing, {
          name: input.name,
          brand: input.brand,
          kcalPer100: input.kcalPer100,
          proteinPer100: input.proteinPer100,
          carbsPer100: input.carbsPer100,
          fatPer100: input.fatPer100,
          deletedAt: null,
        });
        return existing;
      }
      const row = makeFood({
        source: 'off',
        offBarcode: input.barcode,
        name: input.name,
        brand: input.brand,
        kcalPer100: input.kcalPer100,
        proteinPer100: input.proteinPer100,
        carbsPer100: input.carbsPer100,
        fatPer100: input.fatPer100,
      });
      rows.push(row);
      return row;
    },
    async createCustom(input) {
      const row = makeFood({ ...input, source: 'custom', offBarcode: null });
      rows.push(row);
      return row;
    },
  };
}

export function fakeMealRepo(): MealRepo & { rows: MealRow[] } {
  const rows: MealRow[] = [];
  return {
    rows,
    async findByIdAnyUser(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async list(userId, filter) {
      let out = rows.filter((r) => r.userId === userId && !r.deletedAt);
      if (filter.from) out = out.filter((r) => r.eatenAt >= filter.from!);
      if (filter.to) out = out.filter((r) => r.eatenAt <= filter.to!);
      return out.sort((a, b) => b.eatenAt.getTime() - a.eatenAt.getTime()).slice(0, filter.limit);
    },
    async upsert(input: MealUpsert) {
      const existing = rows.find((r) => r.id === input.id);
      if (existing) {
        Object.assign(existing, input, { deletedAt: null, updatedAt: new Date() });
        return existing;
      }
      const row: MealRow = { ...input, updatedAt: new Date(), deletedAt: null };
      rows.push(row);
      return row;
    },
    async softDelete(userId, id) {
      const row = rows.find((r) => r.id === id && r.userId === userId && !r.deletedAt) ?? null;
      if (row) row.deletedAt = new Date();
      return row;
    },
    async recentFoodIds(userId, limit) {
      const lastEaten = new Map<string, number>();
      for (const r of rows) {
        if (r.userId !== userId || r.deletedAt || !r.foodId) continue;
        const prev = lastEaten.get(r.foodId) ?? 0;
        if (r.eatenAt.getTime() > prev) lastEaten.set(r.foodId, r.eatenAt.getTime());
      }
      return [...lastEaten.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([foodId]) => foodId);
    },
  };
}

export function fakeOffClient(products: OffProduct[] = []): OffClient {
  return {
    async search(query, limit) {
      const needle = query.toLowerCase();
      return products.filter((p) => p.name.toLowerCase().includes(needle)).slice(0, limit);
    },
    async byBarcode(code) {
      return products.find((p) => p.barcode === code) ?? null;
    },
  };
}
