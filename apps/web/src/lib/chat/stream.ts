import type { ChatChunk } from '@repfuel/shared';
import { ApiError } from '$lib/api.js';
import { createChatStreamParser } from './sse.js';

/**
 * Client für `POST /chat/sessions/:id/messages`. `EventSource` kann kein POST,
 * deshalb liest diese Funktion den `text/event-stream` direkt aus dem
 * `ReadableStream` der `fetch`-Response und schiebt ihn durch den reinen
 * Parser aus `sse.ts`.
 *
 * Fehlerkonvention wie in `api.ts`: `ApiError` = Server hat abgelehnt,
 * `TypeError` = Server nicht erreichbar (Offline/Netzwerk).
 */

const BASE_URL = '/api/v1';

export interface StreamChatMessageInput {
  sessionId: string;
  content: string;
  tzOffsetMinutes: number;
  /** Bricht den Stream ab (Navigation, Komponente unmounted). */
  signal?: AbortSignal;
}

function errorBodyOf(value: unknown): { error: string; message: string } {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.error === 'string' && typeof record.message === 'string') {
      return { error: record.error, message: record.message };
    }
  }
  return { error: 'unknown_error', message: 'Unknown error' };
}

/**
 * Sendet eine Nachricht und ruft `onChunk` für jeden empfangenen Chunk auf
 * (`text-delta`, `tool-call`, `tool-result`, `proposal`, `done`, `error`).
 * Läuft, bis der Server den Stream schließt.
 */
export async function streamChatMessage(
  input: StreamChatMessageInput,
  onChunk: (chunk: ChatChunk) => void,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/chat/sessions/${input.sessionId}/messages`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        content: input.content,
        tzOffsetMinutes: input.tzOffsetMinutes,
      }),
      signal: input.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new TypeError('network request failed', { cause });
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(response.status, errorBodyOf(body));
  }

  if (!response.body) {
    // Kein Streaming-fähiger Body (sehr alte Browser) — der Chat ist online-only,
    // hier bricht der Turn sauber ab statt still zu hängen.
    throw new TypeError('streaming response body unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createChatStreamParser();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const chunk of parser.push(decoder.decode(value, { stream: true }))) {
        onChunk(chunk);
      }
    }
    // Letzte Bytes des Decoders (Multi-Byte-Zeichen an der Puffergrenze).
    for (const chunk of parser.push(decoder.decode())) {
      onChunk(chunk);
    }
  } finally {
    reader.releaseLock();
  }
}
