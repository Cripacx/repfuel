/** Öffentliche Schnittstelle des Sync-Moduls (Offline-Batch-Upsert). */
import type { FastifyInstance } from 'fastify';
import { syncBatchRequestSchema } from '@repfuel/shared';
import type { AuthGuards } from '../auth/index.js';
import type { WeightService } from '../health/index.js';
import type { MealService } from '../nutrition/index.js';
import type { WorkoutService } from '../workout/index.js';
import { createSyncService } from './services/sync-service.js';

export interface SyncModuleOptions {
  guards: AuthGuards;
  workoutService: WorkoutService;
  weightService: WeightService;
  mealService: MealService;
}

export async function registerSyncModule(
  app: FastifyInstance,
  opts: SyncModuleOptions,
): Promise<void> {
  const syncService = createSyncService(opts);
  await app.register(
    async (instance) => {
      instance.post('/sync/batch', { preHandler: opts.guards.requireAuth }, async (req) => {
        const batch = syncBatchRequestSchema.parse(req.body);
        return syncService.applyBatch(req.sessionUser!.id, batch);
      });
    },
    { prefix: '/api/v1' },
  );
}
