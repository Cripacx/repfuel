/** Öffentliche Schnittstelle des Admin-Moduls. */
import type { FastifyInstance } from 'fastify';
import type { AuthGuards, UserService } from '../auth/index.js';
import { adminRoutes } from './routes.js';

export interface AdminModuleOptions {
  userService: UserService;
  guards: AuthGuards;
}

export async function registerAdminModule(
  app: FastifyInstance,
  opts: AdminModuleOptions,
): Promise<void> {
  await app.register(adminRoutes(opts), { prefix: '/api/v1/admin' });
}
