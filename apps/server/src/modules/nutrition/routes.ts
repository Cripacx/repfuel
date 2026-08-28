import type { FastifyInstance } from 'fastify';
import {
  barcodeParamsSchema,
  createFoodRequestSchema,
  foodSearchQuerySchema,
  listMealsQuerySchema,
  nutritionStatsQuerySchema,
  upsertMealRequestSchema,
  uuidSchema,
} from '@repfuel/shared';
import { z } from 'zod';
import type { AuthGuards } from '../auth/index.js';
import type { FoodService } from './services/food-service.js';
import type { MealService } from './services/meal-service.js';

const idParams = z.object({ id: uuidSchema });

export interface NutritionRoutesDeps {
  foodService: FoodService;
  mealService: MealService;
  guards: AuthGuards;
}

export function nutritionRoutes(deps: NutritionRoutesDeps) {
  const { foodService, mealService, guards } = deps;

  return async function register(app: FastifyInstance) {
    app.addHook('preHandler', guards.requireAuth);
    const uid = (req: { sessionUser: { id: string } | null }) => req.sessionUser!.id;

    app.get('/foods/search', async (req) => {
      const { q, limit } = foodSearchQuerySchema.parse(req.query);
      return { foods: await foodService.search(uid(req), q, limit) };
    });

    app.get('/foods/barcode/:code', async (req) => {
      const { code } = barcodeParamsSchema.parse(req.params);
      return { food: await foodService.byBarcode(code) };
    });

    app.post('/foods', async (req) => {
      const body = createFoodRequestSchema.parse(req.body);
      return { food: await foodService.createCustom(uid(req), body) };
    });

    app.get('/meals', async (req) => {
      const query = listMealsQuerySchema.parse(req.query);
      return { meals: await mealService.list(uid(req), query) };
    });

    app.put('/meals/:id', async (req) => {
      const { id } = idParams.parse(req.params);
      const body = upsertMealRequestSchema.parse(req.body);
      return { meal: await mealService.upsert(uid(req), id, body) };
    });

    app.delete('/meals/:id', async (req, reply) => {
      const { id } = idParams.parse(req.params);
      await mealService.remove(uid(req), id);
      return reply.code(204).send();
    });

    app.get('/stats/nutrition', async (req) => {
      const query = nutritionStatsQuerySchema.parse(req.query);
      return await mealService.stats(uid(req), query);
    });
  };
}
