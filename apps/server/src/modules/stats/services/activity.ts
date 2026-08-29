import type { ActivityStatsResponse } from '@repfuel/shared';

export interface ActivityWorkoutInput {
  startedAt: Date;
  finishedAt: Date | null;
}

/** Lokaler Tagesschlüssel in UTC — dieselbe Basis wie die gespeicherten Zeitstempel. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Montag der ISO-Woche als Schlüssel. Wochen (nicht Tage) sind die Einheit der
 * Serie: Trainingspläne laufen in Wochen, und ein Ruhetag darf keine Serie
 * reißen.
 */
export function weekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const isoDay = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (isoDay - 1));
  return dayKey(d);
}

function addWeeks(isoDate: string, weeks: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return dayKey(d);
}

/** Dauer in Minuten; unbeendete Workouts zählen als Trainingstag, aber mit 0 Minuten. */
function durationMinutes(workout: ActivityWorkoutInput): number {
  if (!workout.finishedAt) return 0;
  const ms = workout.finishedAt.getTime() - workout.startedAt.getTime();
  return ms > 0 ? Math.round(ms / 60000) : 0;
}

/**
 * Aggregiert Workouts zu Tageswerten, Zählern und der Wochenserie.
 *
 * `now` wird übergeben statt intern gelesen, damit die Berechnung testbar ist
 * und Aufrufer denselben Zeitpunkt für alle Kennzahlen verwenden.
 */
export function computeActivityStats(
  workouts: readonly ActivityWorkoutInput[],
  now: Date,
  weeksBack = 53,
): ActivityStatsResponse {
  const minutesByDay = new Map<string, number>();
  const weeksWithWorkout = new Set<string>();
  const currentMonth = now.toISOString().slice(0, 7);

  let total = 0;
  let thisMonth = 0;

  for (const workout of workouts) {
    const day = dayKey(workout.startedAt);
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + durationMinutes(workout));
    weeksWithWorkout.add(weekStart(workout.startedAt));
    total += 1;
    if (day.startsWith(currentMonth)) thisMonth += 1;
  }

  // Serie ab der laufenden Woche rückwärts. Eine noch leere aktuelle Woche
  // bricht die Serie nicht — sie hat ja noch Zeit; gezählt wird dann ab der
  // Vorwoche.
  const thisWeek = weekStart(now);
  let weekStreak = 0;
  let cursor = weeksWithWorkout.has(thisWeek) ? thisWeek : addWeeks(thisWeek, -1);
  while (weeksWithWorkout.has(cursor)) {
    weekStreak += 1;
    cursor = addWeeks(cursor, -1);
  }

  // Lückenlose Tagesreihe, damit das Frontend nur zeichnen und nicht rechnen muss.
  const firstDay = addWeeks(thisWeek, -(weeksBack - 1));
  const days: ActivityStatsResponse['days'] = [];
  const cursorDate = new Date(`${firstDay}T00:00:00.000Z`);
  const lastDate = new Date(`${addWeeks(thisWeek, 1)}T00:00:00.000Z`);
  while (cursorDate < lastDate) {
    const key = dayKey(cursorDate);
    days.push({ date: key, minutes: minutesByDay.get(key) ?? 0 });
    cursorDate.setUTCDate(cursorDate.getUTCDate() + 1);
  }

  return {
    days,
    totalWorkouts: total,
    workoutsThisMonth: thisMonth,
    workoutsThisWeek: workouts.filter((w) => weekStart(w.startedAt) === thisWeek).length,
    weekStreak,
  };
}
