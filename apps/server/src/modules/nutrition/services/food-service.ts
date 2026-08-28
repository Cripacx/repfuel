import type { CreateFoodRequest, FoodDto } from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { FoodRepo } from '../repositories/food-repo.js';
import type { FoodRow } from '../schema.js';
import type { OffClient } from './off-client.js';

export function toFoodDto(row: FoodRow): FoodDto {
  return {
    id: row.id,
    source: row.source,
    offBarcode: row.offBarcode,
    name: row.name,
    brand: row.brand,
    kcalPer100: row.kcalPer100,
    proteinPer100: row.proteinPer100,
    carbsPer100: row.carbsPer100,
    fatPer100: row.fatPer100,
    userId: row.userId,
  };
}

export type FoodService = ReturnType<typeof createFoodService>;

export function createFoodService(deps: { foodRepo: FoodRepo; offClient: OffClient }) {
  const { foodRepo, offClient } = deps;

  return {
    /**
     * Erst lokale foods (eigene + Cache), dann Open Food Facts.
     * OFF-Treffer werden in `foods` gecacht, damit Mahlzeiten sofort
     * eine food_id referenzieren können.
     */
    async search(userId: string, q: string, limit: number): Promise<FoodDto[]> {
      const local = await foodRepo.searchVisible(userId, q, limit);
      const results = local.map(toFoodDto);
      if (results.length >= limit) return results.slice(0, limit);

      const external = await offClient.search(q, limit);
      const knownBarcodes = new Set(results.map((f) => f.offBarcode).filter(Boolean));
      for (const product of external) {
        if (results.length >= limit) break;
        if (knownBarcodes.has(product.barcode)) continue;
        const row = await foodRepo.upsertOffFood(product);
        results.push(toFoodDto(row));
        knownBarcodes.add(product.barcode);
      }
      return results;
    },

    /** Lokaler Cache zuerst, sonst OFF-Lookup + Cache. */
    async byBarcode(code: string): Promise<FoodDto> {
      const cached = await foodRepo.findByBarcode(code);
      if (cached) return toFoodDto(cached);
      const product = await offClient.byBarcode(code);
      if (!product) throw new AppError('not_found', 'No product found for this barcode');
      const row = await foodRepo.upsertOffFood(product);
      return toFoodDto(row);
    },

    async createCustom(userId: string, input: CreateFoodRequest): Promise<FoodDto> {
      const row = await foodRepo.createCustom({
        userId,
        name: input.name,
        brand: input.brand ?? null,
        kcalPer100: input.kcalPer100,
        proteinPer100: input.proteinPer100,
        carbsPer100: input.carbsPer100,
        fatPer100: input.fatPer100,
      });
      return toFoodDto(row);
    },
  };
}
