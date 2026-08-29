import type {
  CreateRoutineRequest,
  RoutineDto,
  RoutineItemDto,
  UpdateRoutineRequest,
} from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { ExerciseRepo } from '../repositories/exercise-repo.js';
import type { RoutineRepo } from '../repositories/routine-repo.js';
import type { ExerciseRow, RoutineItemRow, RoutineRow } from '../schema.js';
import { toExerciseDto, type ExerciseService } from './exercise-service.js';

function toItemDto(row: RoutineItemRow, exercise: ExerciseRow | undefined): RoutineItemDto {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    position: row.position,
    supersetGroup: row.supersetGroup,
    targetSets: row.targetSets,
    targetReps: row.targetReps,
    targetWeightKg: row.targetWeightKg,
    exercise: exercise ? toExerciseDto(exercise) : null,
  };
}

export type RoutineService = ReturnType<typeof createRoutineService>;

export function createRoutineService(deps: {
  routineRepo: RoutineRepo;
  exerciseRepo: ExerciseRepo;
  exerciseService: ExerciseService;
}) {
  const { routineRepo, exerciseRepo, exerciseService } = deps;

  async function assembleDtos(userId: string, rows: RoutineRow[]): Promise<RoutineDto[]> {
    const items = await routineRepo.listItems(rows.map((r) => r.id));
    const exerciseIds = [...new Set(items.map((i) => i.exerciseId))];
    const exercises = await exerciseRepo.findVisibleByIds(userId, exerciseIds);
    const byId = new Map(exercises.map((e) => [e.id, e]));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      weekday: r.weekday,
      items: items.filter((i) => i.routineId === r.id).map((i) => toItemDto(i, byId.get(i.exerciseId))),
    }));
  }

  return {
    async list(userId: string): Promise<RoutineDto[]> {
      return assembleDtos(userId, await routineRepo.list(userId));
    },

    async get(userId: string, id: string): Promise<RoutineDto> {
      const row = await routineRepo.findById(userId, id);
      if (!row) throw new AppError('not_found', 'Routine not found');
      const [dto] = await assembleDtos(userId, [row]);
      return dto!;
    },

    async create(userId: string, input: CreateRoutineRequest): Promise<RoutineDto> {
      await exerciseService.assertVisible(
        userId,
        input.items.map((i) => i.exerciseId),
      );
      const row = await routineRepo.create(userId, {
        name: input.name,
        weekday: input.weekday ?? null,
      });
      await routineRepo.replaceItems(
        row.id,
        input.items.map((i) => ({
          exerciseId: i.exerciseId,
          position: i.position,
          supersetGroup: i.supersetGroup ?? null,
          targetSets: i.targetSets,
          targetReps: i.targetReps,
          targetWeightKg: i.targetWeightKg ?? null,
        })),
      );
      return this.get(userId, row.id);
    },

    async update(userId: string, id: string, input: UpdateRoutineRequest): Promise<RoutineDto> {
      const existing = await routineRepo.findById(userId, id);
      if (!existing) throw new AppError('not_found', 'Routine not found');
      if (input.name !== undefined || input.weekday !== undefined) {
        await routineRepo.update(userId, id, {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.weekday !== undefined ? { weekday: input.weekday } : {}),
        });
      }
      if (input.items) {
        await exerciseService.assertVisible(
          userId,
          input.items.map((i) => i.exerciseId),
        );
        await routineRepo.replaceItems(
          id,
          input.items.map((i) => ({
            exerciseId: i.exerciseId,
            position: i.position,
            supersetGroup: i.supersetGroup ?? null,
            targetSets: i.targetSets,
            targetReps: i.targetReps,
            targetWeightKg: i.targetWeightKg ?? null,
          })),
        );
      }
      return this.get(userId, id);
    },

    async remove(userId: string, id: string): Promise<void> {
      const row = await routineRepo.softDelete(userId, id);
      if (!row) throw new AppError('not_found', 'Routine not found');
    },
  };
}
