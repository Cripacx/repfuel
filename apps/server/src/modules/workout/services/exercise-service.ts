import type { CreateExerciseRequest, ExerciseDto, ListExercisesQuery } from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { ExerciseRepo } from '../repositories/exercise-repo.js';
import type { ExerciseRow } from '../schema.js';

export function toExerciseDto(row: ExerciseRow): ExerciseDto {
  return {
    id: row.id,
    name: row.name,
    nameDe: row.nameDe,
    muscleGroups: row.muscleGroups,
    equipment: row.equipment,
    mediaUrl: row.mediaUrl,
    source: row.source,
    userId: row.userId,
  };
}

export type ExerciseService = ReturnType<typeof createExerciseService>;

export function createExerciseService(exerciseRepo: ExerciseRepo) {
  return {
    async list(userId: string, query: ListExercisesQuery): Promise<ExerciseDto[]> {
      const rows = await exerciseRepo.list(userId, query);
      return rows.map(toExerciseDto);
    },

    async createCustom(userId: string, input: CreateExerciseRequest): Promise<ExerciseDto> {
      const row = await exerciseRepo.createCustom({
        userId,
        name: input.name,
        muscleGroups: input.muscleGroups,
        equipment: input.equipment ?? null,
      });
      return toExerciseDto(row);
    },

    /** Wirft not_found, wenn eine der Übungen für den Nutzer nicht sichtbar ist. */
    async assertVisible(userId: string, exerciseIds: string[]): Promise<void> {
      const unique = [...new Set(exerciseIds)];
      const rows = await exerciseRepo.findVisibleByIds(userId, unique);
      if (rows.length !== unique.length) {
        throw new AppError('not_found', 'Unknown exercise');
      }
    },
  };
}
