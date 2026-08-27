/** Öffentliche Schnittstelle des Health-Moduls (M2: Gewichts-Tracking). */
import type { FastifyInstance } from 'fastify';
import type { Database } from '../../core/db.js';
import type { AuthGuards } from '../auth/index.js';
import { createWeightRepo } from './repositories/weight-repo.js';
import { healthRoutes } from './routes.js';
import { createWeightService, type WeightService } from './services/weight-service.js';

export type { WeightService } from './services/weight-service.js';

export interface HealthModuleOptions {
  db: Database;
  guards: AuthGuards;
}

export interface HealthModuleApi {
  weightService: WeightService;
}

export async function registerHealthModule(
  app: FastifyInstance,
  opts: HealthModuleOptions,
): Promise<HealthModuleApi> {
  const weightRepo = createWeightRepo(opts.db);
  const weightService = createWeightService(weightRepo);
  await app.register(healthRoutes({ weightService, guards: opts.guards }), { prefix: '/api/v1' });
  return { weightService };
}
