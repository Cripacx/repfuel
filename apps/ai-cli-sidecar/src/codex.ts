import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mapCodexEventLine, type SidecarChunk } from './codex-events.js';

/**
 * Codex-Runtime: ein `codex exec --json`-Prozess pro Chat-Turn.
 * - MCP-Anbindung per Config-Override (`-c mcp_servers.repfuel.*`), das
 *   kurzlebige Token wandert als Env-Variable, nie als Prozess-Argument.
 * - Sitzungs-Fortsetzung über `codex exec resume <threadId>`.
 * - Sandbox read-only: der Coach braucht keine Datei-/Shell-Zugriffe.
 */

export interface CodexTurnInput {
  prompt: string;
  systemPrompt: string;
  resumeThreadId: string | null;
  mcp: { url: string; token: string };
  model: string | null;
}

export interface CodexRunResult {
  threadId: string | null;
  sawDone: boolean;
}

const MCP_TOKEN_ENV = 'REPFUEL_MCP_TOKEN';

export function buildCodexArgs(input: CodexTurnInput): string[] {
  const args = ['exec', '--json', '--skip-git-repo-check', '--sandbox', 'read-only'];
  if (input.model) args.push('--model', input.model);
  args.push('-c', `mcp_servers.repfuel.url=${JSON.stringify(input.mcp.url)}`);
  args.push('-c', `mcp_servers.repfuel.bearer_token_env_var=${JSON.stringify(MCP_TOKEN_ENV)}`);
  if (input.resumeThreadId) {
    args.push('resume', input.resumeThreadId);
  }
  // Codex kennt keinen separaten System-Prompt-Kanal — beim ersten Turn wird
  // er dem Prompt vorangestellt; Folge-Turns hängen an der Session.
  const prompt = input.resumeThreadId
    ? input.prompt
    : `${input.systemPrompt}\n\n---\n\n${input.prompt}`;
  args.push(prompt);
  return args;
}

export async function runCodexTurn(
  input: CodexTurnInput,
  emit: (chunk: SidecarChunk) => void,
): Promise<CodexRunResult> {
  const child = spawn('codex', buildCodexArgs(input), {
    env: {
      ...process.env,
      [MCP_TOKEN_ENV]: input.mcp.token,
      // API-Key-Auth (optional): CODEX_API_KEY aus der .env wird zu OPENAI_API_KEY;
      // alternativ liegt ein `codex login` im gemounteten CODEX_HOME.
      ...(process.env.CODEX_API_KEY ? { OPENAI_API_KEY: process.env.CODEX_API_KEY } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let threadId: string | null = null;
  let sawDone = false;
  let stderr = '';
  child.stderr.on('data', (c: Buffer) => {
    stderr += c.toString();
  });

  const rl = createInterface({ input: child.stdout });
  for await (const line of rl) {
    const mapped = mapCodexEventLine(line);
    if (mapped.threadId) threadId = mapped.threadId;
    for (const chunk of mapped.chunks) {
      if (chunk.type === 'done') sawDone = true;
      emit(chunk);
    }
  }

  const exitCode: number = await new Promise((resolve) => child.on('close', resolve));
  if (exitCode !== 0 && !sawDone) {
    emit({
      type: 'error',
      message: `codex exec exit ${exitCode}: ${stderr.trim().slice(0, 500) || 'unbekannter Fehler'}`,
    });
  } else if (!sawDone) {
    emit({ type: 'done' });
    sawDone = true;
  }
  return { threadId, sawDone };
}

/** Auth-/Lauffähigkeits-Probe: ein Mini-Turn ohne MCP, mit hartem Timeout. */
export async function codexHealthProbe(
  model: string | null,
  timeoutMs = 90_000,
): Promise<{
  ok: boolean;
  message?: string;
}> {
  return new Promise((resolve) => {
    const args = ['exec', '--json', '--skip-git-repo-check', '--sandbox', 'read-only'];
    if (model) args.push('--model', model);
    args.push('Reply with exactly: OK');
    const child = spawn('codex', args, {
      env: {
        ...process.env,
        ...(process.env.CODEX_API_KEY ? { OPENAI_API_KEY: process.env.CODEX_API_KEY } : {}),
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    let stderr = '';
    child.stderr.on('data', (c: Buffer) => {
      stderr += c.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, message: `codex nicht startbar: ${err.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({
          ok: false,
          message: `Anmeldeprüfung nach ${timeoutMs / 1000}s abgebrochen — Auth prüfen (docs/AI_CLI.md)`,
        });
        return;
      }
      resolve(
        code === 0
          ? { ok: true }
          : { ok: false, message: stderr.trim().slice(0, 300) || `codex exec exit ${code}` },
      );
    });
  });
}
