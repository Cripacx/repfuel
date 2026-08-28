import { describe, expect, it } from 'vitest';
import {
  extractRoutineItems,
  formatProposalPayload,
  humanizeKey,
  stripDisplayHelpers,
} from './proposal-format.js';

describe('extractRoutineItems', () => {
  const ID = '00000000-0000-4000-8000-00000000bbbb';

  it('liest Übungen aus create_routine-Payloads und löst Namen auf', () => {
    const items = extractRoutineItems({
      routine: {
        name: 'Ganzkörper A',
        items: [{ exerciseId: ID, position: 0, targetSets: 3, targetReps: 8, targetWeightKg: 60 }],
      },
      exerciseNames: { [ID]: 'Kniebeugen' },
    });
    expect(items).toEqual([
      { name: 'Kniebeugen', targetSets: 3, targetReps: 8, targetWeightKg: 60 },
    ]);
  });

  it('fällt ohne Namens-Map auf die ID zurück und liest auch changes.items', () => {
    const items = extractRoutineItems({
      routineId: ID,
      changes: { items: [{ exerciseId: ID, targetSets: 4, targetReps: 10 }] },
    });
    expect(items).toEqual([{ name: ID, targetSets: 4, targetReps: 10, targetWeightKg: null }]);
  });

  it('liefert für Profil-Payloads und Unsinn eine leere Liste', () => {
    expect(extractRoutineItems({ changes: { kcalTarget: 2200 } })).toEqual([]);
    expect(extractRoutineItems(null)).toEqual([]);
    expect(extractRoutineItems('x')).toEqual([]);
  });
});

describe('stripDisplayHelpers', () => {
  it('entfernt exerciseNames, lässt den Rest unverändert', () => {
    expect(stripDisplayHelpers({ routine: { name: 'A' }, exerciseNames: { a: 'b' } })).toEqual({
      routine: { name: 'A' },
    });
    expect(stripDisplayHelpers(42)).toBe(42);
  });
});

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
