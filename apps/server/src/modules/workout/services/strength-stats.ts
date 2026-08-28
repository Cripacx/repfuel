import type { StrengthStatsResponse } from '@repfuel/shared';

/** Reine Statistik-Berechnung: PRs + Wochentrends + Verlauf (Unit-getestet). */
export interface StrengthSetInput {
  reps: number;
  weightKg: number;
  isWarmup: boolean;
  date: Date;
  /** Gruppiert den Verlauf: alle Sätze desselben Workouts bilden einen Eintrag. */
  workoutId: string;
  /** Reihenfolge innerhalb des Workouts. */
  position: number;
  rpe: number | null;
}

export function isoWeek(date: Date): string {
  // ISO-8601-Woche (UTC): Donnerstag der Woche bestimmt das Jahr.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Epley-Formel für das geschätzte 1RM. */
export function estimate1Rm(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function computeStrengthStats(
  exerciseId: string,
  sets: StrengthSetInput[],
  weeksLimit = 12,
  historyLimit = 20,
): StrengthStatsResponse {
  const working = sets.filter((s) => !s.isWarmup && s.reps > 0);

  let maxWeightKg: number | null = null;
  let maxReps: number | null = null;
  let bestEst1RmKg: number | null = null;
  let bestSet: StrengthStatsResponse['prs']['bestSet'] = null;

  for (const s of working) {
    if (maxWeightKg === null || s.weightKg > maxWeightKg) maxWeightKg = s.weightKg;
    if (maxReps === null || s.reps > maxReps) maxReps = s.reps;
    const est = estimate1Rm(s.weightKg, s.reps);
    if (bestEst1RmKg === null || est > bestEst1RmKg) {
      bestEst1RmKg = est;
      bestSet = { reps: s.reps, weightKg: s.weightKg, date: s.date.toISOString() };
    }
  }

  const byWeek = new Map<string, { volumeKg: number; sets: number }>();
  for (const s of working) {
    const week = isoWeek(s.date);
    const entry = byWeek.get(week) ?? { volumeKg: 0, sets: 0 };
    entry.volumeKg += s.weightKg * s.reps;
    entry.sets += 1;
    byWeek.set(week, entry);
  }
  const weeklyTrend = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-weeksLimit)
    .map(([week, v]) => ({ week, volumeKg: Math.round(v.volumeKg), sets: v.sets }));

  // Verlauf: ein Eintrag pro Workout (jüngstes zuerst) mit allen Arbeitssätzen —
  // das ist die "Wie lief es die letzten Male?"-Ansicht neben dem reinen Trend.
  const byWorkout = new Map<string, { date: Date; sets: StrengthSetInput[] }>();
  for (const s of working) {
    const entry = byWorkout.get(s.workoutId) ?? { date: s.date, sets: [] };
    entry.sets.push(s);
    byWorkout.set(s.workoutId, entry);
  }
  const history = [...byWorkout.values()]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, historyLimit)
    .map((w) => {
      const ordered = [...w.sets].sort((a, b) => a.position - b.position);
      let topWeightKg = 0;
      let bestWorkout1Rm = 0;
      for (const s of ordered) {
        if (s.weightKg > topWeightKg) topWeightKg = s.weightKg;
        const est = estimate1Rm(s.weightKg, s.reps);
        if (est > bestWorkout1Rm) bestWorkout1Rm = est;
      }
      return {
        date: w.date.toISOString(),
        topWeightKg,
        bestEst1RmKg: bestWorkout1Rm,
        sets: ordered.map((s) => ({ reps: s.reps, weightKg: s.weightKg, rpe: s.rpe })),
      };
    });

  return {
    exerciseId,
    prs: { maxWeightKg, maxReps, bestEst1RmKg, bestSet },
    weeklyTrend,
    history,
  };
}
