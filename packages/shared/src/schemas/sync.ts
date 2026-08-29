import { z } from 'zod';
import { uuidSchema } from './common.js';
import { mealEitherFoodOrQuick, mealUpsertFieldsSchema } from './nutrition.js';
import { upsertWeightRequestSchema } from './health.js';
import { upsertSetRequestSchema, upsertWorkoutRequestSchema } from './workout.js';

export const SYNC_ENTITIES = ['workout', 'set', 'meal', 'body_weight'] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

const withId = { id: uuidSchema };

export const syncBatchRequestSchema = z.object({
  workouts: z.array(upsertWorkoutRequestSchema.extend(withId)).max(200).default([]),
  sets: z
    .array(upsertSetRequestSchema.extend({ ...withId, workoutId: uuidSchema }))
    .max(2000)
    .default([]),
  meals: z
    .array(
      mealUpsertFieldsSchema.extend(withId).refine(mealEitherFoodOrQuick, {
        message: 'either foodId+amountG or quickKcal must be set',
      }),
    )
    .max(1000)
    .default([]),
  bodyWeight: z.array(upsertWeightRequestSchema.extend(withId)).max(500).default([]),
  deletions: z
    .array(
      z.object({
        entity: z.enum(SYNC_ENTITIES),
        id: uuidSchema,
        /** Für entity=set nötig. */
        workoutId: uuidSchema.optional(),
      }),
    )
    .max(2000)
    .default([]),
});
export type SyncBatchRequest = z.infer<typeof syncBatchRequestSchema>;

export interface SyncItemResult {
  entity: SyncEntity | 'deletion';
  id: string;
  status: 'ok' | 'error';
  error?: string;
}

export interface SyncBatchResponse {
  results: SyncItemResult[];
}
