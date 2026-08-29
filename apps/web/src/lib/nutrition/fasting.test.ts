import { describe, expect, it } from 'vitest';
import { computeFasting, formatDuration } from './fasting.js';

const NOW = new Date('2026-08-27T20:00:00.000Z');

describe('computeFasting', () => {
  it('reports progress while the window is still running', () => {
    // Letzte Mahlzeit vor 8 h, Fenster 16 h.
    const state = computeFasting('2026-08-27T12:00:00.000Z', 16, NOW);
    expect(state?.elapsedMs).toBe(8 * 3_600_000);
    expect(state?.remainingMs).toBe(8 * 3_600_000);
    expect(state?.complete).toBe(false);
    expect(state?.progress).toBeCloseTo(0.5);
  });

  it('caps at the window instead of counting past it', () => {
    const state = computeFasting('2026-08-26T12:00:00.000Z', 16, NOW);
    expect(state?.remainingMs).toBe(0);
    expect(state?.complete).toBe(true);
    expect(state?.progress).toBe(1);
  });

  it('stays silent without a window, without history or for future meals', () => {
    expect(computeFasting('2026-08-27T12:00:00.000Z', null, NOW)).toBeNull();
    expect(computeFasting(null, 16, NOW)).toBeNull();
    expect(computeFasting('2026-08-27T12:00:00.000Z', 0, NOW)).toBeNull();
    expect(computeFasting('2026-08-28T12:00:00.000Z', 16, NOW)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('drops the hour part below an hour and never shows seconds', () => {
    expect(formatDuration(10 * 3_600_000 + 59 * 60_000)).toBe('10 h 59 min');
    expect(formatDuration(45 * 60_000 + 30_000)).toBe('45 min');
    expect(formatDuration(0)).toBe('0 min');
  });
});
