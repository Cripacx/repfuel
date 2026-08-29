import type {
  FoodDto,
  ListMealsQuery,
  MealDto,
  NutritionDayDto,
  NutritionStatsQuery,
  NutritionStatsResponse,
  NutritionTargets,
  UpsertMealRequest,
} from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { FoodRepo } from '../repositories/food-repo.js';
import type { MealRepo } from '../repositories/meal-repo.js';
import type { FoodRow, MealRow } from '../schema.js';
import { toFoodDto } from './food-service.js';

const round1 = (n: number) => Math.round(n * 10) / 10;

export function toMealDto(row: MealRow, food: FoodRow | undefined): MealDto {
  const factor = food && row.amountG != null ? row.amountG / 100 : 0;
  const kcal = row.quickKcal != null ? row.quickKcal : food ? food.kcalPer100 * factor : 0;
  return {
    id: row.id,
    eatenAt: row.eatenAt.toISOString(),
    mealType: row.mealType,
    foodId: row.foodId,
    amountG: row.amountG,
    quickKcal: row.quickKcal,
    food: food ? toFoodDto(food) : null,
    kcal: round1(kcal),
    proteinG: round1(food ? food.proteinPer100 * factor : 0),
    carbsG: round1(food ? food.carbsPer100 * factor : 0),
    fatG: round1(food ? food.fatPer100 * factor : 0),
  };
}

/** Provider für kcal-/Makro-Ziele (Auth-Modul / Profil). */
export type TargetsProvider = (userId: string) => Promise<NutritionTargets>;

export type MealService = ReturnType<typeof createMealService>;

export function createMealService(deps: {
  mealRepo: MealRepo;
  foodRepo: FoodRepo;
  getTargets: TargetsProvider;
}) {
  const { mealRepo, foodRepo, getTargets } = deps;

  async function assembleDtos(userId: string, rows: MealRow[]): Promise<MealDto[]> {
    const foodIds = [...new Set(rows.map((m) => m.foodId).filter((id): id is string => !!id))];
    const foodRows = await foodRepo.findVisibleByIds(userId, foodIds);
    const byId = new Map(foodRows.map((f) => [f.id, f]));
    return rows.map((m) => toMealDto(m, m.foodId ? byId.get(m.foodId) : undefined));
  }

  return {
    async upsert(userId: string, id: string, input: UpsertMealRequest): Promise<MealDto> {
      const existing = await mealRepo.findByIdAnyUser(id);
      if (existing && existing.userId !== userId) {
        throw new AppError('conflict', 'Meal id already exists');
      }
      if (input.foodId) {
        const food = await foodRepo.findVisibleById(userId, input.foodId);
        if (!food) throw new AppError('not_found', 'Food not found');
      }
      const row = await mealRepo.upsert({
        id,
        userId,
        eatenAt: new Date(input.eatenAt),
        mealType: input.mealType,
        foodId: input.foodId ?? null,
        amountG: input.amountG ?? null,
        quickKcal: input.quickKcal ?? null,
      });
      const [dto] = await assembleDtos(userId, [row]);
      return dto!;
    },

    async list(userId: string, query: ListMealsQuery): Promise<MealDto[]> {
      const rows = await mealRepo.list(userId, {
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        limit: query.limit,
      });
      return assembleDtos(userId, rows);
    },

    async remove(userId: string, id: string): Promise<void> {
      const row = await mealRepo.softDelete(userId, id);
      if (!row) throw new AppError('not_found', 'Meal not found');
    },

    /** Zuletzt geloggte Lebensmittel (distinct, jüngstes zuerst) — die
     * Vorschlagsliste des Logging-Dialogs. */
    async recentFoods(userId: string, limit: number): Promise<FoodDto[]> {
      const ids = await mealRepo.recentFoodIds(userId, limit);
      if (ids.length === 0) return [];
      const rows = await foodRepo.findVisibleByIds(userId, ids);
      const byId = new Map(rows.map((f) => [f.id, f]));
      return ids
        .map((id) => byId.get(id))
        .filter((row): row is FoodRow => row !== undefined)
        .map(toFoodDto);
    },

    /** Tagessummen (lokale Tage über tzOffsetMinutes) + Ziele aus dem Profil. */
    async stats(userId: string, query: NutritionStatsQuery): Promise<NutritionStatsResponse> {
      const offsetMs = query.tzOffsetMinutes * 60_000;
      const fromUtc = new Date(Date.parse(`${query.from}T00:00:00Z`) - offsetMs);
      const toUtc = new Date(Date.parse(`${query.to}T00:00:00Z`) - offsetMs + 86_400_000 - 1);
      if (Number.isNaN(fromUtc.getTime()) || toUtc.getTime() < fromUtc.getTime()) {
        throw new AppError('bad_request', 'Invalid date range');
      }
      const meals = await this.list(userId, {
        from: fromUtc.toISOString(),
        to: toUtc.toISOString(),
        limit: 1000,
      });
      const byDay = new Map<string, NutritionDayDto>();
      for (const meal of meals) {
        const localDay = new Date(Date.parse(meal.eatenAt) + offsetMs).toISOString().slice(0, 10);
        let day = byDay.get(localDay);
        if (!day) {
          day = { date: localDay, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, mealCount: 0 };
          byDay.set(localDay, day);
        }
        day.kcal = round1(day.kcal + meal.kcal);
        day.proteinG = round1(day.proteinG + meal.proteinG);
        day.carbsG = round1(day.carbsG + meal.carbsG);
        day.fatG = round1(day.fatG + meal.fatG);
        day.mealCount += 1;
      }
      return {
        days: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
        targets: await getTargets(userId),
      };
    },
  };
}
