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

  it('computes PRs excluding warmups and weekly volume trend', () => {
    const stats = computeStrengthStats('ex-1', [
      { reps: 10, weightKg: 40, isWarmup: true, date: new Date('2026-08-10T10:00:00Z') },
      { reps: 8, weightKg: 80, isWarmup: false, date: new Date('2026-08-10T10:00:00Z') },
      { reps: 5, weightKg: 95, isWarmup: false, date: new Date('2026-08-17T10:00:00Z') },
      { reps: 3, weightKg: 100, isWarmup: false, date: new Date('2026-08-24T10:00:00Z') },
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
  });
});
