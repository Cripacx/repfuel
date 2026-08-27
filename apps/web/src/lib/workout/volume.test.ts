import { describe, expect, it } from 'vitest';
import type { SetDto } from '@repfuel/shared';
import { computeDurationMinutes, computeVolumeKg, nextSetPosition } from './volume.js';

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

describe('computeVolumeKg', () => {
  it('sums weight times reps across working sets', () => {
    const sets = [
      set({ id: 'a', weightKg: 50, reps: 10 }),
      set({ id: 'b', weightKg: 60, reps: 8 }),
    ];
    expect(computeVolumeKg(sets)).toBe(50 * 10 + 60 * 8);
  });

  it('excludes warmup sets from the total', () => {
    const sets = [
      set({ id: 'a', weightKg: 20, reps: 15, isWarmup: true }),
      set({ id: 'b', weightKg: 60, reps: 8, isWarmup: false }),
    ];
    expect(computeVolumeKg(sets)).toBe(60 * 8);
  });

  it('returns 0 for an empty set list', () => {
    expect(computeVolumeKg([])).toBe(0);
  });
});

describe('computeDurationMinutes', () => {
  it('returns null while the workout has not finished', () => {
    expect(computeDurationMinutes('2026-08-27T10:00:00+02:00', null)).toBeNull();
  });

  it('computes whole minutes between start and finish', () => {
    const minutes = computeDurationMinutes(
      '2026-08-27T10:00:00+02:00',
      '2026-08-27T10:45:30+02:00',
    );
    expect(minutes).toBe(46); // 45.5min rounds to 46
  });

  it('never returns a negative duration', () => {
    const minutes = computeDurationMinutes(
      '2026-08-27T10:00:00+02:00',
      '2026-08-27T09:00:00+02:00',
    );
    expect(minutes).toBe(0);
  });
});

describe('nextSetPosition', () => {
  it('returns 0 for an empty workout', () => {
    expect(nextSetPosition([])).toBe(0);
  });

  it('returns one past the highest existing position', () => {
    const sets = [set({ position: 0 }), set({ position: 1 }), set({ position: 2 })];
    expect(nextSetPosition(sets)).toBe(3);
  });

  it('is robust against gaps left by deleted sets', () => {
    const sets = [set({ position: 0 }), set({ position: 4 })];
    expect(nextSetPosition(sets)).toBe(5);
  });
});
