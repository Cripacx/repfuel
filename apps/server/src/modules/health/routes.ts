import type { FastifyInstance } from 'fastify';
import {
  listWeightQuerySchema,
  logWaterRequestSchema,
  upsertWeightRequestSchema,
  uuidSchema,
  waterRangeQuerySchema,
} from '@repfuel/shared';
import { z } from 'zod';
import type { AuthGuards } from '../auth/index.js';
import type { WaterService } from './services/water-service.js';
import type { WeightService } from './services/weight-service.js';

const idParams = z.object({ id: uuidSchema });

export interface HealthRoutesDeps {
  weightService: WeightService;
  waterService: WaterService;
  guards: AuthGuards;
}

export function healthRoutes(deps: HealthRoutesDeps) {
  const { weightService, waterService, guards } = deps;

  return async function register(app: FastifyInstance) {
    app.addHook('preHandler', guards.requireAuth);
    const uid = (req: { sessionUser: { id: string } | null }) => req.sessionUser!.id;

    app.get('/water', async (req) => {
      const range = waterRangeQuerySchema.parse(req.query);
      return { water: await waterService.total(uid(req), range) };
    });

    app.post('/water', async (req, reply) => {
      const body = logWaterRequestSchema.parse(req.body);
      await waterService.log(uid(req), body);
      return reply.code(204).send();
    });

    app.get('/weight', async (req) => {
      const query = listWeightQuerySchema.parse(req.query);
      return { entries: await weightService.list(uid(req), query) };
    });

    app.put('/weight/:id', async (req) => {
      const { id } = idParams.parse(req.params);
      const body = upsertWeightRequestSchema.parse(req.body);
      return { entry: await weightService.upsert(uid(req), id, body) };
    });

    app.delete('/weight/:id', async (req, reply) => {
      const { id } = idParams.parse(req.params);
      await weightService.remove(uid(req), id);
      return reply.code(204).send();
    });
  };
}
