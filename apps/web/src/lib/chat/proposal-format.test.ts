import { describe, expect, it } from 'vitest';
import { formatProposalPayload, humanizeKey } from './proposal-format.js';

describe('formatProposalPayload', () => {
  it('flacht einen Profil-Vorschlag zu Feld/Wert-Paaren ab', () => {
    const fields = formatProposalPayload({
      changes: { kcalTarget: 2400, proteinTargetG: 165, goal: 'cut' },
    });

    expect(fields).toEqual([
      { path: ['changes'], key: 'changes', depth: 0, value: null, index: null },
      {
        path: ['changes', 'kcalTarget'],
        key: 'kcalTarget',
        depth: 1,
        value: { kind: 'number', text: '2400' },
        index: null,
      },
      {
        path: ['changes', 'proteinTargetG'],
        key: 'proteinTargetG',
        depth: 1,
        value: { kind: 'number', text: '165' },
        index: null,
      },
      {
        path: ['changes', 'goal'],
        key: 'goal',
        depth: 1,
        value: { kind: 'text', text: 'cut' },
        index: null,
      },
    ]);
  });

  it('nummeriert Listeneinträge und rückt ihre Felder ein', () => {
    const fields = formatProposalPayload({
      routineId: 'r-1',
      changes: {
        items: [
          { exerciseId: 'e-1', targetSets: 4 },
          { exerciseId: 'e-2', targetSets: 3 },
        ],
      },
    });

    const list = fields.find((f) => f.key === 'items' && f.index === null);
    expect(list?.value).toBeNull();

    const firstItem = fields.find((f) => f.index === 1 && f.value === null);
    expect(firstItem?.path).toEqual(['changes', 'items', '0']);
    expect(firstItem?.depth).toBe(2);

    const sets = fields.filter((f) => f.key === 'targetSets');
    expect(sets.map((f) => f.value)).toEqual([
      { kind: 'number', text: '4' },
      { kind: 'number', text: '3' },
    ]);
    expect(sets.every((f) => f.depth === 3)).toBe(true);
  });

  it('markiert null, leere Strings, leere Objekte und leere Listen als leer', () => {
    const fields = formatProposalPayload({
      weekday: null,
      note: '   ',
      meta: {},
      items: [],
    });

    expect(fields.map((f) => f.value)).toEqual([
      { kind: 'empty' },
      { kind: 'empty' },
      { kind: 'empty' },
      { kind: 'empty' },
    ]);
    expect(fields.map((f) => f.key)).toEqual(['weekday', 'note', 'meta', 'items']);
  });

  it('behält Booleans als Booleans (Anzeige übersetzt die Komponente)', () => {
    const fields = formatProposalPayload({ isWarmup: false });
    expect(fields[0]?.value).toEqual({ kind: 'boolean', value: false });
  });

  it('rundet Kommazahlen auf zwei Stellen und filtert NaN/Infinity', () => {
    const fields = formatProposalPayload({ weightKg: 82.505, bogus: Number.NaN });
    expect(fields[0]?.value).toEqual({ kind: 'number', text: '82.51' });
    expect(fields[1]?.value).toEqual({ kind: 'empty' });
  });

  it('serialisiert sehr tiefe Strukturen kompakt statt weiter aufzuklappen', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 'tief' } } } } } } };
    const fields = formatProposalPayload(deep);
    const last = fields.at(-1);
    expect(last?.key).toBe('f');
    expect(last?.depth).toBe(5);
    expect(last?.value).toEqual({ kind: 'text', text: '{"g":"tief"}' });
  });

  it('verarbeitet primitive Payloads und null', () => {
    expect(formatProposalPayload('nur Text')).toEqual([
      { path: [], key: '', depth: 0, value: { kind: 'text', text: 'nur Text' }, index: null },
    ]);
    expect(formatProposalPayload(null)).toEqual([]);
    expect(formatProposalPayload(undefined)).toEqual([]);
  });
});

describe('humanizeKey', () => {
  it('macht camelCase- und snake_case-Keys lesbar', () => {
    expect(humanizeKey('targetWeight')).toBe('Target weight');
    expect(humanizeKey('superset_group')).toBe('Superset group');
    expect(humanizeKey('kcalTarget')).toBe('Kcal target');
  });

  it('lässt unbrauchbare Keys unverändert', () => {
    expect(humanizeKey('')).toBe('');
    expect(humanizeKey('id')).toBe('Id');
  });
});
