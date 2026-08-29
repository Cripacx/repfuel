/**
 * Reine Datums-/Zeitzonen-Helfer für das Ernährungs-Dashboard: Tages-Navigation
 * (gestern/heute/vor-zurück) und die UTC-Grenzen eines lokalen Kalendertags für
 * `GET /meals?from=&to=`. `GET /stats/nutrition` bekommt das Datum dagegen roh
 * als YYYY-MM-DD + `tzOffsetMinutes` (siehe `currentTzOffsetMinutes`).
 */

/** YYYY-MM-DD aus den lokalen Datumsanteilen von `date` (kein UTC-Shift). */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Aktuelles lokales Datum als YYYY-MM-DD. */
export function todayDateString(now: Date = new Date()): string {
  return toDateString(now);
}

/** true, wenn `dateString` das heutige lokale Datum ist. */
export function isToday(dateString: string, now: Date = new Date()): boolean {
  return dateString === todayDateString(now);
}

/**
 * Minuten östlich von UTC, wie der Server es erwartet (`tzOffsetMinutes` in
 * `GET /stats/nutrition`): `-Date#getTimezoneOffset()`.
 */
export function currentTzOffsetMinutes(now: Date = new Date()): number {
  return -now.getTimezoneOffset();
}

function parseDateParts(dateString: string): [number, number, number] {
  const [y, m, d] = dateString.split('-').map(Number);
  return [y ?? 0, m ?? 1, d ?? 1];
}

/**
 * Verschiebt ein YYYY-MM-DD-Datum um `deltaDays`. Rechnet in UTC, damit
 * Sommerzeit-Umstellungen das Kalenderdatum nicht verfälschen.
 */
export function shiftDateString(dateString: string, deltaDays: number): string {
  const [y, m, d] = parseDateParts(dateString);
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * UTC-Grenzen (ISO-Instants, `to` exklusiv) des lokalen Kalendertags `dateString`,
 * gegeben `tzOffsetMinutes` (Minuten östlich von UTC). Für `GET /meals?from=&to=`.
 */
export function localDayBoundsUtc(
  dateString: string,
  tzOffsetMinutes: number,
): { from: string; to: string } {
  const [y, m, d] = parseDateParts(dateString);
  const fromMs = Date.UTC(y, m - 1, d, 0, 0, 0) - tzOffsetMinutes * 60_000;
  const toMs = fromMs + 24 * 60 * 60 * 1000;
  return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() };
}

/**
 * ISO-Zeitpunkt für eine neu anzulegende Mahlzeit an `dateString`: aktuelle Uhrzeit,
 * wenn es der heutige Tag ist, sonst Mittag (vermeidet Tagesgrenzen-Artefakte bei
 * Zeitzonen-Rundungen für vergangene/zukünftige Tage).
 */
export function defaultEatenAtIso(dateString: string, now: Date = new Date()): string {
  if (isToday(dateString, now)) return now.toISOString();
  return new Date(`${dateString}T12:00:00`).toISOString();
}
