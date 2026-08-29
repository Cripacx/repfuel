/**
 * Mapping der `codex exec --json`-Ereignisse (JSONL, ein Event pro Zeile) auf
 * das repfuel-ChatChunk-Format. Als reine Funktion gehalten, damit das
 * fragilste Stück der Codex-Anbindung (fremdes Wire-Format) testbar ist.
 */

export type SidecarChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolName: string; args: unknown }
  | { type: 'tool-result'; toolName: string; result: unknown }
  | { type: 'error'; message: string }
  | { type: 'done' };

export interface CodexMapResult {
  chunks: SidecarChunk[];
  /** Thread-ID aus thread.started — für `codex exec resume` im nächsten Turn. */
  threadId?: string;
}

interface CodexItem {
  type?: string;
  text?: string;
  tool?: string;
  server?: string;
  arguments?: unknown;
  result?: unknown;
  status?: string;
}

interface CodexEvent {
  type?: string;
  thread_id?: string;
  item?: CodexItem;
  error?: { message?: string } | string;
  message?: string;
}

function errorMessage(event: CodexEvent): string {
  if (typeof event.error === 'string') return event.error;
  return event.error?.message ?? event.message ?? 'codex failed';
}

export function mapCodexEventLine(line: string): CodexMapResult {
  const trimmed = line.trim();
  if (!trimmed) return { chunks: [] };

  let event: CodexEvent;
  try {
    event = JSON.parse(trimmed) as CodexEvent;
  } catch {
    // Codex schreibt gelegentlich Nicht-JSON auf stdout (z.B. Update-Hinweise) —
    // ignorieren statt den Stream zu killen.
    return { chunks: [] };
  }

  switch (event.type) {
    case 'thread.started':
      return { chunks: [], threadId: event.thread_id };
    case 'item.started':
    case 'item.updated': {
      if (event.item?.type === 'mcp_tool_call' && event.type === 'item.started') {
        return {
          chunks: [
            {
              type: 'tool-call',
              toolName: event.item.tool ?? 'unknown',
              args: event.item.arguments ?? {},
            },
          ],
        };
      }
      return { chunks: [] };
    }
    case 'item.completed': {
      const item = event.item;
      if (item?.type === 'agent_message' && item.text) {
        return { chunks: [{ type: 'text-delta', text: item.text }] };
      }
      if (item?.type === 'mcp_tool_call') {
        return {
          chunks: [
            {
              type: 'tool-result',
              toolName: item.tool ?? 'unknown',
              result: item.result ?? item.status ?? null,
            },
          ],
        };
      }
      return { chunks: [] };
    }
    case 'turn.completed':
      return { chunks: [{ type: 'done' }] };
    case 'turn.failed':
    case 'error':
      return { chunks: [{ type: 'error', message: errorMessage(event) }] };
    default:
      return { chunks: [] };
  }
}
