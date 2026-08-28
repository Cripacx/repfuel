import { PROPOSAL_KINDS, type ChatChunk, type ProposalDto } from '@repfuel/shared';

/**
 * SSE-Parsing für den Chat-Stream (`POST /chat/sessions/:id/messages`).
 *
 * Bewusst ohne DOM-/Netzwerk-Abhängigkeit: der Parser bekommt reine Strings und
 * liefert `ChatChunk`s zurück, damit er unabhängig vom `fetch`-Reader testbar
 * bleibt (`EventSource` scheidet aus, weil der Endpoint POST ist).
 *
 * Verarbeitet wird das Format, das `apps/server/src/modules/ai/routes.ts`
 * schreibt: Frames enden auf `\n\n`, Nutzdaten stehen in `data:`-Zeilen,
 * Kommentarzeilen (`: ping`, `: stream start`) sind Heartbeats ohne Inhalt.
 */

/** Ergebnis eines Parse-Durchlaufs: vollständige Chunks + unvollständiger Rest. */
export interface SseParseResult {
  chunks: ChatChunk[];
  /** Angefangener Frame, der noch auf weitere Bytes wartet. */
  rest: string;
}

const FRAME_SEPARATOR = /\r?\n\r?\n/;
const LINE_SEPARATOR = /\r?\n/;

function isProposalDto(value: unknown): value is ProposalDto {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.kind === 'string' &&
    (PROPOSAL_KINDS as readonly string[]).includes(record.kind) &&
    typeof record.summary === 'string' &&
    typeof record.status === 'string' &&
    typeof record.createdAt === 'string'
  );
}

/**
 * Prüft eine geparste JSON-Payload gegen die `ChatChunk`-Union. Unbekannte oder
 * unvollständige Chunks werden verworfen statt geraten — der Chat zeigt lieber
 * einen Chunk weniger als kaputte Daten.
 */
export function isChatChunk(value: unknown): value is ChatChunk {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  switch (record.type) {
    case 'text-delta':
      return typeof record.text === 'string';
    case 'tool-call':
      return typeof record.toolName === 'string';
    case 'tool-result':
      return typeof record.toolName === 'string';
    case 'proposal':
      return isProposalDto(record.proposal);
    case 'done':
      return typeof record.messageId === 'string';
    case 'error':
      return typeof record.message === 'string';
    default:
      return false;
  }
}

/**
 * Extrahiert die Nutzdaten eines Frames. Kommentarzeilen (Heartbeat) und
 * Felder außer `data:` werden übersprungen; mehrere `data:`-Zeilen werden
 * gemäß SSE-Spec mit `\n` verbunden. `null` = kein Datenfeld im Frame.
 */
function frameData(frame: string): string | null {
  const parts: string[] = [];
  for (const line of frame.split(LINE_SEPARATOR)) {
    if (line === '' || line.startsWith(':')) continue;
    if (!line.startsWith('data:')) continue;
    const value = line.slice('data:'.length);
    parts.push(value.startsWith(' ') ? value.slice(1) : value);
  }
  return parts.length === 0 ? null : parts.join('\n');
}

/**
 * Parst einen (möglicherweise mitten im Frame abgeschnittenen) Puffer.
 * Rein — der Aufrufer hält `rest` und hängt die nächsten Bytes davor.
 */
export function parseSseBuffer(buffer: string): SseParseResult {
  const segments = buffer.split(FRAME_SEPARATOR);
  const rest = segments.pop() ?? '';
  const chunks: ChatChunk[] = [];

  for (const frame of segments) {
    const data = frameData(frame);
    if (data === null || data === '') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      // Defekter Frame (z. B. abgebrochene Verbindung mitten im JSON) —
      // überspringen statt den ganzen Stream zu verwerfen.
      continue;
    }
    if (isChatChunk(parsed)) chunks.push(parsed);
  }

  return { chunks, rest };
}

export interface ChatStreamParser {
  /** Nächstes Netzwerk-Stück einspeisen; liefert die dadurch vollständigen Chunks. */
  push(text: string): ChatChunk[];
  /** Verbleibender, unvollständiger Frame (für Tests/Diagnose). */
  pending(): string;
}

/** Zustandsbehafteter Wrapper um {@link parseSseBuffer} für einen laufenden Stream. */
export function createChatStreamParser(): ChatStreamParser {
  let buffer = '';
  return {
    push(text: string): ChatChunk[] {
      buffer += text;
      const { chunks, rest } = parseSseBuffer(buffer);
      buffer = rest;
      return chunks;
    },
    pending(): string {
      return buffer;
    },
  };
}
