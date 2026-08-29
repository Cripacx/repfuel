import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '@repfuel/shared';
import { AppError } from '../../core/errors.js';
import type { SessionService } from './services/session-service.js';
import type { UserService } from './services/user-service.js';
import { toSessionUser } from './services/user-service.js';

export const SESSION_COOKIE = 'repfuel_sid';

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser: SessionUser | null;
    sessionId: string | null;
  }
}

export interface AuthGuards {
  /** Lädt die Session (falls vorhanden) — als globaler onRequest-Hook registrieren. */
  loadSession: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

export function createAuthGuards(
  sessionService: SessionService,
  userService: UserService,
): AuthGuards {
  return {
    async loadSession(req) {
      req.sessionUser = null;
      req.sessionId = null;
      const sid = req.cookies[SESSION_COOKIE];
      if (!sid) return;
      const session = await sessionService.get(sid);
      if (!session) return;
      const user = await userService.getActiveUser(session.userId);
      if (!user) {
        await sessionService.destroy(sid);
        return;
      }
      req.sessionUser = toSessionUser(user);
      req.sessionId = sid;
      await sessionService.touch(sid);
    },
    async requireAuth(req) {
      if (!req.sessionUser) throw new AppError('unauthorized', 'Login required');
    },
    async requireAdmin(req) {
      if (!req.sessionUser) throw new AppError('unauthorized', 'Login required');
      if (req.sessionUser.role !== 'admin') throw new AppError('forbidden', 'Admin role required');
    },
  };
}
