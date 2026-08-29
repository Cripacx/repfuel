import type { FastifyInstance } from 'fastify';
import type { RegistrationModeResponse } from '@repfuel/shared';
import {
  loginOptionsRequestSchema,
  loginVerifyRequestSchema,
  passwordLoginRequestSchema,
  passwordRegisterRequestSchema,
  registerOptionsRequestSchema,
  registerVerifyRequestSchema,
  setPasswordRequestSchema,
  updateMeRequestSchema,
  updateProfileRequestSchema,
} from '@repfuel/shared';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { SESSION_COOKIE, type AuthGuards } from './plugin.js';
import type { AuthService } from './services/auth-service.js';
import type { ProfileService } from './services/profile-service.js';
import type { UserService } from './services/user-service.js';

export interface AuthRoutesDeps {
  authService: AuthService;
  userService: UserService;
  profileService: ProfileService;
  guards: AuthGuards;
  cookieSecure: boolean;
  sessionTtlDays: number;
}

export function authRoutes(deps: AuthRoutesDeps) {
  const { authService, userService, profileService, guards } = deps;

  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: deps.cookieSecure,
    maxAge: deps.sessionTtlDays * 24 * 60 * 60,
  };

  return async function register(app: FastifyInstance) {
    app.get('/registration-mode', async (): Promise<RegistrationModeResponse> => {
      return userService.getRegistrationState();
    });

    app.post('/register-options', async (req) => {
      const body = registerOptionsRequestSchema.parse(req.body);
      return authService.startRegistration(body);
    });

    app.post('/register', async (req, reply) => {
      const body = registerVerifyRequestSchema.parse(req.body);
      const { user, sid } = await authService.finishRegistration({
        flowId: body.flowId,
        response: body.response as unknown as RegistrationResponseJSON,
      });
      reply.setCookie(SESSION_COOKIE, sid, cookieOptions);
      return { user };
    });

    app.post('/login-options', async (req) => {
      const body = loginOptionsRequestSchema.parse(req.body ?? {});
      return authService.startLogin(body);
    });

    app.post('/login', async (req, reply) => {
      const body = loginVerifyRequestSchema.parse(req.body);
      const { user, sid } = await authService.finishLogin({
        flowId: body.flowId,
        response: body.response as unknown as AuthenticationResponseJSON,
      });
      reply.setCookie(SESSION_COOKIE, sid, cookieOptions);
      return { user };
    });

    app.post('/register-password', async (req, reply) => {
      const body = passwordRegisterRequestSchema.parse(req.body);
      const { user, sid } = await authService.registerWithPassword(body);
      reply.setCookie(SESSION_COOKIE, sid, cookieOptions);
      return { user };
    });

    app.post('/login-password', async (req, reply) => {
      const body = passwordLoginRequestSchema.parse(req.body);
      const { user, sid } = await authService.loginWithPassword(body);
      reply.setCookie(SESSION_COOKIE, sid, cookieOptions);
      return { user };
    });

    app.post('/password', { preHandler: guards.requireAuth }, async (req, reply) => {
      const body = setPasswordRequestSchema.parse(req.body);
      await authService.setOwnPassword(req.sessionUser!.id, body.password);
      return reply.code(204).send();
    });

    app.post('/logout', async (req, reply) => {
      if (req.sessionId) await authService.logout(req.sessionId);
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      return reply.code(204).send();
    });

    app.get('/me', { preHandler: guards.requireAuth }, async (req) => {
      return { user: req.sessionUser };
    });

    app.patch('/me', { preHandler: guards.requireAuth }, async (req) => {
      const body = updateMeRequestSchema.parse(req.body);
      const user = await userService.updateLocale(req.sessionUser!.id, body.locale);
      return { user };
    });

    app.get('/profile', { preHandler: guards.requireAuth }, async (req) => {
      return { profile: await profileService.get(req.sessionUser!.id) };
    });

    app.patch('/profile', { preHandler: guards.requireAuth }, async (req) => {
      const body = updateProfileRequestSchema.parse(req.body);
      return { profile: await profileService.update(req.sessionUser!.id, body) };
    });
  };
}
