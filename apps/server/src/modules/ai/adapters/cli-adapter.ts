import type { AIAdapter, AdapterStatus, AiProvider, ChatChunk } from '@repfuel/shared';
import { buildSystemPrompt } from '../system-prompt.js';
import type { McpTokenService } from '../mcp/token-service.js';

export interface CliAdapterConfig {
  /** Konfigurierter Provider (cli | claude-local | codex-local) — für den Status. */
  provider?: AiProvider;
  /** HTTP-Endpunkt des Sidecars (nur im Compose-Netz erreichbar). */
  sidecarUrl: string;
  /** URL, unter der der Sidecar den MCP-Wrapper des Backends erreicht. */
  mcpUrl: string;
}

export interface CliAdapterDeps {
  config: CliAdapterConfig;
  tokenService: McpTokenService;
  fetchImpl?: typeof fetch;
}

function parseSseLines(buffer: string): { events: string[]; rest: string } {
  const frames = buffer.split('\n\n');
  const rest = frames.pop() ?? '';
  const events: string[] = [];
  for (const frame of frames) {
    for (const line of frame.split('\n')) {
      if (line.startsWith('data:')) events.push(line.slice(5).trim());
    }
  }
  return { events, rest };
}

/**
 * Adapter 3: CLI-Sidecar (Claude Code über das Agent SDK). Das Backend stellt
 * pro Chat-Turn ein kurzlebiges MCP-Token aus; der Sidecar bindet den
 * MCP-Wrapper ein — dadurch gibt es keine zweite Tool-Implementierung.
 */
export function createCliAdapter(deps: CliAdapterDeps): AIAdapter {
  const doFetch = deps.fetchImpl ?? fetch;

  return {
    async *chat(input): AsyncIterable<ChatChunk> {
      const lastUser = [...input.messages].reverse().find((m) => m.role === 'user');
      if (!lastUser) {
        yield { type: 'error', message: 'no user message' };
        return;
      }
      const token = await deps.tokenService.issue({
        userId: input.userContext.userId,
        chatSessionId: input.sessionId,
        tzOffsetMinutes: input.userContext.tzOffsetMinutes,
      });
      try {
        const res = await doFetch(`${deps.config.sidecarUrl.replace(/\/$/, '')}/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chatSessionId: input.sessionId,
            prompt: lastUser.content,
            systemPrompt: buildSystemPrompt(input.userContext),
            mcp: { url: deps.config.mcpUrl, token },
          }),
        });
        if (!res.ok || !res.body) {
          yield { type: 'error', message: `CLI-Sidecar antwortet nicht (HTTP ${res.status})` };
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = parseSseLines(buffer);
          buffer = rest;
          for (const event of events) {
            let chunk: ChatChunk;
            try {
              chunk = JSON.parse(event) as ChatChunk;
            } catch {
              continue;
            }
            if (chunk.type === 'done') continue; // finales done setzt der Chat-Service
            yield chunk;
          }
        }
      } catch (err) {
        yield {
          type: 'error',
          message: err instanceof Error ? `CLI-Sidecar nicht erreichbar: ${err.message}` : 'CLI-Sidecar nicht erreichbar',
        };
      } finally {
        await deps.tokenService.revoke(token);
      }
    },

    async healthCheck(): Promise<AdapterStatus> {
      const base: AdapterStatus = {
        provider: deps.config.provider ?? 'cli',
        configured: true,
        ok: false,
        model: null,
        message: null,
      };
      try {
        const res = await doFetch(`${deps.config.sidecarUrl.replace(/\/$/, '')}/health`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return { ...base, message: `Sidecar HTTP ${res.status}` };
        const health = (await res.json()) as {
          ok: boolean;
          authenticated: boolean;
          pending?: boolean;
          message?: string;
          model?: string;
        };
        if (health.pending) {
          // Die Probe läuft noch (Kaltstart) — kein Fehler, nur noch kein Ergebnis.
          return {
            ...base,
            model: health.model ?? null,
            message: health.message ?? 'Anmeldeprüfung läuft — Status gleich neu laden.',
          };
        }
        return {
          ...base,
          ok: health.ok && health.authenticated,
          model: health.model ?? 'claude-code',
          message: health.authenticated
            ? (health.message ?? null)
            : (health.message ?? 'Nicht angemeldet — siehe docs/AI_CLI.md (Auth-Wege)'),
        };
      } catch {
        return { ...base, message: 'CLI-Sidecar nicht erreichbar — läuft das Compose-Profil cli-adapter?' };
      }
    },
  };
}
