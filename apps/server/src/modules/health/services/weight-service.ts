import type { BodyWeightDto, ListWeightQuery, UpsertWeightRequest } from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { WeightRepo } from '../repositories/weight-repo.js';
import type { BodyWeightRow } from '../schema.js';

function toDto(row: BodyWeightRow): BodyWeightDto {
  return {
    id: row.id,
    weightKg: row.weightKg,
    measuredAt: row.measuredAt.toISOString(),
  };
}

export type WeightService = ReturnType<typeof createWeightService>;

export function createWeightService(weightRepo: WeightRepo) {
  return {
    async upsert(userId: string, id: string, input: UpsertWeightRequest): Promise<BodyWeightDto> {
      const existing = await weightRepo.findByIdAnyUser(id);
      if (existing && existing.userId !== userId) {
        throw new AppError('conflict', 'Weight entry id already exists');
      }
      const row = await weightRepo.upsert({
        id,
        userId,
        measuredAt: new Date(input.measuredAt),
        weightKg: input.weightKg,
      });
      return toDto(row);
    },

    async list(userId: string, query: ListWeightQuery): Promise<BodyWeightDto[]> {
      const rows = await weightRepo.list(userId, {
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        limit: query.limit,
      });
      return rows.map(toDto);
    },

    async remove(userId: string, id: string): Promise<void> {
      const row = await weightRepo.softDelete(userId, id);
      if (!row) throw new AppError('not_found', 'Weight entry not found');
    },
  };
}
