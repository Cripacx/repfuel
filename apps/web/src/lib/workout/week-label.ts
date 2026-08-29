/**
 * Formatiert die ISO-Wochen-Kennung aus `StrengthStatsResponse.weeklyTrend`
 * (`'2026-W35'`) für die Anzeige im Wochen-Volumen-Chart. Reine Funktion,
 * unabhängig von Chart.js — testbar ohne DOM.
 */
export function formatIsoWeekLabel(week: string, locale: 'de' | 'en'): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!match) return week;
  const weekNumber = Number(match[2]);
  return locale === 'de' ? `KW ${weekNumber}` : `Wk ${weekNumber}`;
}
