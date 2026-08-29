import type { SetDto } from '@repfuel/shared';

export interface PrefillValues {
  weightKg: number;
  reps: number;
}

/** Arbeitssätze (keine Warmups) aufsteigend nach Position, wie sie zuletzt geloggt wurden. */
function workingSetsInOrder(sets: readonly SetDto[]): SetDto[] {
  return sets
    .filter((set) => !set.isWarmup)
    .slice()
    .sort((a, b) => a.position - b.position);
}

/**
 * Leitet die Vorbelegung für die `index`-te (0-basierte) noch zu loggende Zeile einer Übung ab:
 * Gewicht/Wdh. des letzten Workouts an derselben Stelle; gibt es weniger Sätze als `index`, wird
 * der letzte bekannte Satz wiederverwendet (typisch: gleiche Arbeitsgewichte für alle Sätze).
 * Ohne Historie greift `fallback` (z. B. die Zielwerte aus dem Routinen-Item).
 */
export function derivePrefill(
  lastSets: readonly SetDto[],
  index: number,
  fallback: PrefillValues,
): PrefillValues {
  const sorted = workingSetsInOrder(lastSets);
  if (sorted.length === 0) return fallback;
  const lastIndex = sorted.length - 1;
  const match = sorted[Math.min(index, lastIndex)]!;
  return { weightKg: match.weightKg, reps: match.reps };
}

/**
 * Wie viele weitere (noch nicht geloggte) Satz-Zeilen für eine Übung angezeigt werden sollen:
 * bis `targetSets` erreicht ist, mindestens aber eine — so gibt es nach dem letzten Zielsatz
 * immer noch eine Zeile, um freiwillig einen weiteren Satz zu loggen.
 */
export function computeDraftRowCount(loggedCount: number, targetSets: number | null): number {
  const desiredTotal = targetSets ?? loggedCount + 1;
  return Math.max(desiredTotal - loggedCount, 1);
}
