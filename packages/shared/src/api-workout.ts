import type { ExerciseSource } from './schemas/workout.js';

/** Response-DTOs der Workout-/Gewichts-API (M2). */

export interface ExerciseDto {
  id: string;
  name: string;
  /** Deutscher Name, falls vorhanden (wger-Übersetzung). */
  nameDe: string | null;
  muscleGroups: string[];
  equipment: string | null;
  mediaUrl: string | null;
  source: ExerciseSource;
  /** null = globale Übung, sonst eigene Übung des Nutzers. */
  userId: string | null;
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
export type LastSetsResponse = Record<string, SetDto[]>;

export interface BodyWeightDto {
  id: string;
  weightKg: number;
  measuredAt: string;
}
