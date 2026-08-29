import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatChunk } from '@repfuel/shared';
import { ApiError } from '$lib/api.js';
import { streamChatMessage } from './stream.js';

/** Baut eine Response, deren Body die übergebenen Stücke nacheinander liefert. */
function sseResponse(pieces: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('streamChatMessage', () => {
  it('liefert die Chunks eines zerteilten Streams in Reihenfolge', async () => {
    const fetchMock = vi.fn(async () =>
      sseResponse([
        ': stream start\n\n',
        'data: {"type":"tool-call","toolName":"get_profile","args":{}}\n\n',
        'data: {"type":"text-de',
        'lta","text":"Moin"}\n\n: ping\n\n',
        'data: {"type":"done","messageId":"m1"}\n\n',
      ]),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const chunks: ChatChunk[] = [];
    await streamChatMessage(
      { sessionId: 's1', content: 'Hi', tzOffsetMinutes: -60 },
      (chunk) => chunks.push(chunk),
    );

    expect(chunks).toEqual([
      { type: 'tool-call', toolName: 'get_profile', args: {} },
      { type: 'text-delta', text: 'Moin' },
      { type: 'done', messageId: 'm1' },
    ]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/chat/sessions/s1/messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ content: 'Hi', tzOffsetMinutes: -60 });
  });

  it('wirft einen ApiError, wenn der Server ablehnt', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'ai_disabled', message: 'No AI adapter' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    await expect(
      streamChatMessage({ sessionId: 's1', content: 'Hi', tzOffsetMinutes: 0 }, () => {}),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('wirft einen TypeError, wenn der Server nicht erreichbar ist', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;

    await expect(
      streamChatMessage({ sessionId: 's1', content: 'Hi', tzOffsetMinutes: 0 }, () => {}),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
