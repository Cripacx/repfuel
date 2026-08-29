import type { ActivityDto, ListActivitiesQuery, UpsertActivityRequest } from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { ActivityRepo } from '../repositories/activity-repo.js';
import type { ActivityRow } from '../schema.js';

function toActivityDto(row: ActivityRow): ActivityDto {
  return {
    id: row.id,
    activityType: row.activityType,
    startedAt: row.startedAt.toISOString(),
    durationMin: row.durationMin,
    kcal: row.kcal,
    notes: row.notes,
  };
}

export type ActivityService = ReturnType<typeof createActivityService>;

/** Cardio & Co. — freie Aktivitäten neben den Satz-basierten Kraft-Workouts. */
export function createActivityService(activityRepo: ActivityRepo) {
  return {
    /** Upsert per client-UUID: existierende fremde IDs sind ein Konflikt. */
    async upsert(userId: string, id: string, input: UpsertActivityRequest): Promise<ActivityDto> {
      const existing = await activityRepo.findByIdAnyUser(id);
      if (existing && existing.userId !== userId) {
        throw new AppError('conflict', 'Activity id already exists');
      }
      const row = await activityRepo.upsert({
        id,
        userId,
        activityType: input.activityType,
        startedAt: new Date(input.startedAt),
        durationMin: input.durationMin,
        kcal: input.kcal ?? null,
        notes: input.notes ?? null,
      });
      return toActivityDto(row);
    },

    async list(userId: string, query: ListActivitiesQuery): Promise<ActivityDto[]> {
      const rows = await activityRepo.list(userId, {
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        limit: query.limit,
      });
      return rows.map(toActivityDto);
    },

    async remove(userId: string, id: string): Promise<void> {
      const row = await activityRepo.softDelete(userId, id);
      if (!row) throw new AppError('not_found', 'Activity not found');
    },
  };
}
