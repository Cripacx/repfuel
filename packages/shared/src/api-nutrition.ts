import type { ActivityLevel, Goal, Sex } from './nutrition/targets.js';
import type { FoodSource, MealType } from './schemas/nutrition.js';

export interface FoodDto {
  id: string;
  source: FoodSource;
  offBarcode: string | null;
  name: string;
  brand: string | null;
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  /** null = global (OFF-Cache), sonst eigenes Lebensmittel des Nutzers. */
  userId: string | null;
}

export interface MealDto {
  id: string;
  eatenAt: string;
  mealType: MealType;
  foodId: string | null;
  amountG: number | null;
  quickKcal: number | null;
  food: FoodDto | null;
  /** Berechnete Nährwerte des Eintrags. */
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ProfileDto {
  heightCm: number | null;
  birthYear: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
  goal: Goal | null;
  kcalTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
}

export interface NutritionTargets {
  kcalTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
}

export interface NutritionDayDto {
  date: string; // YYYY-MM-DD
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealCount: number;
}

export interface NutritionStatsResponse {
  days: NutritionDayDto[];
  targets: NutritionTargets;
}
