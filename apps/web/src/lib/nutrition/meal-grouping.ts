import { MEAL_TYPES, type MealDto, type MealType } from '@repfuel/shared';

export type MealsByType = Record<MealType, MealDto[]>;

/**
 * Gruppiert Mahlzeiten nach Typ (feste Reihenfolge `MEAL_TYPES`), jede Gruppe
 * aufsteigend nach Uhrzeit sortiert. Jeder Typ ist immer vorhanden (ggf. leeres Array),
 * damit das Dashboard alle vier Abschnitte ohne Sonderfall rendern kann.
 */
export function groupMealsByType(meals: readonly MealDto[]): MealsByType {
  const grouped = Object.fromEntries(MEAL_TYPES.map((type) => [type, [] as MealDto[]])) as MealsByType;
  for (const meal of meals) {
    grouped[meal.mealType].push(meal);
  }
  for (const type of MEAL_TYPES) {
    grouped[type].sort((a, b) => new Date(a.eatenAt).getTime() - new Date(b.eatenAt).getTime());
  }
  return grouped;
}

export interface NutritionTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Summiert kcal/Makros über eine Liste bereits geladener Mahlzeiten. */
export function sumNutrition(meals: readonly MealDto[]): NutritionTotals {
  return meals.reduce<NutritionTotals>(
    (acc, meal) => ({
      kcal: acc.kcal + meal.kcal,
      proteinG: acc.proteinG + meal.proteinG,
      carbsG: acc.carbsG + meal.carbsG,
      fatG: acc.fatG + meal.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}
