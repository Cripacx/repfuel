/**
 * Kalorien-/Makro-Ziele nach Mifflin-St Jeor + Aktivitätslevel.
 * Gemeinsame Logik für den Ziele-Screen und den KI-Coach (update_profile-Vorschläge).
 */

export const SEXES = ['male', 'female'] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const GOALS = ['cut', 'maintain', 'bulk'] as const;
export type Goal = (typeof GOALS)[number];

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Kalorien-Anpassung relativ zum Erhaltungsbedarf. */
export const GOAL_ADJUSTMENT: Record<Goal, number> = {
  cut: -0.2,
  maintain: 0,
  bulk: 0.1,
};

export interface TargetInput {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** Bezugsjahr für die Altersberechnung (Default: aktuelles Jahr). */
  referenceYear?: number;
}

export interface TargetResult {
  /** Grundumsatz (kcal/Tag). */
  bmr: number;
  /** Erhaltungsbedarf (kcal/Tag). */
  tdee: number;
  kcalTarget: number;
  proteinTargetG: number;
  fatTargetG: number;
  carbsTargetG: number;
}

/**
 * Mifflin-St Jeor: 10*kg + 6.25*cm − 5*Alter + (m: +5 | w: −161).
 * Makros: Protein 2 g/kg, Fett 0.9 g/kg, Rest Kohlenhydrate.
 */
export function calculateTargets(input: TargetInput): TargetResult {
  const referenceYear = input.referenceYear ?? new Date().getFullYear();
  const age = Math.max(0, referenceYear - input.birthYear);
  const sexOffset = input.sex === 'male' ? 5 : -161;
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * age + sexOffset;
  const tdee = bmr * ACTIVITY_FACTORS[input.activityLevel];
  const kcalTarget = Math.round(tdee * (1 + GOAL_ADJUSTMENT[input.goal]));

  const proteinTargetG = Math.round(2 * input.weightKg);
  const fatTargetG = Math.round(0.9 * input.weightKg);
  const remainingKcal = Math.max(0, kcalTarget - proteinTargetG * 4 - fatTargetG * 9);
  const carbsTargetG = Math.round(remainingKcal / 4);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    kcalTarget,
    proteinTargetG,
    fatTargetG,
    carbsTargetG,
  };
}
