import { describe, expect, it } from 'vitest';
import type { MealDto } from '@repfuel/shared';
import { groupMealsByType, sumNutrition, suggestMealType } from './meal-grouping.js';

function meal(
  id: string,
  mealType: MealDto['mealType'],
  eatenAt: string,
  overrides: Partial<MealDto> = {},
): MealDto {
  return {
    id,
    eatenAt,
    mealType,
    foodId: null,
    amountG: null,
    quickKcal: 300,
    food: null,
    kcal: 300,
    proteinG: 10,
    carbsG: 20,
    fatG: 5,
    ...overrides,
  };
}

describe('groupMealsByType', () => {
  it('creates every meal type key, even when empty', () => {
    const grouped = groupMealsByType([]);
    expect(Object.keys(grouped).sort()).toEqual(['breakfast', 'dinner', 'lunch', 'snack']);
    expect(grouped.breakfast).toEqual([]);
  });

  it('buckets meals by their mealType', () => {
    const meals = [
      meal('a', 'lunch', '2026-08-27T12:00:00Z'),
      meal('b', 'breakfast', '2026-08-27T07:00:00Z'),
      meal('c', 'lunch', '2026-08-27T13:00:00Z'),
    ];
    const grouped = groupMealsByType(meals);
    expect(grouped.lunch.map((m) => m.id)).toEqual(['a', 'c']);
    expect(grouped.breakfast.map((m) => m.id)).toEqual(['b']);
    expect(grouped.dinner).toEqual([]);
    expect(grouped.snack).toEqual([]);
  });

  it('sorts each group ascending by eatenAt regardless of input order', () => {
    const meals = [
      meal('late', 'dinner', '2026-08-27T20:00:00Z'),
      meal('early', 'dinner', '2026-08-27T18:00:00Z'),
    ];
    const grouped = groupMealsByType(meals);
    expect(grouped.dinner.map((m) => m.id)).toEqual(['early', 'late']);
  });
});

describe('suggestMealType', () => {
  const at = (h: number, min = 0) => new Date(2026, 7, 28, h, min);

  it('maps daytimes to the likely meal type', () => {
    expect(suggestMealType(at(7))).toBe('breakfast');
    expect(suggestMealType(at(10, 29))).toBe('breakfast');
    expect(suggestMealType(at(12))).toBe('lunch');
    expect(suggestMealType(at(15, 30))).toBe('snack');
    expect(suggestMealType(at(19))).toBe('dinner');
    expect(suggestMealType(at(23, 45))).toBe('dinner');
  });
});

describe('sumNutrition', () => {
  it('returns zeros for an empty list', () => {
    expect(sumNutrition([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it('sums kcal and macros across meals', () => {
    const meals = [
      meal('a', 'breakfast', '2026-08-27T07:00:00Z', { kcal: 200, proteinG: 8, carbsG: 25, fatG: 4 }),
      meal('b', 'breakfast', '2026-08-27T08:00:00Z', { kcal: 150, proteinG: 5, carbsG: 10, fatG: 6 }),
    ];
    expect(sumNutrition(meals)).toEqual({ kcal: 350, proteinG: 13, carbsG: 35, fatG: 10 });
  });
});
