/** Öffentliche Schnittstelle des Health-Moduls (Gewicht + Health-Metriken/Ingest). */
import type { FastifyInstance } from 'fastify';
import type { Database } from '../../core/db.js';
import type { AuthGuards } from '../auth/index.js';
import { createApiTokenRepo } from './repositories/api-token-repo.js';
import { createMetricRepo } from './repositories/metric-repo.js';
import { createWeightRepo } from './repositories/weight-repo.js';
import { healthRoutes } from './routes.js';
import { ingestRoutes } from './ingest-routes.js';
import { createIngestService, type IngestService } from './services/ingest-service.js';
import { createWaterService } from './services/water-service.js';
import { createWeightService, type WeightService } from './services/weight-service.js';

export type { WeightService } from './services/weight-service.js';
export type { IngestService } from './services/ingest-service.js';
export type { WaterService } from './services/water-service.js';

export interface HealthModuleOptions {
  db: Database;
  guards: AuthGuards;
}

export interface HealthModuleApi {
  weightService: WeightService;
  ingestService: IngestService;
}

export async function registerHealthModule(
  app: FastifyInstance,
  opts: HealthModuleOptions,
): Promise<HealthModuleApi> {
  const metricRepo = createMetricRepo(opts.db);
  const waterService = createWaterService(metricRepo);
  const weightRepo = createWeightRepo(opts.db);
  const weightService = createWeightService(weightRepo);
  const ingestService = createIngestService({
    metricRepo,
    apiTokenRepo: createApiTokenRepo(opts.db),
    weightService,
  });
  await app.register(healthRoutes({ weightService, waterService, guards: opts.guards }), {
    prefix: '/api/v1',
  });
  await app.register(ingestRoutes({ ingestService, guards: opts.guards }), { prefix: '/api/v1' });
  return { weightService, ingestService };
}
