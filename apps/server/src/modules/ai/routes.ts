import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ChatChunk } from '@repfuel/shared';
import {
  chatSessionIdParamsSchema,
  postChatMessageRequestSchema,
  proposalIdParamsSchema,
} from '@repfuel/shared';
import type { AuthGuards } from '../auth/index.js';
import type { ChatService } from './services/chat-service.js';
import type { ProposalService } from './services/proposal-service.js';

export interface AiRoutesDeps {
  chatService: ChatService;
  proposalService: ProposalService;
  guards: AuthGuards;
}

function sseWrite(reply: FastifyReply, chunk: ChatChunk): void {
  reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
}

export function aiRoutes(deps: AiRoutesDeps) {
  const { chatService, proposalService, guards } = deps;

  return async function register(app: FastifyInstance) {
    app.get('/ai/status', async () => chatService.status());

    app.register(async (authed) => {
      authed.addHook('preHandler', guards.requireAuth);
      const uid = (req: { sessionUser: { id: string } | null }) => req.sessionUser!.id;

      authed.post('/chat/sessions', async (req) => ({
        session: await chatService.createSession(uid(req)),
      }));

      authed.get('/chat/sessions', async (req) => ({
        sessions: await chatService.listSessions(uid(req)),
      }));

      authed.delete('/chat/sessions/:id', async (req, reply) => {
        const { id } = chatSessionIdParamsSchema.parse(req.params);
        await chatService.deleteSession(uid(req), id);
        return reply.code(204).send();
      });

      authed.get('/chat/sessions/:id/messages', async (req) => {
        const { id } = chatSessionIdParamsSchema.parse(req.params);
        return { messages: await chatService.listMessages(uid(req), id) };
      });

      // SSE-Stream der Antwort
      authed.post('/chat/sessions/:id/messages', async (req, reply) => {
        const { id } = chatSessionIdParamsSchema.parse(req.params);
        const body = postChatMessageRequestSchema.parse(req.body);

        reply.raw.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        });
        reply.raw.write(': stream start\n\n');
        const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 15000);

        try {
          for await (const chunk of chatService.streamMessage({
            user: req.sessionUser!,
            sessionId: id,
            content: body.content,
            tzOffsetMinutes: body.tzOffsetMinutes,
          })) {
            sseWrite(reply, chunk);
          }
        } catch (err) {
          req.log.error({ err }, 'chat stream failed');
          sseWrite(reply, {
            type: 'error',
            message: err instanceof Error ? err.message : 'chat failed',
          });
        } finally {
          clearInterval(heartbeat);
          reply.raw.end();
        }
        return reply;
      });

      authed.get('/ai/proposals', async (req) => ({
        proposals: await proposalService.listPending(uid(req)),
      }));

      authed.post('/ai/proposals/:id/confirm', async (req) => {
        const { id } = proposalIdParamsSchema.parse(req.params);
        return { proposal: await proposalService.confirm(uid(req), id) };
      });

      authed.post('/ai/proposals/:id/reject', async (req) => {
        const { id } = proposalIdParamsSchema.parse(req.params);
        return { proposal: await proposalService.reject(uid(req), id) };
      });
    });
  };
}
