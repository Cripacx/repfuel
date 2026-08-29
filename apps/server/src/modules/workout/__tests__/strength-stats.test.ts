import { describe, expect, it } from 'vitest';
import { computeStrengthStats, estimate1Rm, isoWeek } from '../services/strength-stats.js';

describe('strength stats', () => {
  it('computes ISO weeks correctly (year boundaries)', () => {
    expect(isoWeek(new Date('2026-08-27T10:00:00Z'))).toBe('2026-W35');
    expect(isoWeek(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
    expect(isoWeek(new Date('2027-01-01T00:00:00Z'))).toBe('2026-W53');
  });

  it('estimates 1RM (Epley)', () => {
    expect(estimate1Rm(100, 1)).toBe(100);
    expect(estimate1Rm(100, 5)).toBeCloseTo(116.7, 1);
  });

  const set = (
    partial: Partial<Parameters<typeof computeStrengthStats>[1][number]> & {
      reps: number;
      weightKg: number;
      isWarmup: boolean;
      date: Date;
    },
  ) => ({ workoutId: 'w-1', position: 0, rpe: null, ...partial });

  it('computes PRs excluding warmups and weekly volume trend', () => {
    const stats = computeStrengthStats('ex-1', [
      set({ reps: 10, weightKg: 40, isWarmup: true, date: new Date('2026-08-10T10:00:00Z'), workoutId: 'w-a' }),
      set({ reps: 8, weightKg: 80, isWarmup: false, date: new Date('2026-08-10T10:00:00Z'), workoutId: 'w-a' }),
      set({ reps: 5, weightKg: 95, isWarmup: false, date: new Date('2026-08-17T10:00:00Z'), workoutId: 'w-b' }),
      set({ reps: 3, weightKg: 100, isWarmup: false, date: new Date('2026-08-24T10:00:00Z'), workoutId: 'w-c' }),
    ]);
    expect(stats.prs.maxWeightKg).toBe(100);
    expect(stats.prs.maxReps).toBe(8);
    // best est. 1RM: 95×(1+5/30)=110.8 < 100×(1+3/30)=110 → 95er Satz gewinnt knapp
    expect(stats.prs.bestEst1RmKg).toBeCloseTo(110.8, 1);
    expect(stats.prs.bestSet).toMatchObject({ reps: 5, weightKg: 95 });
    expect(stats.weeklyTrend).toEqual([
      { week: '2026-W33', volumeKg: 640, sets: 1 },
      { week: '2026-W34', volumeKg: 475, sets: 1 },
      { week: '2026-W35', volumeKg: 300, sets: 1 },
    ]);
  });

  it('handles empty input', () => {
    const stats = computeStrengthStats('ex-1', []);
    expect(stats.prs).toEqual({ maxWeightKg: null, maxReps: null, bestEst1RmKg: null, bestSet: null });
    expect(stats.weeklyTrend).toEqual([]);
    expect(stats.history).toEqual([]);
  });

  it('builds a per-workout history, newest first, sets in position order', () => {
    const stats = computeStrengthStats('ex-1', [
      set({ reps: 10, weightKg: 40, isWarmup: true, date: new Date('2026-08-10T10:00:00Z'), workoutId: 'w-a' }),
      set({ reps: 8, weightKg: 80, isWarmup: false, date: new Date('2026-08-10T10:00:00Z'), workoutId: 'w-a', position: 2, rpe: 8 }),
      set({ reps: 10, weightKg: 75, isWarmup: false, date: new Date('2026-08-10T10:00:00Z'), workoutId: 'w-a', position: 1 }),
      set({ reps: 5, weightKg: 95, isWarmup: false, date: new Date('2026-08-17T10:00:00Z'), workoutId: 'w-b' }),
    ]);

    expect(stats.history).toHaveLength(2);
    // Jüngstes Workout zuerst
    expect(stats.history[0]).toMatchObject({ topWeightKg: 95, bestEst1RmKg: 110.8 });
    // Warmup fällt raus, Sätze nach Position sortiert
    expect(stats.history[1]?.sets).toEqual([
      { reps: 10, weightKg: 75, rpe: null },
      { reps: 8, weightKg: 80, rpe: 8 },
    ]);
    expect(stats.history[1]?.topWeightKg).toBe(80);
  });

  it('caps the history at historyLimit workouts', () => {
    const inputs = Array.from({ length: 25 }, (_unused, i) =>
      set({
        reps: 5,
        weightKg: 100,
        isWarmup: false,
        date: new Date(Date.UTC(2026, 0, 1 + i)),
        workoutId: `w-${i}`,
      }),
    );
    const stats = computeStrengthStats('ex-1', inputs);
    expect(stats.history).toHaveLength(20);
    // Das älteste (w-0 … w-4) fällt raus, das jüngste steht vorn.
    expect(stats.history[0]?.date).toBe(new Date(Date.UTC(2026, 0, 25)).toISOString());
  });
});
