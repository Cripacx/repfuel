import { describe, expect, it } from 'vitest';
import { backendWeekdayIndex, weekdayKey } from './weekday.js';

describe('weekdayKey', () => {
  it('maps 0 to Monday and 6 to Sunday', () => {
    expect(weekdayKey(0)).toBe('mon');
    expect(weekdayKey(6)).toBe('sun');
  });

  it('returns null outside the valid 0..6 range', () => {
    expect(weekdayKey(7)).toBeNull();
    expect(weekdayKey(-1)).toBeNull();
  });
});

describe('backendWeekdayIndex', () => {
  it('maps JS getDay to backend order (0 = Monday)', () => {
    // 2026-08-24 ist ein Montag, 2026-08-30 ein Sonntag.
    expect(backendWeekdayIndex(new Date(2026, 7, 24))).toBe(0);
    expect(backendWeekdayIndex(new Date(2026, 7, 28))).toBe(4);
    expect(backendWeekdayIndex(new Date(2026, 7, 30))).toBe(6);
  });
});
