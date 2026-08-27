import { describe, expect, it } from 'vitest';
import type { BodyWeightDto } from '@repfuel/shared';
import { filterByRange } from './weight-range.js';

function entry(id: string, measuredAt: string, weightKg = 80): BodyWeightDto {
  return { id, measuredAt, weightKg };
}

const now = new Date('2026-08-27T12:00:00Z');

describe('filterByRange', () => {
  const entries = [
    entry('old', '2025-01-01T00:00:00Z'),
    entry('recent', '2026-08-20T00:00:00Z'),
    entry('today', '2026-08-27T00:00:00Z'),
  ];

  it('returns everything, sorted ascending, for "all"', () => {
    const result = filterByRange(entries, 'all', now);
    expect(result.map((e) => e.id)).toEqual(['old', 'recent', 'today']);
  });

  it('excludes entries older than the requested number of days', () => {
    const result = filterByRange(entries, 30, now);
    expect(result.map((e) => e.id)).toEqual(['recent', 'today']);
  });

  it('excludes everything outside a short range', () => {
    const result = filterByRange(entries, 3, now);
    expect(result.map((e) => e.id)).toEqual(['today']);
  });

  it('sorts ascending by date regardless of input order', () => {
    const shuffled = [entries[2]!, entries[0]!, entries[1]!];
    const result = filterByRange(shuffled, 'all', now);
    expect(result.map((e) => e.id)).toEqual(['old', 'recent', 'today']);
  });
});
