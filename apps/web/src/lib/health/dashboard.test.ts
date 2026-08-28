import { describe, expect, it } from 'vitest';
import { latestMetricEntry, sumMetricValues } from './dashboard.js';

describe('sumMetricValues', () => {
  it('sums all values', () => {
    expect(
      sumMetricValues([
        { measuredAt: '2026-08-28T06:00:00.000Z', value: 1200, source: 'apple_health' },
        { measuredAt: '2026-08-28T12:00:00.000Z', value: 3400, source: 'apple_health' },
      ]),
    ).toBe(4600);
  });

  it('returns 0 for an empty list', () => {
    expect(sumMetricValues([])).toBe(0);
  });
});

describe('latestMetricEntry', () => {
  it('returns the entry with the latest measuredAt', () => {
    const older = { measuredAt: '2026-08-27T08:00:00.000Z', value: 58 };
    const newer = { measuredAt: '2026-08-28T08:00:00.000Z', value: 55 };
    expect(latestMetricEntry([older, newer])).toBe(newer);
    expect(latestMetricEntry([newer, older])).toBe(newer);
  });

  it('returns null for an empty list', () => {
    expect(latestMetricEntry([])).toBeNull();
  });

  it('returns the only entry for a singleton list', () => {
    const only = { measuredAt: '2026-08-28T08:00:00.000Z', value: 55 };
    expect(latestMetricEntry([only])).toBe(only);
  });
});
