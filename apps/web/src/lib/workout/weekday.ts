/** Wochentag-Schlüssel in Backend-Reihenfolge: 0 = Montag … 6 = Sonntag. */
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** Wochentag-Schlüssel für einen Backend-Index (0..6), oder `null` außerhalb des Bereichs. */
export function weekdayKey(index: number): WeekdayKey | null {
  return WEEKDAY_KEYS[index] ?? null;
}
