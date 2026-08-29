import type { FastifyInstance } from 'fastify';
import {
  createApiTokenRequestSchema,
  healthAutoExportSchema,
  healthStatsQuerySchema,
  simpleHealthIngestSchema,
  uuidSchema,
} from '@repfuel/shared';
import { z } from 'zod';
import type { AuthGuards } from '../auth/index.js';
import type { IngestService } from './services/ingest-service.js';

const idParams = z.object({ id: uuidSchema });

export interface IngestRoutesDeps {
  ingestService: IngestService;
  guards: AuthGuards;
}

export function ingestRoutes(deps: IngestRoutesDeps) {
  const { ingestService, guards } = deps;

  return async function register(app: FastifyInstance) {
    // --- Ingest: Auth per API-Token (nicht Session-Cookie) ---
    app.post('/ingest/health', async (req, reply) => {
      const auth = req.headers.authorization ?? '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      const userId = await ingestService.verifyToken(token);
      if (!userId) {
        return reply
          .code(401)
          .send({ error: 'unauthorized', message: 'Valid API token required (Bearer)' });
      }
      // Beide Payload-Formate: Health Auto Export ({data:{metrics:[…]}}) und
      // unser simples Schema ({metrics:[…]}).
      const body = req.body as Record<string, unknown> | null;
      if (body && typeof body === 'object' && 'data' in body) {
        return ingestService.ingestHealthAutoExport(userId, healthAutoExportSchema.parse(body));
      }
      return ingestService.ingestSimple(userId, simpleHealthIngestSchema.parse(body));
    });

    // --- Abfragen + Token-Verwaltung: Session-Auth ---
    app.register(async (authed) => {
      authed.addHook('preHandler', guards.requireAuth);
      const uid = (req: { sessionUser: { id: string } | null }) => req.sessionUser!.id;

      authed.get('/stats/health', async (req) => {
        const query = healthStatsQuerySchema.parse(req.query);
        return ingestService.stats(uid(req), query);
      });

      authed.get('/ingest/tokens', async (req) => ({
        tokens: await ingestService.listTokens(uid(req)),
      }));

      authed.post('/ingest/tokens', async (req) => {
        const body = createApiTokenRequestSchema.parse(req.body);
        return { token: await ingestService.createToken(uid(req), body.name) };
      });

      authed.delete('/ingest/tokens/:id', async (req, reply) => {
        const { id } = idParams.parse(req.params);
        await ingestService.revokeToken(uid(req), id);
        return reply.code(204).send();
      });
    });
  };
}
