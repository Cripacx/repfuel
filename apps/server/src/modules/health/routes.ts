import type { FastifyInstance } from 'fastify';
import { listWeightQuerySchema, upsertWeightRequestSchema, uuidSchema } from '@repfuel/shared';
import { z } from 'zod';
import type { AuthGuards } from '../auth/index.js';
import type { WeightService } from './services/weight-service.js';

const idParams = z.object({ id: uuidSchema });

export interface HealthRoutesDeps {
  weightService: WeightService;
  guards: AuthGuards;
}

export function healthRoutes(deps: HealthRoutesDeps) {
  const { weightService, guards } = deps;

  return async function register(app: FastifyInstance) {
    app.addHook('preHandler', guards.requireAuth);
    const uid = (req: { sessionUser: { id: string } | null }) => req.sessionUser!.id;

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
