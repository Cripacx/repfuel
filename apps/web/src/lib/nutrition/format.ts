/** Zahlenformatierung fürs Ernährungs-UI: Makros mit 1 Nachkommastelle, kcal ganzzahlig. */

/** Rundet auf eine Nachkommastelle (Makro-Gramm-Anzeigen). */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Ganzzahlige kcal-Anzeige. */
export function roundKcal(value: number): number {
  return Math.round(value);
}
