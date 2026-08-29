import { and, asc, desc, eq, gte, inArray, isNull, lte, type SQL } from 'drizzle-orm';
import type { Database } from '../../../core/db.js';
import { sets, workouts, type SetRow, type WorkoutRow } from '../schema.js';

export interface WorkoutUpsert {
  id: string;
  userId: string;
  startedAt: Date;
  finishedAt: Date | null;
  routineId: string | null;
  notes: string | null;
}

export interface SetUpsert {
  id: string;
  workoutId: string;
  exerciseId: string;
  position: number;
  reps: number;
  weightKg: number;
  isWarmup: boolean;
  rpe: number | null;
}

export interface WorkoutRepo {
  findByIdAnyUser(id: string): Promise<WorkoutRow | null>;
  findById(userId: string, id: string): Promise<WorkoutRow | null>;
  list(userId: string, filter: { from?: Date; to?: Date; limit: number }): Promise<WorkoutRow[]>;
  upsert(input: WorkoutUpsert): Promise<WorkoutRow>;
  softDelete(userId: string, id: string): Promise<WorkoutRow | null>;
  listSets(workoutIds: string[]): Promise<SetRow[]>;
  findSetByIdAnyWorkout(id: string): Promise<SetRow | null>;
  upsertSet(input: SetUpsert): Promise<SetRow>;
  softDeleteSet(id: string): Promise<void>;
  /**
   * Sätze des jüngsten Workouts des Nutzers, das die Übung enthält, samt dessen
   * Startzeit. `null`, wenn die Übung noch nie geloggt wurde.
   */
  lastSetsForExercise(
    userId: string,
    exerciseId: string,
  ): Promise<{ performedAt: Date; sets: SetRow[] } | null>;
  /** Alle Sätze einer Übung inkl. Workout-Datum (für PRs/Wochentrends). */
  setsWithDatesForExercise(
    userId: string,
    exerciseId: string,
  ): Promise<{ set: SetRow; startedAt: Date }[]>;
}

const ownedBy = (userId: string) => and(eq(workouts.userId, userId), isNull(workouts.deletedAt));

export function createWorkoutRepo(db: Database): WorkoutRepo {
  return {
    async findByIdAnyUser(id) {
      const rows = await db.select().from(workouts).where(eq(workouts.id, id)).limit(1);
      return rows[0] ?? null;
    },
    async findById(userId, id) {
      const rows = await db
        .select()
        .from(workouts)
        .where(and(eq(workouts.id, id), ownedBy(userId)))
        .limit(1);
      return rows[0] ?? null;
    },
    async list(userId, filter) {
      const conditions: (SQL | undefined)[] = [ownedBy(userId)];
      if (filter.from) conditions.push(gte(workouts.startedAt, filter.from));
      if (filter.to) conditions.push(lte(workouts.startedAt, filter.to));
      return db
        .select()
        .from(workouts)
        .where(and(...conditions))
        .orderBy(desc(workouts.startedAt))
        .limit(filter.limit);
    },
    async upsert(input) {
      const rows = await db
        .insert(workouts)
        .values({ ...input, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: workouts.id,
          set: {
            startedAt: input.startedAt,
            finishedAt: input.finishedAt,
            routineId: input.routineId,
            notes: input.notes,
            deletedAt: null,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!rows[0]) throw new Error('upsert workouts returned no row');
      return rows[0];
    },
    async softDelete(userId, id) {
      const rows = await db
        .update(workouts)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(workouts.id, id), ownedBy(userId)))
        .returning();
      return rows[0] ?? null;
    },
    async listSets(workoutIds) {
      if (workoutIds.length === 0) return [];
      return db
        .select()
        .from(sets)
        .where(and(inArray(sets.workoutId, workoutIds), isNull(sets.deletedAt)))
        .orderBy(asc(sets.position));
    },
    async findSetByIdAnyWorkout(id) {
      const rows = await db.select().from(sets).where(eq(sets.id, id)).limit(1);
      return rows[0] ?? null;
    },
    async upsertSet(input) {
      const rows = await db
        .insert(sets)
        .values({ ...input, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: sets.id,
          set: {
            exerciseId: input.exerciseId,
            position: input.position,
            reps: input.reps,
            weightKg: input.weightKg,
            isWarmup: input.isWarmup,
            rpe: input.rpe,
            deletedAt: null,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!rows[0]) throw new Error('upsert sets returned no row');
      return rows[0];
    },
    async softDeleteSet(id) {
      await db.update(sets).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(sets.id, id));
    },
    async lastSetsForExercise(userId, exerciseId) {
      const latest = await db
        .select({ workoutId: sets.workoutId, startedAt: workouts.startedAt })
        .from(sets)
        .innerJoin(workouts, eq(sets.workoutId, workouts.id))
        .where(
          and(eq(sets.exerciseId, exerciseId), isNull(sets.deletedAt), ownedBy(userId)),
        )
        .orderBy(desc(workouts.startedAt))
        .limit(1);
      const previous = latest[0];
      if (!previous) return null;
      const { workoutId, startedAt } = previous;
      const rows = await db
        .select()
        .from(sets)
        .where(
          and(
            eq(sets.workoutId, workoutId),
            eq(sets.exerciseId, exerciseId),
            isNull(sets.deletedAt),
          ),
        )
        .orderBy(asc(sets.position));
      return { performedAt: startedAt, sets: rows };
    },
    async setsWithDatesForExercise(userId, exerciseId) {
      const rows = await db
        .select({ set: sets, startedAt: workouts.startedAt })
        .from(sets)
        .innerJoin(workouts, eq(sets.workoutId, workouts.id))
        .where(and(eq(sets.exerciseId, exerciseId), isNull(sets.deletedAt), ownedBy(userId)))
        .orderBy(asc(workouts.startedAt));
      return rows;
    },
  };
}
