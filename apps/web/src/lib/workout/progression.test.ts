import { describe, expect, it } from 'vitest';
import type { LastSetsEntry, SetDto } from '@repfuel/shared';
import { suggestOverload, summarizeLastSets } from './progression.js';

function set(overrides: Partial<SetDto> = {}): SetDto {
  return {
    id: 's',
    workoutId: 'w',
    exerciseId: 'e',
    position: 0,
    reps: 8,
    weightKg: 85,
    isWarmup: false,
    rpe: null,
    ...overrides,
  };
}

function entry(sets: SetDto[]): LastSetsEntry {
  return { performedAt: '2026-08-20T10:00:00.000Z', sets };
}

describe('summarizeLastSets', () => {
  it('lists working sets in position order', () => {
    const result = summarizeLastSets(
      entry([
        set({ position: 1, weightKg: 80, reps: 6 }),
        set({ position: 0, weightKg: 85, reps: 8 }),
      ]),
    );
    expect(result).toBe('85 × 8, 80 × 6');
  });

  it('ignores warmups and returns empty when only warmups exist', () => {
    expect(summarizeLastSets(entry([set({ isWarmup: true })]))).toBe('');
  });

  it('returns empty without history', () => {
    expect(summarizeLastSets(undefined)).toBe('');
  });
});

describe('suggestOverload', () => {
  it('suggests the next step when every working set hit the target', () => {
    const result = suggestOverload(
      entry([set({ position: 0 }), set({ position: 1 })]),
      8,
    );
    expect(result).toEqual({ weightKg: 87.5, previousWeightKg: 85 });
  });

  it('stays silent when a single set fell short', () => {
    const result = suggestOverload(
      entry([set({ position: 0, reps: 8 }), set({ position: 1, reps: 6 })]),
      8,
    );
    expect(result).toBeNull();
  });

  it('stays silent for mixed weights — the next step is ambiguous', () => {
    const result = suggestOverload(
      entry([set({ position: 0, weightKg: 85 }), set({ position: 1, weightKg: 75 })]),
      8,
    );
    expect(result).toBeNull();
  });

  it('stays silent without a rep target or history', () => {
    expect(suggestOverload(entry([set()]), null)).toBeNull();
    expect(suggestOverload(undefined, 8)).toBeNull();
  });

  it('counts sets that exceeded the target as hit', () => {
    expect(suggestOverload(entry([set({ reps: 10 })]), 8)?.weightKg).toBe(87.5);
  });

  it('ignores bodyweight sets, where adding kilos means nothing', () => {
    expect(suggestOverload(entry([set({ weightKg: 0 })]), 8)).toBeNull();
  });
});
