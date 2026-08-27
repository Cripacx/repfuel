import { z } from 'zod';
import { isoDateTimeSchema } from './workout.js';

export const upsertWeightRequestSchema = z.object({
  weightKg: z.number().min(20).max(500),
  measuredAt: isoDateTimeSchema,
});
export type UpsertWeightRequest = z.infer<typeof upsertWeightRequestSchema>;

export const listWeightQuerySchema = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(500),
});
export type ListWeightQuery = z.infer<typeof listWeightQuerySchema>;
