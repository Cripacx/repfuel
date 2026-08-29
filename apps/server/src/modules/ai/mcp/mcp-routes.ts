import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyInstance } from 'fastify';
import type { ToolDefinition, ToolSet } from '@repfuel/shared';
import type { McpTokenClaims, McpTokenService } from './token-service.js';

export interface McpRoutesDeps {
  tokenService: McpTokenService;
  /** Baut das ToolSet für den authentifizierten Nutzer (identisch zum API-Adapter). */
  buildTools: (claims: McpTokenClaims) => ToolSet;
  appVersion: string;
}

function buildMcpServer(deps: McpRoutesDeps, claims: McpTokenClaims): McpServer {
  const server = new McpServer({ name: 'repfuel', version: deps.appVersion });
  const tools = deps.buildTools(claims);
  for (const [name, def] of Object.entries(tools)) {
    const typed = def as unknown as ToolDefinition<unknown>;
    server.registerTool(
      name,
      { description: typed.description, inputSchema: typed.inputSchema },
      (async (input: unknown) => {
        try {
          const result = await typed.execute(typed.inputSchema.parse(input ?? {}));
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
        } catch (err) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ error: err instanceof Error ? err.message : 'tool failed' }),
              },
            ],
            isError: true,
          };
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    );
  }
  return server;
}

/**
 * MCP-Wrapper (Streamable HTTP, stateless): dieselben Tools wie der
 * API-Adapter, Auth über kurzlebige pro-Session-Tokens. Gedacht für den
 * CLI-Sidecar im internen Compose-Netz; da nur unratbare Tokens Zugriff
 * geben, ist der Pfad auch hinter einem Reverse-Proxy unkritisch.
 */
export function mcpRoutes(deps: McpRoutesDeps) {
  return async function register(app: FastifyInstance) {
    // Streamable-HTTP-Transport braucht den rohen Body — Parsing selbst übernehmen.
    app.removeAllContentTypeParsers();
    app.addContentTypeParser('*', { parseAs: 'string' }, (_req, body, done) => {
      done(null, body);
    });

    app.post('/', async (req, reply) => {
      const auth = req.headers.authorization ?? '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      const claims = await deps.tokenService.verify(token);
      if (!claims) {
        return reply.code(401).send({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Invalid or expired MCP token' },
          id: null,
        });
      }

      const server = buildMcpServer(deps, claims);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      reply.hijack();
      reply.raw.on('close', () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      let body: unknown;
      try {
        body = typeof req.body === 'string' && req.body.length > 0 ? JSON.parse(req.body) : undefined;
      } catch {
        reply.raw.writeHead(400, { 'content-type': 'application/json' }).end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32700, message: 'Parse error' },
            id: null,
          }),
        );
        return reply;
      }
      await transport.handleRequest(req.raw, reply.raw, body);
      return reply;
    });

    // Stateless: kein SSE-Kanal, keine Sessions.
    app.get('/', async (_req, reply) =>
      reply.code(405).send({ error: 'method_not_allowed', message: 'stateless MCP endpoint' }),
    );
    app.delete('/', async (_req, reply) =>
      reply.code(405).send({ error: 'method_not_allowed', message: 'stateless MCP endpoint' }),
    );
  };
}
