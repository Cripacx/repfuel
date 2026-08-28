import { describe, expect, it } from 'vitest';
import { computeProgress, mealKcalBudget } from './progress.js';

describe('computeProgress', () => {
  it('returns null when there is no target', () => {
    expect(computeProgress(1200, null)).toBeNull();
    expect(computeProgress(1200, undefined)).toBeNull();
  });

  it('returns null for a non-positive target', () => {
    expect(computeProgress(1200, 0)).toBeNull();
    expect(computeProgress(1200, -10)).toBeNull();
  });

  it('computes an under-target percentage', () => {
    const result = computeProgress(50, 100);
    expect(result).toEqual({ percent: 50, cappedPercent: 50, over: false });
  });

  it('caps the bar width at 100% while exposing the true percentage', () => {
    const result = computeProgress(150, 100);
    expect(result?.percent).toBe(150);
    expect(result?.cappedPercent).toBe(100);
    expect(result?.over).toBe(true);
  });

  it('is not "over" exactly at the target', () => {
    const result = computeProgress(100, 100);
    expect(result?.percent).toBe(100);
    expect(result?.cappedPercent).toBe(100);
    expect(result?.over).toBe(false);
  });

  it('clamps a negative actual value to a 0% bar', () => {
    const result = computeProgress(-20, 100);
    expect(result?.percent).toBe(-20);
    expect(result?.cappedPercent).toBe(0);
    expect(result?.over).toBe(false);
  });
});

describe('mealKcalBudget', () => {
  it('splits the day target into the diary shares', () => {
    expect(mealKcalBudget('breakfast', 2000)).toBe(500);
    expect(mealKcalBudget('lunch', 2000)).toBe(700);
    expect(mealKcalBudget('dinner', 2000)).toBe(600);
    expect(mealKcalBudget('snack', 2000)).toBe(200);
  });

  it('returns null without a target', () => {
    expect(mealKcalBudget('lunch', null)).toBeNull();
    expect(mealKcalBudget('lunch', 0)).toBeNull();
  });
});
