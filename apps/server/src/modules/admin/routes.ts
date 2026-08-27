import type { FastifyInstance } from 'fastify';
import {
  createInviteRequestSchema,
  inviteIdParamsSchema,
  updateSettingsRequestSchema,
  updateUserRequestSchema,
  userIdParamsSchema,
} from '@repfuel/shared';
import type { AuthGuards, UserService } from '../auth/index.js';

export interface AdminRoutesDeps {
  userService: UserService;
  guards: AuthGuards;
}

export function adminRoutes(deps: AdminRoutesDeps) {
  const { userService, guards } = deps;

  return async function register(app: FastifyInstance) {
    app.addHook('preHandler', guards.requireAdmin);

    app.get('/users', async () => ({ users: await userService.listUsers() }));

    app.patch('/users/:id', async (req) => {
      const { id } = userIdParamsSchema.parse(req.params);
      const body = updateUserRequestSchema.parse(req.body);
      const user = await userService.setUserDisabled(req.sessionUser!.id, id, body.disabled!);
      return { user };
    });

    app.delete('/users/:id', async (req, reply) => {
      const { id } = userIdParamsSchema.parse(req.params);
      await userService.deleteUser(req.sessionUser!.id, id);
      return reply.code(204).send();
    });

    app.get('/invites', async () => ({ invites: await userService.listInvites() }));

    app.post('/invites', async (req) => {
      const body = createInviteRequestSchema.parse(req.body ?? {});
      const invite = await userService.createInvite({
        createdBy: req.sessionUser!.id,
        username: body.username,
        expiresInHours: body.expiresInHours,
      });
      return { invite };
    });

    app.delete('/invites/:id', async (req, reply) => {
      const { id } = inviteIdParamsSchema.parse(req.params);
      await userService.revokeInvite(id);
      return reply.code(204).send();
    });

    app.get('/settings', async () => ({ settings: await userService.getSettings() }));

    app.patch('/settings', async (req) => {
      const body = updateSettingsRequestSchema.parse(req.body);
      const settings = await userService.updateSettings(body);
      return { settings };
    });

    app.get('/status', async () => ({ status: await userService.getInstanceStatus() }));
  };
}
