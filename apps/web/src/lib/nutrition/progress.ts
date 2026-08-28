/**
 * Fortschritts-Berechnung für die kcal-/Makro-Balken im Ernährungs-Dashboard
 * (Ist vs. Ziel). `target` ist nullable, weil Nutzer:innen ohne gesetzte Ziele
 * gar keinen Balken sehen sollen (siehe `NutritionTargets` in `@repfuel/shared`).
 */
export interface ProgressResult {
  /** Ist/Ziel * 100, ungerundet — kann über 100 liegen. */
  percent: number;
  /** Für die Balkenbreite auf 0–100 begrenzt. */
  cappedPercent: number;
  /** true, wenn das Ziel überschritten wurde. */
  over: boolean;
}

/** `null`, wenn kein (sinnvolles) Ziel gesetzt ist — Aufrufer zeigt dann nur den Ist-Wert. */
export function computeProgress(
  actual: number,
  target: number | null | undefined,
): ProgressResult | null {
  if (target == null || target <= 0) return null;
  const percent = (actual / target) * 100;
  return {
    percent,
    cappedPercent: Math.min(100, Math.max(0, percent)),
    over: percent > 100,
  };
}

/** Anteil des Tagesziels je Mahlzeit (Diary-Konvention wie YAZIO/MyFitnessPal). */
const MEAL_SHARE: Record<import('@repfuel/shared').MealType, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

/**
 * kcal-Richtwert einer Mahlzeit aus dem Tagesziel — gibt jeder Gruppe eine
 * Bezugsgröße ("318 / 488 kcal"), ohne die der Einzelwert schwer einzuordnen ist.
 */
export function mealKcalBudget(
  type: import('@repfuel/shared').MealType,
  kcalTarget: number | null | undefined,
): number | null {
  if (kcalTarget == null || kcalTarget <= 0) return null;
  return Math.round(kcalTarget * MEAL_SHARE[type]);
}
