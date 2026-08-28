import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@repfuel/shared';
import {
  createChatService,
  sanitizeSessionTitle,
  type ChatServiceDeps,
} from '../services/chat-service.js';
import { fakeChatRepo, scriptedAdapter } from './fakes.js';

const user: SessionUser = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'alice',
  role: 'user',
  locale: 'de',
  hasPassword: false,
};

function setup(adapter: ReturnType<typeof scriptedAdapter> | null) {
  const chatRepo = fakeChatRepo();
  const deps = {
    chatRepo,
    adapter,
    provider: adapter ? 'openai' : 'none',
    profileService: { get: vi.fn(async () => null) },
    weightService: { list: vi.fn(async () => []) },
    memoryService: { list: vi.fn(async () => []) },
    toolDeps: () => ({}),
    createProposal: vi.fn(),
  } as unknown as ChatServiceDeps;
  return { chatRepo, service: createChatService(deps) };
}

describe('sanitizeSessionTitle', () => {
  it('strips markdown, quotes and trailing punctuation', () => {
    expect(sanitizeSessionTitle('**"Trainingsplan für den Cut."**\n')).toBe(
      'Trainingsplan für den Cut',
    );
  });

  it('uses the first non-empty line and truncates long titles', () => {
    expect(sanitizeSessionTitle('\n\nGanzkörper-Split')).toBe('Ganzkörper-Split');
    expect(sanitizeSessionTitle('t'.repeat(90))).toHaveLength(60);
  });

  it('rejects empty results', () => {
    expect(sanitizeSessionTitle('  \n **_** ')).toBeNull();
  });
});

describe('ai status', () => {
  it('reports disabled without adapter (AI_PROVIDER=none)', async () => {
    const { service } = setup(null);
    expect(await service.status()).toEqual({ enabled: false, status: null });
  });

  it('reports adapter health when configured', async () => {
    const { service } = setup(scriptedAdapter([]));
    const status = await service.status();
    expect(status.enabled).toBe(true);
    expect(status.status?.model).toBe('test-model');
  });

  it('rejects chat operations when disabled', async () => {
    const { service } = setup(null);
    await expect(service.createSession(user.id)).rejects.toMatchObject({ code: 'ai_disabled' });
  });
});

describe('streamMessage', () => {
  it('persists user and assistant messages and streams chunks', async () => {
    const adapter = scriptedAdapter([
      { type: 'text-delta', text: 'Hallo ' },
      { type: 'tool-call', toolName: 'get_profile', args: {} },
      { type: 'tool-result', toolName: 'get_profile', result: { ok: true } },
      { type: 'text-delta', text: 'Alice!' },
    ]);
    const { service, chatRepo } = setup(adapter);
    const session = await service.createSession(user.id);

    const chunks = [];
    for await (const c of service.streamMessage({
      user,
      sessionId: session.id,
      content: 'Wie läuft mein Training?',
      tzOffsetMinutes: -120,
    })) {
      chunks.push(c);
    }

    expect(chunks.at(-1)?.type).toBe('done');
    const stored = chatRepo.messages;
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({ role: 'user', content: 'Wie läuft mein Training?' });
    expect(stored[1]).toMatchObject({ role: 'assistant', content: 'Hallo Alice!' });
    expect(stored[1]!.toolCalls).toEqual([
      { toolName: 'get_profile', args: {}, result: { ok: true } },
    ]);
    // Adapter bekam Verlauf + Kontext
    const call = adapter.calls[0] as { messages: unknown[]; userContext: { timezone: string } };
    expect(call.messages).toHaveLength(1);
    expect(call.userContext.timezone).toBe('UTC+02:00');
    // Titel: erst die gekürzte erste Nachricht, dann generiert der Adapter im
    // Hintergrund einen Kurztitel (hier aus denselben Skript-Chunks).
    await vi.waitFor(() => expect(chatRepo.sessions[0]!.title).toBe('Hallo Alice'));
    const titleCall = adapter.calls[1] as { messages: { content: string }[]; tools: unknown };
    expect(titleCall.tools).toEqual({});
    expect(titleCall.messages[0]!.content).toContain('Wie läuft mein Training?');
  });

  it('keeps the truncated first message as title when generation yields nothing', async () => {
    const adapter = scriptedAdapter([
      { type: 'tool-call', toolName: 'get_profile', args: {} },
      { type: 'tool-result', toolName: 'get_profile', result: { ok: true } },
    ]);
    const { service, chatRepo } = setup(adapter);
    const session = await service.createSession(user.id);
    for await (const _ of service.streamMessage({
      user,
      sessionId: session.id,
      content: 'x'.repeat(80),
      tzOffsetMinutes: 0,
    })) {
      void _;
    }
    await vi.waitFor(() => expect(adapter.calls).toHaveLength(2));
    expect(chatRepo.sessions[0]!.title).toBe(`${'x'.repeat(57)}…`);
  });

  it('propagates adapter errors and stores nothing for empty responses', async () => {
    const adapter = scriptedAdapter([{ type: 'error', message: 'boom' }]);
    const { service, chatRepo } = setup(adapter);
    const session = await service.createSession(user.id);
    const chunks = [];
    for await (const c of service.streamMessage({
      user,
      sessionId: session.id,
      content: 'Test',
      tzOffsetMinutes: 0,
    })) {
      chunks.push(c);
    }
    expect(chunks).toEqual([{ type: 'error', message: 'boom' }]);
    expect(chatRepo.messages.filter((m) => m.role === 'assistant')).toHaveLength(0);
  });

  it('rejects foreign sessions', async () => {
    const adapter = scriptedAdapter([]);
    const { service } = setup(adapter);
    const session = await service.createSession('00000000-0000-4000-8000-000000000099');
    await expect(async () => {
      const iter = service.streamMessage({
        user,
        sessionId: session.id,
        content: 'x',
        tzOffsetMinutes: 0,
      });
      for await (const _ of iter) {
        void _;
      }
    }).rejects.toMatchObject({ code: 'not_found' });
  });
});
