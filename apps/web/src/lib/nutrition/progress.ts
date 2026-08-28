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
