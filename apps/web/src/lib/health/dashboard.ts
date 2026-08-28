/**
 * Reine Aggregations-Helfer für die Health-Kacheln auf dem Home-Dashboard.
 * `GET /stats/health` liefert Rohwerte pro Zeitpunkt — Schritte/aktive kcal
 * werden für "heute" aufsummiert (mehrere Messpunkte pro Tag möglich, je nach
 * Ingest-Intervall der Quell-App), Ruhepuls zeigt den zeitlich letzten Wert.
 */

export interface HealthStatsEntry {
  measuredAt: string;
  value: number;
  source: string;
}

/** Summe aller Werte (z. B. Schritte/aktive kcal über einen Tag). */
export function sumMetricValues(entries: readonly HealthStatsEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.value, 0);
}

/** Eintrag mit dem spätesten `measuredAt`, oder `null` bei leerer Liste. */
export function latestMetricEntry<T extends { measuredAt: string }>(
  entries: readonly T[],
): T | null {
  if (entries.length === 0) return null;
  return entries.reduce((latest, entry) =>
    new Date(entry.measuredAt).getTime() > new Date(latest.measuredAt).getTime() ? entry : latest,
  );
}
