/** Öffentliche Schnittstelle des Nutrition-Moduls. */
import type { FastifyInstance } from 'fastify';
import type { Database } from '../../core/db.js';
import type { KeyValueStore } from '../../core/redis.js';
import type { AuthGuards } from '../auth/index.js';
import { createFoodRepo } from './repositories/food-repo.js';
import { createMealRepo } from './repositories/meal-repo.js';
import { nutritionRoutes } from './routes.js';
import { createFoodService, type FoodService } from './services/food-service.js';
import { createMealService, type MealService, type TargetsProvider } from './services/meal-service.js';
import { createOffClient } from './services/off-client.js';

export type { FoodService } from './services/food-service.js';
export type { MealService, TargetsProvider } from './services/meal-service.js';

export interface NutritionModuleOptions {
  db: Database;
  kv: KeyValueStore;
  guards: AuthGuards;
  /** Ziele aus dem Profil (Auth-Modul), injiziert über die öffentliche Schnittstelle. */
  getTargets: TargetsProvider;
  onExternalError?: (err: unknown, context: string) => void;
}

export interface NutritionModuleApi {
  foodService: FoodService;
  mealService: MealService;
}

export async function registerNutritionModule(
  app: FastifyInstance,
  opts: NutritionModuleOptions,
): Promise<NutritionModuleApi> {
  const foodRepo = createFoodRepo(opts.db);
  const mealRepo = createMealRepo(opts.db);
  const offClient = createOffClient({ cache: opts.kv, onError: opts.onExternalError });
  const foodService = createFoodService({ foodRepo, offClient });
  const mealService = createMealService({ mealRepo, foodRepo, getTargets: opts.getTargets });

  await app.register(nutritionRoutes({ foodService, mealService, guards: opts.guards }), {
    prefix: '/api/v1',
  });

  return { foodService, mealService };
}
