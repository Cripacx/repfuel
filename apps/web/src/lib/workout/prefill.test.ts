import { describe, expect, it } from 'vitest';
import type { SetDto } from '@repfuel/shared';
import { computeDraftRowCount, derivePrefill } from './prefill.js';

function set(overrides: Partial<SetDto> = {}): SetDto {
  return {
    id: 'set-1',
    workoutId: 'workout-1',
    exerciseId: 'exercise-1',
    position: 0,
    reps: 10,
    weightKg: 50,
    isWarmup: false,
    rpe: null,
    ...overrides,
  };
}

describe('derivePrefill', () => {
  const fallback = { weightKg: 20, reps: 12 };

  it('falls back when there is no history at all', () => {
    expect(derivePrefill([], 0, fallback)).toEqual(fallback);
  });

  it('uses the set at the same index from the last workout', () => {
    const lastSets = [
      set({ id: 'a', position: 0, weightKg: 60, reps: 8 }),
      set({ id: 'b', position: 1, weightKg: 65, reps: 6 }),
    ];
    expect(derivePrefill(lastSets, 0, fallback)).toEqual({ weightKg: 60, reps: 8 });
    expect(derivePrefill(lastSets, 1, fallback)).toEqual({ weightKg: 65, reps: 6 });
  });

  it('sorts by position first, independent of input order', () => {
    const lastSets = [
      set({ id: 'b', position: 1, weightKg: 65, reps: 6 }),
      set({ id: 'a', position: 0, weightKg: 60, reps: 8 }),
    ];
    expect(derivePrefill(lastSets, 0, fallback)).toEqual({ weightKg: 60, reps: 8 });
  });

  it('reuses the last known set when asking for an index beyond the history', () => {
    const lastSets = [
      set({ id: 'a', position: 0, weightKg: 60, reps: 8 }),
      set({ id: 'b', position: 1, weightKg: 65, reps: 6 }),
    ];
    expect(derivePrefill(lastSets, 5, fallback)).toEqual({ weightKg: 65, reps: 6 });
  });

  it('ignores warmup sets from the history', () => {
    const lastSets = [
      set({ id: 'w', position: 0, weightKg: 20, reps: 15, isWarmup: true }),
      set({ id: 'a', position: 1, weightKg: 60, reps: 8, isWarmup: false }),
    ];
    expect(derivePrefill(lastSets, 0, fallback)).toEqual({ weightKg: 60, reps: 8 });
  });
});

describe('computeDraftRowCount', () => {
  it('fills up to the target when nothing has been logged yet', () => {
    expect(computeDraftRowCount(0, 3)).toBe(3);
  });

  it('shrinks as sets get logged', () => {
    expect(computeDraftRowCount(2, 3)).toBe(1);
  });

  it('always leaves at least one draft row once the target is reached', () => {
    expect(computeDraftRowCount(3, 3)).toBe(1);
    expect(computeDraftRowCount(5, 3)).toBe(1);
  });

  it('without a target, always shows exactly one draft row past what is logged', () => {
    expect(computeDraftRowCount(0, null)).toBe(1);
    expect(computeDraftRowCount(4, null)).toBe(1);
  });
});
