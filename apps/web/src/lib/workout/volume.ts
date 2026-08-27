import type { SetDto } from '@repfuel/shared';

/** Trainingsvolumen (kg): Summe aus Gewicht × Wdh. über alle Arbeitssätze (Warmups zählen nicht). */
export function computeVolumeKg(sets: readonly SetDto[]): number {
  return sets
    .filter((set) => !set.isWarmup)
    .reduce((sum, set) => sum + set.weightKg * set.reps, 0);
}

/** Dauer in Minuten, oder `null`, solange das Workout nicht beendet ist. */
export function computeDurationMinutes(
  startedAt: string,
  finishedAt: string | null,
): number | null {
  if (!finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

/**
 * Nächste freie, fortlaufende Satz-Position im gesamten Workout (nicht pro Übung) —
 * robust gegenüber gelöschten Sätzen, da über das Maximum statt über die Länge gebildet.
 */
export function nextSetPosition(sets: readonly SetDto[]): number {
  return sets.reduce((max, set) => Math.max(max, set.position + 1), 0);
}
