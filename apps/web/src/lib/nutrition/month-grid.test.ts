import { describe, expect, it } from 'vitest';
import { buildMonthGrid, monthBounds, monthKeyOf, shiftMonthKey } from './month-grid.js';

describe('monthKeyOf / shiftMonthKey', () => {
  it('extracts and shifts month keys across year boundaries', () => {
    expect(monthKeyOf('2026-08-27')).toBe('2026-08');
    expect(shiftMonthKey('2026-08', 1)).toBe('2026-09');
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
  });
});

describe('monthBounds', () => {
  it('covers the whole month including leap days', () => {
    expect(monthBounds('2026-08')).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('buildMonthGrid', () => {
  it('starts every week on monday and pads with neighbouring days', () => {
    // 2026-08-01 ist ein Samstag — die erste Zeile beginnt am 27. Juli.
    const weeks = buildMonthGrid('2026-08');
    expect(weeks[0]?.[0]).toEqual({ date: '2026-07-27', inMonth: false });
    expect(weeks[0]?.[5]).toEqual({ date: '2026-08-01', inMonth: true });
    for (const week of weeks) expect(week).toHaveLength(7);
  });

  it('contains every day of the month exactly once', () => {
    const inMonth = buildMonthGrid('2026-08')
      .flat()
      .filter((d) => d.inMonth)
      .map((d) => d.date);
    expect(inMonth).toHaveLength(31);
    expect(new Set(inMonth).size).toBe(31);
    expect(inMonth[0]).toBe('2026-08-01');
    expect(inMonth.at(-1)).toBe('2026-08-31');
  });

  it('handles a month that starts on a monday without a leading pad week', () => {
    // 2026-06-01 ist ein Montag.
    const weeks = buildMonthGrid('2026-06');
    expect(weeks[0]?.[0]).toEqual({ date: '2026-06-01', inMonth: true });
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(30);
  });

  it('handles february in a leap year', () => {
    const days = buildMonthGrid('2028-02').flat().filter((d) => d.inMonth);
    expect(days).toHaveLength(29);
    expect(days.at(-1)?.date).toBe('2028-02-29');
  });
});
