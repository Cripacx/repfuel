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

/**
 * Vorbelegung des Mahlzeit-Typs nach Uhrzeit: wer um 8 Uhr loggt, loggt fast
 * immer Frühstück — der Dialog soll die wahrscheinliche Wahl schon treffen,
 * änderbar bleibt sie über den Segment-Schalter.
 */
export function suggestMealType(date: Date): MealType {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour < 10.5) return 'breakfast';
  if (hour < 14.5) return 'lunch';
  if (hour < 17.5) return 'snack';
  return 'dinner';
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
