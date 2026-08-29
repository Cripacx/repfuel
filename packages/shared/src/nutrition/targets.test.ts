import { describe, expect, it } from 'vitest';
import { calculateTargets } from './targets.js';

describe('calculateTargets (Mifflin-St Jeor)', () => {
  const base = {
    sex: 'male' as const,
    birthYear: 1996,
    heightCm: 180,
    weightKg: 80,
    activityLevel: 'moderate' as const,
    goal: 'maintain' as const,
    referenceYear: 2026,
  };

  it('computes BMR/TDEE for a reference male', () => {
    // 10*80 + 6.25*180 − 5*30 + 5 = 800 + 1125 − 150 + 5 = 1780
    const r = calculateTargets(base);
    expect(r.bmr).toBe(1780);
    expect(r.tdee).toBe(Math.round(1780 * 1.55));
    expect(r.kcalTarget).toBe(r.tdee);
  });

  it('applies the female offset', () => {
    const r = calculateTargets({ ...base, sex: 'female' });
    expect(r.bmr).toBe(1780 - 166); // Offset-Differenz: +5 → −161
  });

  it('applies goal adjustments (cut −20%, bulk +10%)', () => {
    const maintain = calculateTargets(base);
    expect(calculateTargets({ ...base, goal: 'cut' }).kcalTarget).toBe(
      Math.round(maintain.tdee * 0.8),
    );
    expect(calculateTargets({ ...base, goal: 'bulk' }).kcalTarget).toBe(
      Math.round(maintain.tdee * 1.1),
    );
  });

  it('derives macros: protein 2 g/kg, fat 0.9 g/kg, rest carbs', () => {
    const r = calculateTargets(base);
    expect(r.proteinTargetG).toBe(160);
    expect(r.fatTargetG).toBe(72);
    expect(r.carbsTargetG).toBe(Math.round((r.kcalTarget - 160 * 4 - 72 * 9) / 4));
  });

  it('never returns negative carbs', () => {
    const r = calculateTargets({ ...base, weightKg: 200, activityLevel: 'sedentary', goal: 'cut' });
    expect(r.carbsTargetG).toBeGreaterThanOrEqual(0);
  });
});
