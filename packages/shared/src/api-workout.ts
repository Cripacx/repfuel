import type { ActivityType, ExerciseSource } from './schemas/workout.js';

/** Response-DTOs der Workout-/Gewichts-API (M2). */

export interface ExerciseDto {
  id: string;
  name: string;
  /** Deutscher Name, falls vorhanden (nur wger-Altbestand). */
  nameDe: string | null;
  muscleGroups: string[];
  /** Schritt-für-Schritt-Anleitung (en, aus dem Dataset; leer bei custom). */
  instructions: string[];
  equipment: string | null;
  /** Standbild/Thumbnail, z.B. /media/img/0001-2gPfomN.jpg. */
  mediaUrl: string | null;
  /** Animation, z.B. /media/gif/0001-2gPfomN.gif. */
  gifUrl: string | null;
  source: ExerciseSource;
  /** null = globale Übung, sonst eigene Übung des Nutzers. */
  userId: string | null;
}

/** Verfügbare Filterwerte der sichtbaren Übungsbibliothek. */
export interface ExerciseFacetsDto {
  /** Primäre Zielmuskeln, alphabetisch. */
  muscles: string[];
  /** Equipment-Werte, alphabetisch. */
  equipment: string[];
}

/** Trainingsaktivität für Heatmap und Serien-Kacheln. */
export interface ActivityStatsResponse {
  /** Lückenlose Tagesreihe (aufsteigend) mit trainierten Minuten je Tag. */
  days: { date: string; minutes: number }[];
  totalWorkouts: number;
  workoutsThisMonth: number;
  workoutsThisWeek: number;
  /** Aufeinanderfolgende Wochen mit mindestens einem Workout. */
  weekStreak: number;
}

export interface RoutineItemDto {
  id: string;
  exerciseId: string;
  position: number;
  supersetGroup: number | null;
  targetSets: number;
  targetReps: number;
  targetWeightKg: number | null;
  exercise: ExerciseDto | null;
}

export interface RoutineDto {
  id: string;
  name: string;
  weekday: number | null;
  items: RoutineItemDto[];
}

export interface SetDto {
  id: string;
  workoutId: string;
  exerciseId: string;
  position: number;
  reps: number;
  weightKg: number;
  isWarmup: boolean;
  rpe: number | null;
}

export interface WorkoutDto {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  routineId: string | null;
  notes: string | null;
  sets: SetDto[];
}

/** Letzte geloggte Sätze je Übung (Prefill im Logging-Screen). */
/** Die Sätze des jüngsten Workouts mit dieser Übung, plus dessen Datum. */
export interface LastSetsEntry {
  /** Startzeit des Workouts, aus dem diese Sätze stammen (ISO-8601). */
  performedAt: string;
  sets: SetDto[];
}

export type LastSetsResponse = Record<string, LastSetsEntry>;

export interface ActivityDto {
  id: string;
  activityType: ActivityType;
  startedAt: string;
  durationMin: number;
  kcal: number | null;
  notes: string | null;
}

export interface BodyWeightDto {
  id: string;
  weightKg: number;
  measuredAt: string;
}

// ---------- M7: Health-Metriken, API-Tokens, Statistiken, Export ----------

export interface HealthMetricDto {
  id: string;
  metric: string;
  value: number;
  measuredAt: string;
  source: string;
}

export interface HealthStatsResponse {
  metric: string;
  entries: { measuredAt: string; value: number; source: string }[];
}

export interface HealthIngestResponse {
  accepted: number;
  ignoredMetrics: string[];
  mirroredWeights: number;
}

export interface ApiTokenDto {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreatedApiTokenDto extends ApiTokenDto {
  /** Nur einmal bei der Erzeugung sichtbar. */
  token: string;
}

export interface StrengthStatsResponse {
  exerciseId: string;
  prs: {
    maxWeightKg: number | null;
    maxReps: number | null;
    bestEst1RmKg: number | null;
    bestSet: { reps: number; weightKg: number; date: string } | null;
  };
  /** ISO-Woche (YYYY-Www) → Gesamtvolumen (kg·Wdh) und Satzanzahl. */
  weeklyTrend: { week: string; volumeKg: number; sets: number }[];
  /** Verlauf je Workout (jüngstes zuerst), nur Arbeitssätze. */
  history: {
    /** Startzeit des Workouts (ISO-8601). */
    date: string;
    topWeightKg: number;
    bestEst1RmKg: number;
    sets: { reps: number; weightKg: number; rpe: number | null }[];
  }[];
}
