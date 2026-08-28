import type {
  LastSetsResponse,
  StrengthStatsResponse,
  ListWorkoutsQuery,
  SetDto,
  UpsertSetRequest,
  UpsertWorkoutRequest,
  WorkoutDto,
} from '@repfuel/shared';
import { computeStrengthStats } from './strength-stats.js';
import { AppError } from '../../../core/errors.js';
import type { EventBus } from '../../../core/event-bus.js';
import type { RoutineRepo } from '../repositories/routine-repo.js';
import type { WorkoutRepo } from '../repositories/workout-repo.js';
import type { SetRow, WorkoutRow } from '../schema.js';
import type { ExerciseService } from './exercise-service.js';

function toSetDto(row: SetRow): SetDto {
  return {
    id: row.id,
    workoutId: row.workoutId,
    exerciseId: row.exerciseId,
    position: row.position,
    reps: row.reps,
    weightKg: row.weightKg,
    isWarmup: row.isWarmup,
    rpe: row.rpe,
  };
}

function toWorkoutDto(row: WorkoutRow, setRows: SetRow[]): WorkoutDto {
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    routineId: row.routineId,
    notes: row.notes,
    sets: setRows.filter((s) => s.workoutId === row.id).map(toSetDto),
  };
}

export type WorkoutService = ReturnType<typeof createWorkoutService>;

export function createWorkoutService(deps: {
  workoutRepo: WorkoutRepo;
  routineRepo: RoutineRepo;
  exerciseService: ExerciseService;
  eventBus: EventBus;
}) {
  const { workoutRepo, routineRepo, exerciseService, eventBus } = deps;

  /** Upsert per client-UUID: existierende fremde IDs sind ein Konflikt. */
  async function assertUpsertable(userId: string, id: string): Promise<WorkoutRow | null> {
    const existing = await workoutRepo.findByIdAnyUser(id);
    if (existing && existing.userId !== userId) {
      throw new AppError('conflict', 'Workout id already exists');
    }
    return existing;
  }

  return {
    async upsert(userId: string, id: string, input: UpsertWorkoutRequest): Promise<WorkoutDto> {
      await assertUpsertable(userId, id);
      if (input.routineId) {
        const routine = await routineRepo.findById(userId, input.routineId);
        if (!routine) throw new AppError('not_found', 'Routine not found');
      }
      const row = await workoutRepo.upsert({
        id,
        userId,
        startedAt: new Date(input.startedAt),
        finishedAt: input.finishedAt ? new Date(input.finishedAt) : null,
        routineId: input.routineId ?? null,
        notes: input.notes ?? null,
      });
      if (input.finishedAt) {
        await eventBus.publish('workout.finished', { userId, workoutId: id });
      }
      const setRows = await workoutRepo.listSets([row.id]);
      return toWorkoutDto(row, setRows);
    },

    async list(userId: string, query: ListWorkoutsQuery): Promise<WorkoutDto[]> {
      const rows = await workoutRepo.list(userId, {
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        limit: query.limit,
      });
      const setRows = await workoutRepo.listSets(rows.map((w) => w.id));
      return rows.map((w) => toWorkoutDto(w, setRows));
    },

    async get(userId: string, id: string): Promise<WorkoutDto> {
      const row = await workoutRepo.findById(userId, id);
      if (!row) throw new AppError('not_found', 'Workout not found');
      return toWorkoutDto(row, await workoutRepo.listSets([row.id]));
    },

    async remove(userId: string, id: string): Promise<void> {
      const row = await workoutRepo.softDelete(userId, id);
      if (!row) throw new AppError('not_found', 'Workout not found');
    },

    async upsertSet(
      userId: string,
      workoutId: string,
      setId: string,
      input: UpsertSetRequest,
    ): Promise<SetDto> {
      const workout = await workoutRepo.findById(userId, workoutId);
      if (!workout) throw new AppError('not_found', 'Workout not found');
      const existing = await workoutRepo.findSetByIdAnyWorkout(setId);
      if (existing && existing.workoutId !== workoutId) {
        throw new AppError('conflict', 'Set id already exists');
      }
      await exerciseService.assertVisible(userId, [input.exerciseId]);
      const row = await workoutRepo.upsertSet({
        id: setId,
        workoutId,
        exerciseId: input.exerciseId,
        position: input.position,
        reps: input.reps,
        weightKg: input.weightKg,
        isWarmup: input.isWarmup,
        rpe: input.rpe ?? null,
      });
      return toSetDto(row);
    },

    async removeSet(userId: string, workoutId: string, setId: string): Promise<void> {
      const workout = await workoutRepo.findById(userId, workoutId);
      if (!workout) throw new AppError('not_found', 'Workout not found');
      const existing = await workoutRepo.findSetByIdAnyWorkout(setId);
      if (!existing || existing.workoutId !== workoutId) {
        throw new AppError('not_found', 'Set not found');
      }
      await workoutRepo.softDeleteSet(setId);
    },

    async strengthStats(userId: string, exerciseId: string): Promise<StrengthStatsResponse> {
      const rows = await workoutRepo.setsWithDatesForExercise(userId, exerciseId);
      return computeStrengthStats(
        exerciseId,
        rows.map(({ set, startedAt }) => ({
          reps: set.reps,
          weightKg: set.weightKg,
          isWarmup: set.isWarmup,
          date: startedAt,
        })),
      );
    },

    async lastSets(userId: string, exerciseIds: string[]): Promise<LastSetsResponse> {
      const result: LastSetsResponse = {};
      for (const exerciseId of exerciseIds) {
        const previous = await workoutRepo.lastSetsForExercise(userId, exerciseId);
        if (!previous) continue;
        result[exerciseId] = {
          performedAt: previous.performedAt.toISOString(),
          sets: previous.sets.map(toSetDto),
        };
      }
      return result;
    },
  };
}
