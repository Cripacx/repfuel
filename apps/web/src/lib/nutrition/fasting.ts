export interface FastingState {
  /** Vergangene Zeit seit der letzten Mahlzeit in ms. */
  elapsedMs: number;
  /** Verbleibende Zeit bis zum Ende des Fensters; 0, sobald es erreicht ist. */
  remainingMs: number;
  /** Fenster vollständig durchgehalten. */
  complete: boolean;
  /** Anteil 0…1 für die Fortschrittsdarstellung. */
  progress: number;
}

/**
 * Fastenstand aus der letzten geloggten Mahlzeit. Bewusst abgeleitet statt als
 * eigener Timer geführt: ein Timer, den man zu starten vergisst, zeigt Unsinn —
 * die letzte Mahlzeit steht dagegen ohnehin in den Daten.
 *
 * `null`, wenn kein Fenster konfiguriert ist oder noch nie etwas geloggt wurde;
 * die Karte bleibt dann aus, statt 0 anzuzeigen.
 */
export function computeFasting(
  lastMealAt: string | null,
  windowH: number | null,
  now: Date,
): FastingState | null {
  if (!lastMealAt || windowH === null || windowH <= 0) return null;

  const windowMs = windowH * 3_600_000;
  const elapsedMs = now.getTime() - new Date(lastMealAt).getTime();
  // Eine in der Zukunft geloggte Mahlzeit (Zeitzonen, Vorausplanung) ergibt
  // keinen sinnvollen Fastenstand.
  if (elapsedMs < 0) return null;

  const remainingMs = Math.max(windowMs - elapsedMs, 0);
  return {
    elapsedMs,
    remainingMs,
    complete: remainingMs === 0,
    progress: Math.min(elapsedMs / windowMs, 1),
  };
}

/** "10 h 59 min" — kompakt und ohne Sekunden, die hier niemanden interessieren. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}
