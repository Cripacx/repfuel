import Fastify from 'fastify';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ToolSet } from '@repfuel/shared';
import { mcpRoutes } from '../mcp/mcp-routes.js';
import { createMcpTokenService } from '../mcp/token-service.js';
import { fakeKv } from '../../../core/testing/fake-kv.js';

const kv = fakeKv();
const tokenService = createMcpTokenService(kv);

const tools = {
  get_profile: {
    description: 'Profil abrufen',
    inputSchema: z.object({}),
    execute: async () => ({ kcalTarget: 2300 }),
  },
  log_weight: {
    description: 'Gewicht loggen',
    inputSchema: z.object({ weight_kg: z.number() }),
    execute: async (input: { weight_kg: number }) => ({ logged: input.weight_kg }),
  },
} as unknown as ToolSet;

const app = Fastify();
let token: string;

beforeAll(async () => {
  await app.register(
    mcpRoutes({
      tokenService,
      appVersion: 'test',
      buildTools: (claims) => {
        expect(claims.userId).toBe('user-1');
        return tools;
      },
    }),
    { prefix: '/internal/mcp' },
  );
  await app.ready();
  token = await tokenService.issue({ userId: 'user-1', chatSessionId: 's-1', tzOffsetMinutes: 0 });
});

afterAll(async () => {
  await app.close();
});

function rpc(method: string, params: unknown, id = 1, auth: string | null = null) {
  return app.inject({
    method: 'POST',
    url: '/internal/mcp',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(auth === null ? { authorization: `Bearer ${token}` } : auth ? { authorization: auth } : {}),
    },
    payload: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
}

function parseRpcResponse(body: string): { result?: unknown; error?: unknown } {
  // Streamable HTTP kann als SSE antworten — data:-Zeile extrahieren.
  if (body.startsWith('event:') || body.includes('\ndata:') || body.startsWith('data:')) {
    const line = body.split('\n').find((l) => l.startsWith('data:'));
    return JSON.parse(line!.slice(5).trim());
  }
  return JSON.parse(body);
}

describe('MCP wrapper', () => {
  it('rejects requests without valid token', async () => {
    const res = await rpc('initialize', {}, 1, 'Bearer wrong-token');
    expect(res.statusCode).toBe(401);
  });

  it('initializes and lists the service tools', async () => {
    const init = await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    });
    expect(init.statusCode).toBe(200);
    const initBody = parseRpcResponse(init.body) as { result: { serverInfo: { name: string } } };
    expect(initBody.result.serverInfo.name).toBe('repfuel');

    const list = await rpc('tools/list', {}, 2);
    const listBody = parseRpcResponse(list.body) as { result: { tools: { name: string }[] } };
    const names = listBody.result.tools.map((t) => t.name).sort();
    expect(names).toEqual(['get_profile', 'log_weight']);
  });

  it('executes tools via the same service layer', async () => {
    const res = await rpc('tools/call', { name: 'log_weight', arguments: { weight_kg: 82 } }, 3);
    const body = parseRpcResponse(res.body) as {
      result: { content: { type: string; text: string }[] };
    };
    expect(JSON.parse(body.result.content[0]!.text)).toEqual({ logged: 82 });
  });

  it('returns tool errors as isError result, not as crash', async () => {
    const res = await rpc('tools/call', { name: 'log_weight', arguments: { weight_kg: 'x' } }, 4);
    const body = parseRpcResponse(res.body) as {
      result?: { isError?: boolean };
      error?: unknown;
    };
    // zod-Fehler → sauberes Fehlerresultat (SDK meldet Validation als error oder isError)
    expect(body.error !== undefined || body.result?.isError === true).toBe(true);
  });
});
