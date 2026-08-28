import type { SyncBatchRequest, SyncBatchResponse, SyncItemResult } from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { WeightService } from '../../health/index.js';
import type { MealService } from '../../nutrition/index.js';
import type { WorkoutService } from '../../workout/index.js';

export interface SyncServiceDeps {
  workoutService: WorkoutService;
  weightService: WeightService;
  mealService: MealService;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error';
}

export type SyncService = ReturnType<typeof createSyncService>;

/**
 * Offline-Sync: Batch-Upsert (Last-Write-Wins per Datensatz, client-generierte
 * UUIDs verhindern Duplikate). Jedes Item wird unabhängig verarbeitet —
 * ein fehlerhaftes Item bricht den Batch nicht ab.
 */
export function createSyncService(deps: SyncServiceDeps) {
  return {
    async applyBatch(userId: string, batch: SyncBatchRequest): Promise<SyncBatchResponse> {
      const results: SyncItemResult[] = [];

      // Reihenfolge: Workouts vor Sätzen (FK), dann Meals/Gewicht, Deletions zuletzt.
      for (const { id, ...input } of batch.workouts) {
        try {
          await deps.workoutService.upsert(userId, id, input);
          results.push({ entity: 'workout', id, status: 'ok' });
        } catch (err) {
          results.push({ entity: 'workout', id, status: 'error', error: errMessage(err) });
        }
      }

      for (const { id, workoutId, ...input } of batch.sets) {
        try {
          await deps.workoutService.upsertSet(userId, workoutId, id, input);
          results.push({ entity: 'set', id, status: 'ok' });
        } catch (err) {
          results.push({ entity: 'set', id, status: 'error', error: errMessage(err) });
        }
      }

      for (const { id, ...input } of batch.meals) {
        try {
          await deps.mealService.upsert(userId, id, input);
          results.push({ entity: 'meal', id, status: 'ok' });
        } catch (err) {
          results.push({ entity: 'meal', id, status: 'error', error: errMessage(err) });
        }
      }

      for (const { id, ...input } of batch.bodyWeight) {
        try {
          await deps.weightService.upsert(userId, id, input);
          results.push({ entity: 'body_weight', id, status: 'ok' });
        } catch (err) {
          results.push({ entity: 'body_weight', id, status: 'error', error: errMessage(err) });
        }
      }

      for (const del of batch.deletions) {
        try {
          switch (del.entity) {
            case 'workout':
              await deps.workoutService.remove(userId, del.id);
              break;
            case 'set': {
              if (!del.workoutId) {
                throw new AppError('bad_request', 'workoutId required for set deletion');
              }
              await deps.workoutService.removeSet(userId, del.workoutId, del.id);
              break;
            }
            case 'meal':
              await deps.mealService.remove(userId, del.id);
              break;
            case 'body_weight':
              await deps.weightService.remove(userId, del.id);
              break;
          }
          results.push({ entity: 'deletion', id: del.id, status: 'ok' });
        } catch (err) {
          // Idempotenz: bereits gelöschte/unbekannte Datensätze gelten als erledigt.
          if (err instanceof AppError && err.code === 'not_found') {
            results.push({ entity: 'deletion', id: del.id, status: 'ok' });
          } else {
            results.push({ entity: 'deletion', id: del.id, status: 'error', error: errMessage(err) });
          }
        }
      }

      return { results };
    },
  };
}
