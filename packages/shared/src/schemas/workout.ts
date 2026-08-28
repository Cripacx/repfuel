import { z } from 'zod';
import { uuidSchema } from './common.js';

export const isoDateTimeSchema = z.string().datetime({ offset: true });

// --- Übungen ---

export const EXERCISE_SOURCES = ['wger', 'gymvisual', 'custom'] as const;
export type ExerciseSource = (typeof EXERCISE_SOURCES)[number];

/**
 * Pflicht-Attribution für die Übungsmedien (Thumbnails + Animationen) des
 * Datensatzes hasaneyldrm/exercises-dataset. Die Medien selbst sind NICHT
 * MIT-lizenziert, sondern Eigentum von Gym visual; jede Anzeige muss diesen
 * Hinweis führen (siehe apps/server/src/modules/workout/seed/README.md).
 */
export const EXERCISE_MEDIA_ATTRIBUTION = '© Gym visual — https://gymvisual.com/';
export const EXERCISE_MEDIA_ATTRIBUTION_URL = 'https://gymvisual.com/';

export const createExerciseRequestSchema = z.object({
  name: z.string().min(1).max(200),
  muscleGroups: z.array(z.string().min(1).max(50)).max(10).default([]),
  equipment: z.string().min(1).max(100).nullable().optional(),
});
export type CreateExerciseRequest = z.infer<typeof createExerciseRequestSchema>;

export const listExercisesQuerySchema = z.object({
  q: z.string().max(200).optional(),
  muscle: z.string().max(50).optional(),
  equipment: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListExercisesQuery = z.infer<typeof listExercisesQuerySchema>;

// --- Routinen ---

export const routineItemInputSchema = z.object({
  exerciseId: uuidSchema,
  position: z.number().int().min(0).max(200),
  supersetGroup: z.number().int().min(0).max(50).nullable().optional(),
  targetSets: z.number().int().min(1).max(20),
  targetReps: z.number().int().min(1).max(200),
  targetWeightKg: z.number().min(0).max(1000).nullable().optional(),
});
export type RoutineItemInput = z.infer<typeof routineItemInputSchema>;

export const createRoutineRequestSchema = z.object({
  name: z.string().min(1).max(100),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  items: z.array(routineItemInputSchema).max(100).default([]),
});
export type CreateRoutineRequest = z.infer<typeof createRoutineRequestSchema>;

/** items ersetzt bei Angabe die komplette Liste (Full-Replace). */
export const updateRoutineRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  items: z.array(routineItemInputSchema).max(100).optional(),
});
export type UpdateRoutineRequest = z.infer<typeof updateRoutineRequestSchema>;

// --- Workouts & Sätze (client-generierte UUIDs für Offline-Sync-Kompatibilität) ---

export const upsertWorkoutRequestSchema = z.object({
  startedAt: isoDateTimeSchema,
  finishedAt: isoDateTimeSchema.nullable().optional(),
  routineId: uuidSchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpsertWorkoutRequest = z.infer<typeof upsertWorkoutRequestSchema>;

export const upsertSetRequestSchema = z.object({
  exerciseId: uuidSchema,
  position: z.number().int().min(0).max(500),
  reps: z.number().int().min(0).max(1000),
  weightKg: z.number().min(0).max(1500),
  isWarmup: z.boolean().default(false),
  rpe: z.number().min(1).max(10).nullable().optional(),
});
export type UpsertSetRequest = z.infer<typeof upsertSetRequestSchema>;

export const listWorkoutsQuerySchema = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListWorkoutsQuery = z.infer<typeof listWorkoutsQuerySchema>;

export const lastSetsQuerySchema = z.object({
  exerciseIds: z
    .string()
    .min(1)
    .transform((s) => s.split(','))
    .pipe(z.array(uuidSchema).min(1).max(50)),
});
// ---------- Aktivitäten (Cardio & Co. neben Kraft-Workouts) ----------

export const ACTIVITY_TYPES = [
  'walk',
  'run',
  'bike',
  'swim',
  'row',
  'hike',
  'sport',
  'other',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const upsertActivityRequestSchema = z.object({
  activityType: z.enum(ACTIVITY_TYPES),
  startedAt: isoDateTimeSchema,
  durationMin: z.number().int().min(1).max(1440),
  /** Optional — wer den Wert nicht kennt, loggt nur Typ und Dauer. */
  kcal: z.number().int().min(0).max(10000).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type UpsertActivityRequest = z.infer<typeof upsertActivityRequestSchema>;

export const listActivitiesQuerySchema = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;
