import { describe, expect, it } from 'vitest';
import {
  currentTzOffsetMinutes,
  defaultEatenAtIso,
  isToday,
  localDayBoundsUtc,
  shiftDateString,
  toDateString,
  todayDateString,
} from './day-range.js';

describe('toDateString / todayDateString', () => {
  it('formats local date parts as YYYY-MM-DD, zero-padded', () => {
    expect(toDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toDateString(new Date(2026, 10, 30, 0, 0))).toBe('2026-11-30');
  });

  it('todayDateString delegates to the given "now"', () => {
    expect(todayDateString(new Date(2026, 7, 27, 8))).toBe('2026-08-27');
  });
});

describe('isToday', () => {
  const now = new Date(2026, 7, 27, 15, 0);

  it('is true for the current local date', () => {
    expect(isToday('2026-08-27', now)).toBe(true);
  });

  it('is false for any other date', () => {
    expect(isToday('2026-08-26', now)).toBe(false);
    expect(isToday('2026-08-28', now)).toBe(false);
  });
});

describe('currentTzOffsetMinutes', () => {
  it('negates Date#getTimezoneOffset (server convention: minutes east of UTC)', () => {
    const now = new Date();
    expect(currentTzOffsetMinutes(now)).toBe(-now.getTimezoneOffset());
  });
});

describe('shiftDateString', () => {
  it('shifts within a month', () => {
    expect(shiftDateString('2026-08-27', 1)).toBe('2026-08-28');
    expect(shiftDateString('2026-08-27', -1)).toBe('2026-08-26');
  });

  it('rolls over month and year boundaries', () => {
    expect(shiftDateString('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDateString('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateString('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('supports multi-day jumps', () => {
    expect(shiftDateString('2026-08-27', 7)).toBe('2026-09-03');
  });
});

describe('localDayBoundsUtc', () => {
  it('computes UTC instants for a positive offset (east of UTC)', () => {
    const { from, to } = localDayBoundsUtc('2026-08-27', 120);
    expect(from).toBe('2026-08-26T22:00:00.000Z');
    expect(to).toBe('2026-08-27T22:00:00.000Z');
  });

  it('computes UTC instants for a negative offset (west of UTC)', () => {
    const { from, to } = localDayBoundsUtc('2026-08-27', -300);
    expect(from).toBe('2026-08-27T05:00:00.000Z');
    expect(to).toBe('2026-08-28T05:00:00.000Z');
  });

  it('degenerates to plain UTC midnight for offset 0', () => {
    const { from, to } = localDayBoundsUtc('2026-08-27', 0);
    expect(from).toBe('2026-08-27T00:00:00.000Z');
    expect(to).toBe('2026-08-28T00:00:00.000Z');
  });

  it('spans exactly 24 hours', () => {
    const { from, to } = localDayBoundsUtc('2026-08-27', -90);
    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe('defaultEatenAtIso', () => {
  it('uses the current time for the current local day', () => {
    const now = new Date(2026, 7, 27, 14, 30, 0);
    expect(defaultEatenAtIso('2026-08-27', now)).toBe(now.toISOString());
  });

  it('uses local noon for any other day', () => {
    const now = new Date(2026, 7, 27, 14, 30, 0);
    expect(defaultEatenAtIso('2026-08-25', now)).toBe(new Date('2026-08-25T12:00:00').toISOString());
  });
});
