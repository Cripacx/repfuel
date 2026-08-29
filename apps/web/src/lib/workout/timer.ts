/** Auswählbare Pausenzeiten (Sekunden) für den Rest-Timer im Logging-Screen. */
export const REST_TIMER_OPTIONS_SECONDS = [30, 60, 90, 120, 180] as const;

export const DEFAULT_REST_SECONDS = 90;

/** Formatiert eine Sekundenzahl als `mm:ss` (nie negativ). */
export function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Verbleibende Sekunden einer Pause, gegeben die seit dem Start vergangene Zeit in ms. */
export function remainingSeconds(durationSeconds: number, elapsedMs: number): number {
  return Math.max(0, durationSeconds - Math.floor(elapsedMs / 1000));
}
