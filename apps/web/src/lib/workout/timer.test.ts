import { describe, expect, it } from 'vitest';
import { formatCountdown, remainingSeconds } from './timer.js';

describe('formatCountdown', () => {
  it('formats seconds as mm:ss with a zero-padded seconds part', () => {
    expect(formatCountdown(90)).toBe('1:30');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(9)).toBe('0:09');
  });

  it('rounds fractional seconds', () => {
    expect(formatCountdown(89.6)).toBe('1:30');
  });

  it('never goes negative', () => {
    expect(formatCountdown(-5)).toBe('0:00');
  });

  it('handles durations over an hour', () => {
    expect(formatCountdown(3661)).toBe('61:01');
  });
});

describe('remainingSeconds', () => {
  it('counts down from the full duration', () => {
    expect(remainingSeconds(90, 0)).toBe(90);
    expect(remainingSeconds(90, 30_000)).toBe(60);
  });

  it('clamps to zero once elapsed time exceeds the duration', () => {
    expect(remainingSeconds(90, 120_000)).toBe(0);
  });

  it('floors partial seconds so the countdown does not jump early', () => {
    expect(remainingSeconds(90, 999)).toBe(90);
    expect(remainingSeconds(90, 1000)).toBe(89);
  });
});
