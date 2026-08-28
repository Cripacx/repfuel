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
import { registerHealthModule } from './modules/health/index.js';
import { registerNutritionModule } from './modules/nutrition/index.js';
import { registerAiModule } from './modules/ai/index.js';
import { registerSyncModule } from './modules/sync/index.js';
import { registerWorkoutModule } from './modules/workout/index.js';

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

  // Leere JSON-Bodies (z.B. DELETE mit content-type application/json) tolerieren.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (body === '' || body === undefined) return done(null, undefined);
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(new AppError('bad_request', 'Invalid JSON body'), undefined);
    }
  });

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
  const workoutApi = await registerWorkoutModule(app, {
    db: deps.db,
    eventBus,
    guards: authApi.guards,
  });
  const healthApi = await registerHealthModule(app, { db: deps.db, guards: authApi.guards });
  const nutritionApi = await registerNutritionModule(app, {
    db: deps.db,
    kv,
    guards: authApi.guards,
    getTargets: (userId) => authApi.profileService.getTargets(userId),
    onExternalError: (err, context) => app.log.warn({ err, context }, 'open food facts error'),
  });

  await registerSyncModule(app, {
    guards: authApi.guards,
    workoutService: workoutApi.workoutService,
    weightService: healthApi.weightService,
    mealService: nutritionApi.mealService,
  });

  await registerAiModule(app, {
    db: deps.db,
    kv,
    guards: authApi.guards,
    provider: config.AI_PROVIDER,
    apiKey: config.AI_API_KEY || null,
    model: config.AI_MODEL || null,
    baseUrl: config.AI_BASE_URL || null,
    sidecarUrl: config.AI_SIDECAR_URL,
    mcpUrl: config.AI_MCP_URL,
    profileService: authApi.profileService,
    weightService: healthApi.weightService,
    mealService: nutritionApi.mealService,
    foodService: nutritionApi.foodService,
    workoutService: workoutApi.workoutService,
    routineService: workoutApi.routineService,
  });

  const seeded = await workoutApi.seedExercises();
  app.log.info({ seeded }, 'exercise library seeded (idempotent)');

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
