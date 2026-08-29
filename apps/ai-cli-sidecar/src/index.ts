import http from 'node:http';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { resolveCliAuthEnv } from './auth-env.js';
import { codexHealthProbe, runCodexTurn } from './codex.js';
import { createSessionStore } from './session-store.js';

/**
 * repfuel CLI-Sidecar: kleine HTTP-API um eine lokale Coding-Agent-CLI.
 * POST /chat  → SSE-Stream (ChatChunk-JSON pro data:-Zeile)
 * GET  /health → { ok, authenticated, message?, model? }
 *
 * Runtime per Env: AI_PROVIDER=codex-local → Codex CLI (OpenAI),
 * alles andere → Claude Code (Agent SDK). AI_MODEL wählt das Modell der
 * jeweiligen CLI (leer = Default der CLI).
 *
 * Tools kommen ausschließlich über den MCP-Wrapper des Backends
 * (kurzlebiges Token pro Chat-Turn) — keine zweite Tool-Implementierung,
 * keine Dateisystem-/Bash-Tools für den Coach.
 */
const PORT = Number(process.env.PORT ?? 8090);
const MCP_SERVER_NAME = 'repfuel';
const RUNTIME: 'claude' | 'codex' = process.env.AI_PROVIDER === 'codex-local' ? 'codex' : 'claude';
const MODEL = process.env.AI_MODEL?.trim() || null;

// Eine .env-Variable reicht: AI_API_KEY wird auf die CLI-eigene Auth-Variable
// abgebildet (spezifische Variablen gewinnen).
Object.assign(process.env, resolveCliAuthEnv(RUNTIME, process.env));

const sessions = createSessionStore();

interface ChatRequest {
  chatSessionId: string;
  prompt: string;
  systemPrompt: string;
  mcp: { url: string; token: string };
}

function sse(res: http.ServerResponse, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function stripToolPrefix(name: string): string {
  return name.replace(new RegExp(`^mcp__${MCP_SERVER_NAME}__`), '');
}

async function handleCodexChat(body: ChatRequest, res: http.ServerResponse): Promise<void> {
  try {
    const result = await runCodexTurn(
      {
        prompt: body.prompt,
        systemPrompt: body.systemPrompt,
        resumeThreadId: sessions.get(body.chatSessionId) ?? null,
        mcp: body.mcp,
        model: MODEL,
      },
      (chunk) => sse(res, chunk),
    );
    if (result.threadId) sessions.set(body.chatSessionId, result.threadId);
  } catch (err) {
    sse(res, { type: 'error', message: err instanceof Error ? err.message : 'codex failed' });
  } finally {
    res.end();
  }
}

async function handleChat(body: ChatRequest, res: http.ServerResponse): Promise<void> {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  });

  if (RUNTIME === 'codex') {
    await handleCodexChat(body, res);
    return;
  }

  const resume = sessions.get(body.chatSessionId) ?? undefined;
  const toolNamesById = new Map<string, string>();

  try {
    const stream = query({
      prompt: body.prompt,
      options: {
        resume,
        systemPrompt: body.systemPrompt,
        model: MODEL ?? undefined,
        maxTurns: 16,
        settingSources: [],
        mcpServers: {
          [MCP_SERVER_NAME]: {
            type: 'http',
            url: body.mcp.url,
            headers: { Authorization: `Bearer ${body.mcp.token}` },
          },
        },
        // Nur die repfuel-MCP-Tools — keine Datei-/Shell-/Web-Tools im Coach.
        allowedTools: [`mcp__${MCP_SERVER_NAME}`],
        disallowedTools: [
          'Bash',
          'Read',
          'Write',
          'Edit',
          'Glob',
          'Grep',
          'WebFetch',
          'WebSearch',
          'NotebookEdit',
          'Task',
          'TodoWrite',
        ],
        permissionMode: 'bypassPermissions',
      },
    });

    for await (const msg of stream) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        sessions.set(body.chatSessionId, msg.session_id);
      } else if (msg.type === 'assistant') {
        for (const block of msg.message.content) {
          if (block.type === 'text' && block.text.length > 0) {
            sse(res, { type: 'text-delta', text: block.text });
          } else if (block.type === 'tool_use') {
            toolNamesById.set(block.id, stripToolPrefix(block.name));
            sse(res, {
              type: 'tool-call',
              toolName: stripToolPrefix(block.name),
              args: block.input,
            });
          }
        }
      } else if (msg.type === 'user' && typeof msg.message.content !== 'string') {
        for (const block of msg.message.content) {
          if (block.type === 'tool_result') {
            const toolName = toolNamesById.get(block.tool_use_id) ?? 'unknown';
            let result: unknown = block.content;
            if (Array.isArray(block.content)) {
              const text = (block.content as unknown[])
                .filter(
                  (c): c is { type: 'text'; text: string } =>
                    typeof c === 'object' && c !== null && (c as { type?: string }).type === 'text',
                )
                .map((c) => c.text)
                .join('');
              try {
                result = JSON.parse(text);
              } catch {
                result = text;
              }
            }
            sse(res, { type: 'tool-result', toolName, result });
          }
        }
      } else if (msg.type === 'result') {
        if (msg.is_error) {
          sse(res, { type: 'error', message: msg.subtype });
        }
        sse(res, { type: 'done' });
      }
    }
  } catch (err) {
    sse(res, { type: 'error', message: err instanceof Error ? err.message : 'sidecar failed' });
  } finally {
    res.end();
  }
}

// Auth-Status: der Test-Aufruf kostet einen echten API-Call und kann beim
// Kaltstart oder mit kaputtem Token lange dauern. /health blockiert deshalb
// NIE länger als HEALTH_WAIT_MS: die Probe läuft im Hintergrund weiter, bis
// dahin wird `pending` gemeldet; die Probe selbst hat ein hartes Timeout.
interface HealthBody {
  ok: boolean;
  authenticated: boolean;
  pending?: boolean;
  message?: string;
  model?: string;
}

let healthCache: { at: number; body: HealthBody } | null = null;
let healthInFlight: Promise<HealthBody> | null = null;
const HEALTH_TTL_MS = 10 * 60 * 1000;
const HEALTH_WAIT_MS = 5_000;
const PROBE_TIMEOUT_MS = 90_000;

async function runHealthProbe(): Promise<HealthBody> {
  if (RUNTIME === 'codex') {
    const probe = await codexHealthProbe(MODEL, PROBE_TIMEOUT_MS);
    return probe.ok
      ? { ok: true, authenticated: true, model: MODEL ?? undefined }
      : { ok: false, authenticated: false, message: probe.message };
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), PROBE_TIMEOUT_MS);
  try {
    const stream = query({
      prompt: 'Reply with exactly: OK',
      options: {
        maxTurns: 1,
        settingSources: [],
        disallowedTools: ['Bash', 'Read', 'Write'],
        model: MODEL ?? undefined,
        abortController: abort,
      },
    });
    let model: string | undefined;
    let succeeded = false;
    for await (const msg of stream) {
      if (msg.type === 'system' && msg.subtype === 'init') model = msg.model;
      if (msg.type === 'result') succeeded = !msg.is_error;
    }
    return succeeded
      ? { ok: true, authenticated: true, model }
      : { ok: false, authenticated: false, message: 'Testaufruf fehlgeschlagen — Login prüfen' };
  } catch (err) {
    if (abort.signal.aborted) {
      return {
        ok: false,
        authenticated: false,
        message: `Anmeldeprüfung nach ${PROBE_TIMEOUT_MS / 1000}s abgebrochen — Token/Netzwerk prüfen (docs/AI_CLI.md)`,
      };
    }
    return {
      ok: false,
      authenticated: false,
      message: err instanceof Error ? err.message : 'Claude Code nicht nutzbar',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function handleHealth(res: http.ServerResponse): Promise<void> {
  if (healthCache && Date.now() - healthCache.at < HEALTH_TTL_MS) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(healthCache.body));
    return;
  }
  if (!healthInFlight) {
    const probe = runHealthProbe()
      .then((body) => {
        healthCache = { at: Date.now(), body };
        return body;
      })
      .finally(() => {
        healthInFlight = null;
      });
    // Unbeobachtete Rejections abfangen — das Ergebnis holt sich der nächste Aufruf.
    probe.catch(() => {});
    healthInFlight = probe;
  }
  const pending: HealthBody = {
    ok: false,
    authenticated: false,
    pending: true,
    message: 'Anmeldeprüfung läuft — Status gleich neu laden.',
  };
  const body = await Promise.race([
    healthInFlight.catch(
      (err): HealthBody => ({
        ok: false,
        authenticated: false,
        message: err instanceof Error ? err.message : 'health probe failed',
      }),
    ),
    new Promise<HealthBody>((resolve) => setTimeout(() => resolve(pending), HEALTH_WAIT_MS)),
  ]);
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    void handleHealth(res);
    return;
  }
  if (req.method === 'POST' && req.url === '/chat') {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString()));
    req.on('end', () => {
      try {
        const body = JSON.parse(raw) as ChatRequest;
        if (!body.chatSessionId || !body.prompt || !body.mcp?.url || !body.mcp.token) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'bad_request' }));
          return;
        }
        void handleChat(body, res);
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_json' }));
      }
    });
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(PORT, () => {
  console.log(
    `repfuel ai-cli-sidecar listening on :${PORT} (runtime: ${RUNTIME}${MODEL ? `, model: ${MODEL}` : ''})`,
  );
});
