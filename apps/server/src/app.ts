import path from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { sql } from 'drizzle-orm';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { AppConfig } from './config.js';
import type { Database } from './core/db.js';
import { AppError } from './core/errors.js';
import { createInProcessEventBus } from './core/event-bus.js';
import { redisKeyValueStore, type RedisClient } from './core/redis.js';
import { registerAdminModule } from './modules/admin/index.js';
import { registerAuthModule } from './modules/auth/index.js';

export interface AppDeps {
  db: Database;
  redis: RedisClient;
}

export async function buildApp(config: AppConfig, deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    trustProxy: true,
  });

  await app.register(fastifyCookie);

  app.setErrorHandler((err: unknown, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: err.code, message: err.message });
    }
    if (err instanceof ZodError) {
      const message = err.issues
        .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join('; ');
      return reply.code(400).send({ error: 'validation_error', message });
    }
    const httpErr = err as { statusCode?: number; message?: string };
    if (typeof httpErr.statusCode === 'number' && httpErr.statusCode < 500) {
      return reply
        .code(httpErr.statusCode)
        .send({ error: 'bad_request', message: httpErr.message ?? 'Bad request' });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: 'internal_error', message: 'Internal server error' });
  });

  const eventBus = createInProcessEventBus((err, topic) =>
    app.log.error({ err, topic }, 'event handler failed'),
  );
  app.log.debug('event bus ready');

  app.get('/api/health', async (_req, reply) => {
    const checks = { db: false, redis: false };
    try {
      await deps.db.execute(sql`select 1`);
      checks.db = true;
    } catch (err) {
      app.log.error({ err }, 'db health check failed');
    }
    try {
      checks.redis = (await deps.redis.ping()) === 'PONG';
    } catch (err) {
      app.log.error({ err }, 'redis health check failed');
    }
    const ok = checks.db && checks.redis;
    return reply.code(ok ? 200 : 503).send({ status: ok ? 'ok' : 'degraded', ...checks });
  });

  const kv = redisKeyValueStore(deps.redis);
  const authApi = await registerAuthModule(app, {
    db: deps.db,
    kv,
    eventBus,
    configuredMode: config.REGISTRATION_MODE,
    appVersion: config.version,
    origin: config.ORIGIN,
    rpId: config.rpId,
    rpName: config.rpName,
    sessionTtlDays: config.SESSION_TTL_DAYS,
  });
  await registerAdminModule(app, { userService: authApi.userService, guards: authApi.guards });

  if (config.STATIC_DIR) {
    const staticRoot = path.resolve(config.STATIC_DIR);
    await app.register(fastifyStatic, { root: staticRoot, wildcard: true });
    // SPA-Fallback: unbekannte Nicht-API-Pfade liefern die index.html aus.
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'not_found', message: 'Route not found' });
      }
      return reply.sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((_req, reply) =>
      reply.code(404).send({ error: 'not_found', message: 'Route not found' }),
    );
  }

  return app;
}
