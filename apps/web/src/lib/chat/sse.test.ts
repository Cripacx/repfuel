import { describe, expect, it } from 'vitest';
import type { ProposalDto } from '@repfuel/shared';
import { createChatStreamParser, isChatChunk, parseSseBuffer } from './sse.js';

function frame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

const proposal: ProposalDto = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'update_profile',
  summary: 'Kalorienziel auf 2400 kcal anheben.',
  payload: { changes: { kcalTarget: 2400 } },
  status: 'pending',
  createdAt: '2026-08-28T10:00:00.000Z',
};

describe('parseSseBuffer', () => {
  it('parst einen einzelnen vollständigen Frame', () => {
    const result = parseSseBuffer(frame({ type: 'text-delta', text: 'Hallo' }));
    expect(result.chunks).toEqual([{ type: 'text-delta', text: 'Hallo' }]);
    expect(result.rest).toBe('');
  });

  it('parst mehrere Frames aus einem Puffer', () => {
    const result = parseSseBuffer(
      frame({ type: 'text-delta', text: 'A' }) +
        frame({ type: 'text-delta', text: 'B' }) +
        frame({ type: 'done', messageId: 'm1' }),
    );
    expect(result.chunks).toEqual([
      { type: 'text-delta', text: 'A' },
      { type: 'text-delta', text: 'B' },
      { type: 'done', messageId: 'm1' },
    ]);
    expect(result.rest).toBe('');
  });

  it('gibt einen unvollständigen Frame als Rest zurück', () => {
    const result = parseSseBuffer(`${frame({ type: 'text-delta', text: 'A' })}data: {"type":"te`);
    expect(result.chunks).toHaveLength(1);
    expect(result.rest).toBe('data: {"type":"te');
  });

  it('ignoriert Heartbeat-/Kommentarzeilen', () => {
    const result = parseSseBuffer(
      `: stream start\n\n: ping\n\n${frame({ type: 'text-delta', text: 'A' })}`,
    );
    expect(result.chunks).toEqual([{ type: 'text-delta', text: 'A' }]);
  });

  it('versteht CRLF-Zeilenenden', () => {
    const result = parseSseBuffer(
      ': ping\r\n\r\ndata: {"type":"done","messageId":"m9"}\r\n\r\n',
    );
    expect(result.chunks).toEqual([{ type: 'done', messageId: 'm9' }]);
    expect(result.rest).toBe('');
  });

  it('verbindet mehrere data-Zeilen eines Frames mit \\n', () => {
    const result = parseSseBuffer('data: {"type":"text-delta",\ndata: "text":"A\\nB"}\n\n');
    expect(result.chunks).toEqual([{ type: 'text-delta', text: 'A\nB' }]);
  });

  it('akzeptiert data-Zeilen ohne Leerzeichen nach dem Doppelpunkt', () => {
    const result = parseSseBuffer('data:{"type":"error","message":"kaputt"}\n\n');
    expect(result.chunks).toEqual([{ type: 'error', message: 'kaputt' }]);
  });

  it('überspringt defektes JSON, ohne den Stream zu verwerfen', () => {
    const result = parseSseBuffer(
      `data: {kein json}\n\n${frame({ type: 'text-delta', text: 'A' })}`,
    );
    expect(result.chunks).toEqual([{ type: 'text-delta', text: 'A' }]);
  });

  it('verwirft Chunks mit unbekanntem oder unvollständigem Typ', () => {
    const result = parseSseBuffer(
      frame({ type: 'nope', text: 'A' }) +
        frame({ type: 'text-delta' }) +
        frame({ type: 'done', messageId: 'm1' }),
    );
    expect(result.chunks).toEqual([{ type: 'done', messageId: 'm1' }]);
  });

  it('parst Tool- und Proposal-Chunks', () => {
    const result = parseSseBuffer(
      frame({ type: 'tool-call', toolName: 'get_nutrition_summary', args: { from: '2026-08-01' } }) +
        frame({ type: 'tool-result', toolName: 'get_nutrition_summary', result: { kcal: 2100 } }) +
        frame({ type: 'proposal', proposal }),
    );
    expect(result.chunks).toEqual([
      { type: 'tool-call', toolName: 'get_nutrition_summary', args: { from: '2026-08-01' } },
      { type: 'tool-result', toolName: 'get_nutrition_summary', result: { kcal: 2100 } },
      { type: 'proposal', proposal },
    ]);
  });

  it('verwirft Proposal-Chunks mit unbekannter Art', () => {
    const result = parseSseBuffer(
      frame({ type: 'proposal', proposal: { ...proposal, kind: 'delete_everything' } }),
    );
    expect(result.chunks).toEqual([]);
  });

  it('liefert für einen leeren Puffer nichts', () => {
    expect(parseSseBuffer('')).toEqual({ chunks: [], rest: '' });
  });
});

describe('createChatStreamParser', () => {
  it('setzt zerteilte Frames über mehrere Pushes hinweg zusammen', () => {
    const parser = createChatStreamParser();
    const full = frame({ type: 'text-delta', text: 'Guten Morgen' });
    const cut = 12;

    expect(parser.push(full.slice(0, cut))).toEqual([]);
    expect(parser.pending()).toBe(full.slice(0, cut));
    expect(parser.push(full.slice(cut))).toEqual([
      { type: 'text-delta', text: 'Guten Morgen' },
    ]);
    expect(parser.pending()).toBe('');
  });

  it('verarbeitet einen Stream, dessen Chunk-Grenzen mitten im Trennzeichen liegen', () => {
    const parser = createChatStreamParser();
    const collected = [
      ...parser.push('data: {"type":"text-delta","text":"A"}\n'),
      ...parser.push('\n: ping\n'),
      ...parser.push('\ndata: {"type":"done","messageId":"m2"}\n\n'),
    ];
    expect(collected).toEqual([
      { type: 'text-delta', text: 'A' },
      { type: 'done', messageId: 'm2' },
    ]);
  });

  it('behält den Rest, solange kein Frame abgeschlossen ist', () => {
    const parser = createChatStreamParser();
    expect(parser.push('data: {"type":"tex')).toEqual([]);
    expect(parser.push('t-delta","text":"x"}')).toEqual([]);
    expect(parser.pending()).toBe('data: {"type":"text-delta","text":"x"}');
    expect(parser.push('\n\n')).toEqual([{ type: 'text-delta', text: 'x' }]);
  });
});

describe('isChatChunk', () => {
  it('lehnt Nicht-Objekte ab', () => {
    expect(isChatChunk(null)).toBe(false);
    expect(isChatChunk('text-delta')).toBe(false);
    expect(isChatChunk(42)).toBe(false);
  });

  it('erkennt gültige Chunks', () => {
    expect(isChatChunk({ type: 'error', message: 'x' })).toBe(true);
    expect(isChatChunk({ type: 'proposal', proposal })).toBe(true);
  });
});
