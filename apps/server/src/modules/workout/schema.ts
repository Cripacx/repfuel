import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { ActivityType, ExerciseSource } from '@repfuel/shared';
import { users } from '../auth/schema.js';

export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** wger-Übungs-ID des Altbestands (null bei gymvisual/custom). */
    wgerId: integer('wger_id').unique(),
    /** Dataset-ID (z.B. "0001") für idempotenten Seed (null bei wger/custom). */
    datasetId: text('dataset_id').unique(),
    name: text('name').notNull(),
    nameDe: text('name_de'),
    muscleGroups: jsonb('muscle_groups').$type<string[]>().notNull().default([]),
    /** Schritt-für-Schritt-Anleitung (en, aus dem Dataset; leer bei custom). */
    instructions: jsonb('instructions').$type<string[]>().notNull().default([]),
    equipment: text('equipment'),
    mediaUrl: text('media_url'),
    gifUrl: text('gif_url'),
    source: text('source').$type<ExerciseSource>().notNull().default('custom'),
    /** null = globale Übung (Seed), sonst eigene Übung des Nutzers. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('exercises_user_id_idx').on(t.userId)],
);

export const routines = pgTable(
  'routines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    weekday: integer('weekday'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('routines_user_id_idx').on(t.userId)],
);

export const routineItems = pgTable(
  'routine_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    routineId: uuid('routine_id')
      .notNull()
      .references(() => routines.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    supersetGroup: integer('superset_group'),
    targetSets: integer('target_sets').notNull(),
    targetReps: integer('target_reps').notNull(),
    targetWeightKg: numeric('target_weight_kg', { precision: 6, scale: 2, mode: 'number' }),
  },
  (t) => [index('routine_items_routine_id_idx').on(t.routineId)],
);

export const workouts = pgTable(
  'workouts',
  {
    /** Client-generierte UUID (Offline-Sync: Upsert per UUID). */
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    routineId: uuid('routine_id').references(() => routines.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('workouts_user_id_idx').on(t.userId)],
);

export const sets = pgTable(
  'sets',
  {
    /** Client-generierte UUID (Offline-Sync: Upsert per UUID). */
    id: uuid('id').primaryKey(),
    workoutId: uuid('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    reps: integer('reps').notNull(),
    weightKg: numeric('weight_kg', { precision: 6, scale: 2, mode: 'number' }).notNull(),
    isWarmup: boolean('is_warmup').notNull().default(false),
    rpe: numeric('rpe', { precision: 3, scale: 1, mode: 'number' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('sets_workout_id_idx').on(t.workoutId), index('sets_exercise_id_idx').on(t.exerciseId)],
);

export type ExerciseRow = typeof exercises.$inferSelect;
export type RoutineRow = typeof routines.$inferSelect;
export type RoutineItemRow = typeof routineItems.$inferSelect;
export type WorkoutRow = typeof workouts.$inferSelect;
export type SetRow = typeof sets.$inferSelect;

export const activities = pgTable(
  'activities',
  {
    /** Client-generierte UUID (Upsert per PUT wie bei Workouts/Meals). */
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    activityType: text('activity_type').$type<ActivityType>().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    durationMin: integer('duration_min').notNull(),
    kcal: integer('kcal'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('activities_user_id_idx').on(t.userId)],
);

export type ActivityRow = typeof activities.$inferSelect;
