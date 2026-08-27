import { describe, expect, it } from 'vitest';
import { weekdayKey } from './weekday.js';

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
