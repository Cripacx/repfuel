import { z } from 'zod';
import { uuidSchema } from './common.js';
import { isoDateTimeSchema } from './workout.js';
import { ACTIVITY_LEVELS, GOALS, SEXES } from '../nutrition/targets.js';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const FOOD_SOURCES = ['off', 'custom'] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

const per100 = z.number().min(0).max(1000);

export const createFoodRequestSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().min(1).max(200).nullable().optional(),
  kcalPer100: z.number().min(0).max(1000),
  proteinPer100: per100,
  carbsPer100: per100,
  fatPer100: per100,
});
export type CreateFoodRequest = z.infer<typeof createFoodRequestSchema>;

export const foodSearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type FoodSearchQuery = z.infer<typeof foodSearchQuerySchema>;

export const recentFoodsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type RecentFoodsQuery = z.infer<typeof recentFoodsQuerySchema>;

export const barcodeParamsSchema = z.object({
  code: z.string().regex(/^\d{6,14}$/, 'invalid barcode'),
});

export const mealUpsertFieldsSchema = z.object({
  eatenAt: isoDateTimeSchema,
  mealType: z.enum(MEAL_TYPES),
  foodId: uuidSchema.nullable().optional(),
  amountG: z.number().min(0.1).max(10000).nullable().optional(),
  quickKcal: z.number().min(0).max(10000).nullable().optional(),
});

export const mealEitherFoodOrQuick = (v: {
  foodId?: string | null;
  amountG?: number | null;
  quickKcal?: number | null;
}) => (v.foodId != null && v.amountG != null) !== (v.quickKcal != null);

export const upsertMealRequestSchema = mealUpsertFieldsSchema.refine(mealEitherFoodOrQuick, {
  message: 'either foodId+amountG or quickKcal must be set',
});
export type UpsertMealRequest = z.infer<typeof upsertMealRequestSchema>;

export const listMealsQuerySchema = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
export type ListMealsQuery = z.infer<typeof listMealsQuerySchema>;

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const nutritionStatsQuerySchema = z.object({
  from: dateOnly,
  to: dateOnly,
  /** Minuten östlich von UTC (wie Date#getTimezoneOffset negiert), Default 0. */
  tzOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
});
export type NutritionStatsQuery = z.infer<typeof nutritionStatsQuerySchema>;

export const updateProfileRequestSchema = z.object({
  heightCm: z.number().int().min(80).max(250).nullable().optional(),
  birthYear: z.number().int().min(1900).max(2100).nullable().optional(),
  sex: z.enum(SEXES).nullable().optional(),
  activityLevel: z.enum(ACTIVITY_LEVELS).nullable().optional(),
  goal: z.enum(GOALS).nullable().optional(),
  kcalTarget: z.number().int().min(500).max(10000).nullable().optional(),
  proteinTargetG: z.number().int().min(0).max(1000).nullable().optional(),
  carbsTargetG: z.number().int().min(0).max(2000).nullable().optional(),
  fatTargetG: z.number().int().min(0).max(1000).nullable().optional(),
  waterTargetMl: z.number().int().min(100).max(10000).nullable().optional(),
  // 1–23 h: 0 wäre kein Fasten, 24 h kein Fenster mehr.
  fastingWindowH: z.number().int().min(1).max(23).nullable().optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

/** Wasser loggen: positive Menge in ml, Zeitpunkt optional (Default: jetzt). */
export const logWaterRequestSchema = z.object({
  ml: z.number().int().min(1).max(5000),
  at: isoDateTimeSchema.optional(),
});
export type LogWaterRequest = z.infer<typeof logWaterRequestSchema>;

/** Zeitraum für die Wassersumme (lokale Tagesgrenzen berechnet der Client). */
export const waterRangeQuerySchema = z.object({
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
});
export type WaterRangeQuery = z.infer<typeof waterRangeQuerySchema>;
