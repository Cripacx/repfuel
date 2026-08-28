import { describe, expect, it } from 'vitest';
import { formatIsoWeekLabel } from './week-label.js';

describe('formatIsoWeekLabel', () => {
  it('formats a German week label', () => {
    expect(formatIsoWeekLabel('2026-W35', 'de')).toBe('KW 35');
  });

  it('formats an English week label', () => {
    expect(formatIsoWeekLabel('2026-W35', 'en')).toBe('Wk 35');
  });

  it('pads and parses single-digit week numbers', () => {
    expect(formatIsoWeekLabel('2026-W05', 'de')).toBe('KW 5');
  });

  it('returns the raw string unchanged if it does not match the expected format', () => {
    expect(formatIsoWeekLabel('not-a-week', 'de')).toBe('not-a-week');
  });
});
