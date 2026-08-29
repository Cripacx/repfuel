/** Ein Tag im Monatsraster. */
export interface MonthGridDay {
  /** YYYY-MM-DD */
  date: string;
  /** false für die Rand-Tage aus Vor-/Folgemonat, die die Woche auffüllen. */
  inMonth: boolean;
}

/** YYYY-MM des Monats, in dem `date` liegt. */
export function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function keyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Verschiebt einen Monatsschlüssel um `delta` Monate. */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** Erster und letzter Tag des Monats — der Bereich, für den Tageswerte geladen werden. */
export function monthBounds(monthKey: string): { from: string; to: string } {
  const [year, month] = monthKey.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  return { from: keyOf(first), to: keyOf(last) };
}

/**
 * Monatsraster als vollständige Wochenzeilen, Montag zuerst. Rand-Tage aus den
 * Nachbarmonaten werden mitgeliefert (statt Lücken zu lassen), damit das Raster
 * immer sieben Spalten hat und nicht springt.
 */
export function buildMonthGrid(monthKey: string): MonthGridDay[][] {
  const [year, month] = monthKey.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const isoDay = first.getUTCDay() || 7;

  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - (isoDay - 1));

  const lastOfMonth = keyOf(new Date(Date.UTC(year, month, 0)));
  const weeks: MonthGridDay[][] = [];

  // Solange eine Woche noch im Monat beginnt, gehört sie ins Raster — das ergibt
  // je nach Starttag vier bis sechs Zeilen, ohne feste Zeilenzahl zu erzwingen.
  while (keyOf(cursor) <= lastOfMonth) {
    const week: MonthGridDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: keyOf(cursor), inMonth: cursor.getUTCMonth() === month - 1 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}
