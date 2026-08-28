import { describe, expect, it } from 'vitest';
import type { ChatMessageDto, ToolSet, UserContextSnapshot } from '@repfuel/shared';
import { createCliAdapter } from '../adapters/cli-adapter.js';
import { createMcpTokenService } from '../mcp/token-service.js';
import { fakeKv } from '../../../core/testing/fake-kv.js';

const userContext: UserContextSnapshot = {
  userId: 'user-1',
  username: 'alice',
  locale: 'de',
  timezone: 'UTC+02:00',
  tzOffsetMinutes: -120,
  currentDate: '2026-08-28',
  profile: null,
  latestWeightKg: null,
};

const messages: ChatMessageDto[] = [
  { id: 'm1', role: 'user', content: 'Wie viel wiege ich?', toolCalls: null, createdAt: '' },
];

function sseResponse(events: unknown[], status = 200): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } });
}

describe('cli adapter', () => {
  it('issues a scoped MCP token, forwards chunks and swallows sidecar done', async () => {
    const kv = fakeKv();
    const tokenService = createMcpTokenService(kv);
    const requests: { url: string; body?: unknown }[] = [];
    const adapter = createCliAdapter({
      config: { sidecarUrl: 'http://sidecar:8090', mcpUrl: 'http://app:8080/internal/mcp' },
      tokenService,
      fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        const parsed = JSON.parse(String(init?.body)) as { mcp: { token: string; url: string } };
        requests.push({ url: String(url), body: parsed });
        // Token muss zum Zeitpunkt des Sidecar-Aufrufs gültig sein und die Claims tragen
        const claims = await tokenService.verify(parsed.mcp.token);
        expect(claims).toEqual({ userId: 'user-1', chatSessionId: 'cs-1', tzOffsetMinutes: -120 });
        return sseResponse([
          { type: 'tool-call', toolName: 'get_weight_history', args: { from: 'a', to: 'b' } },
          { type: 'tool-result', toolName: 'get_weight_history', result: [{ weightKg: 81 }] },
          { type: 'text-delta', text: 'Du wiegst 81 kg.' },
          { type: 'done' },
        ]);
      }) as typeof fetch,
    });

    const chunks = [];
    for await (const c of adapter.chat({ sessionId: 'cs-1', messages, tools: {} as ToolSet, userContext })) {
      chunks.push(c);
    }

    expect(chunks.map((c) => c.type)).toEqual(['tool-call', 'tool-result', 'text-delta']);
    expect(requests[0]?.url).toBe('http://sidecar:8090/chat');
    const sent = requests[0]?.body as { chatSessionId: string; prompt: string; systemPrompt: string };
    expect(sent.chatSessionId).toBe('cs-1');
    expect(sent.prompt).toBe('Wie viel wiege ich?');
    expect(sent.systemPrompt).toContain('repfuel');
    // Token wird nach dem Turn widerrufen
    const token = (requests[0]?.body as { mcp: { token: string } }).mcp.token;
    expect(await tokenService.verify(token)).toBeNull();
  });

  it('yields a clear error when the sidecar is unreachable', async () => {
    const adapter = createCliAdapter({
      config: { sidecarUrl: 'http://sidecar:8090', mcpUrl: 'http://app:8080/internal/mcp' },
      tokenService: createMcpTokenService(fakeKv()),
      fetchImpl: (async () => {
        throw new TypeError('fetch failed');
      }) as typeof fetch,
    });
    const chunks = [];
    for await (const c of adapter.chat({ sessionId: 'cs-1', messages, tools: {} as ToolSet, userContext })) {
      chunks.push(c);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ type: 'error' });
  });

  it('healthCheck maps sidecar auth state', async () => {
    const adapter = createCliAdapter({
      config: { sidecarUrl: 'http://sidecar:8090', mcpUrl: 'http://app:8080/internal/mcp' },
      tokenService: createMcpTokenService(fakeKv()),
      fetchImpl: (async () =>
        new Response(JSON.stringify({ ok: false, authenticated: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })) as typeof fetch,
    });
    const status = await adapter.healthCheck();
    expect(status.provider).toBe('cli');
    expect(status.ok).toBe(false);
    expect(status.message).toContain('Nicht angemeldet');
  });
});
