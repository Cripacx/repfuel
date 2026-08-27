/**
 * Öffentliche Schnittstelle des Auth-Moduls. Andere Module importieren
 * ausschließlich aus dieser Datei (per ESLint-Import-Boundary erzwungen).
 */
import type { FastifyInstance } from 'fastify';
import type { RegistrationMode } from '@repfuel/shared';
import type { Database } from '../../core/db.js';
import type { EventBus } from '../../core/event-bus.js';
import type { KeyValueStore } from '../../core/redis.js';
import { createCredentialRepo } from './repositories/credential-repo.js';
import { createInviteRepo } from './repositories/invite-repo.js';
import { createSettingsRepo } from './repositories/settings-repo.js';
import { createUserRepo } from './repositories/user-repo.js';
import { createAuthGuards, type AuthGuards } from './plugin.js';
import { authRoutes } from './routes.js';
import { createAuthService } from './services/auth-service.js';
import { createSessionService } from './services/session-service.js';
import { createUserService, type UserService } from './services/user-service.js';

export type { AuthGuards } from './plugin.js';
export type { UserService } from './services/user-service.js';

export interface AuthModuleOptions {
  db: Database;
  kv: KeyValueStore;
  eventBus: EventBus;
  configuredMode: RegistrationMode;
  appVersion: string;
  origin: string;
  rpId: string;
  rpName: string;
  sessionTtlDays: number;
}

export interface AuthModuleApi {
  userService: UserService;
  guards: AuthGuards;
}

export async function registerAuthModule(
  app: FastifyInstance,
  opts: AuthModuleOptions,
): Promise<AuthModuleApi> {
  const userRepo = createUserRepo(opts.db);
  const credentialRepo = createCredentialRepo(opts.db);
  const inviteRepo = createInviteRepo(opts.db);
  const settingsRepo = createSettingsRepo(opts.db);

  const userService = createUserService({
    userRepo,
    inviteRepo,
    settingsRepo,
    configuredMode: opts.configuredMode,
    appVersion: opts.appVersion,
  });
  const sessionService = createSessionService(opts.kv, opts.sessionTtlDays);
  const authService = createAuthService({
    userService,
    credentialRepo,
    flowStore: opts.kv,
    sessionService,
    eventBus: opts.eventBus,
    rpId: opts.rpId,
    rpName: opts.rpName,
    origin: opts.origin,
  });

  const guards = createAuthGuards(sessionService, userService);
  app.addHook('onRequest', guards.loadSession);

  await app.register(
    authRoutes({
      authService,
      userService,
      guards,
      cookieSecure: opts.origin.startsWith('https://'),
      sessionTtlDays: opts.sessionTtlDays,
    }),
    { prefix: '/api/v1/auth' },
  );

  return { userService, guards };
}
