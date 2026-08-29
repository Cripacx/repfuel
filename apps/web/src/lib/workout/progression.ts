import type { LastSetsEntry, SetDto } from '@repfuel/shared';

/** Arbeitssätze (keine Warmups) aufsteigend nach Position. */
function workingSets(sets: readonly SetDto[]): SetDto[] {
  return sets
    .filter((set) => !set.isWarmup)
    .slice()
    .sort((a, b) => a.position - b.position);
}

/**
 * Kurzfassung der zuletzt geloggten Arbeitssätze, z. B. "85 × 8, 85 × 8, 80 × 6".
 * Leerer String, wenn es keine Arbeitssätze gab (nur Warmups oder gar nichts) —
 * die aufrufende Stelle blendet die Zeile dann aus, statt "Zuletzt: " zu zeigen.
 */
export function summarizeLastSets(entry: LastSetsEntry | undefined): string {
  if (!entry) return '';
  return workingSets(entry.sets)
    .map((set) => `${set.weightKg} × ${set.reps}`)
    .join(', ');
}

export interface OverloadSuggestion {
  /** Gewicht, das für den nächsten Satz vorgeschlagen wird. */
  weightKg: number;
  /** Gewicht, auf dem der Vorschlag aufbaut (letztes Arbeitsgewicht). */
  previousWeightKg: number;
}

/**
 * Schlägt eine Steigerung vor, wenn beim letzten Mal **alle** Arbeitssätze das
 * Wiederholungsziel erreicht haben — die übliche Bedingung für progressive
 * Überlastung. Ohne Ziel (freies Workout ohne Routine) oder bei auch nur einem
 * verfehlten Satz gibt es bewusst keinen Vorschlag: ein Hinweis, der immer
 * erscheint, wird ignoriert.
 *
 * Alle Sätze müssen dasselbe Gewicht haben — bei gemischten Gewichten (Drop-,
 * Pyramidensätze) ist "das nächste Gewicht" nicht eindeutig, und Raten wäre hier
 * schlechter als Schweigen.
 */
export function suggestOverload(
  entry: LastSetsEntry | undefined,
  targetReps: number | null,
  incrementKg = 2.5,
): OverloadSuggestion | null {
  if (!entry || targetReps === null || targetReps <= 0) return null;

  const sets = workingSets(entry.sets);
  if (sets.length === 0) return null;

  const weight = sets[0]!.weightKg;
  if (weight <= 0) return null;
  if (!sets.every((set) => set.weightKg === weight)) return null;
  if (!sets.every((set) => set.reps >= targetReps)) return null;

  return {
    weightKg: Math.round((weight + incrementKg) * 100) / 100,
    previousWeightKg: weight,
  };
}
