import { describe, expect, it } from 'vitest';
import { round1, roundKcal } from './format.js';

describe('round1', () => {
  it('rounds to one decimal place', () => {
    expect(round1(12.34)).toBe(12.3);
    expect(round1(12.36)).toBe(12.4);
  });

  it('avoids floating point artifacts', () => {
    expect(round1(0.1 + 0.2)).toBe(0.3);
  });
});

describe('roundKcal', () => {
  it('rounds to the nearest whole number', () => {
    expect(roundKcal(199.6)).toBe(200);
    expect(roundKcal(199.4)).toBe(199);
  });
});
