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

// ---------- Health-Metriken (M7: Ingest von Apple Health & Co.) ----------

/** Bekannte Metriken (Dashboard/KI); weitere Namen sind erlaubt. */
export const KNOWN_HEALTH_METRICS = [
  'steps',
  'resting_hr',
  'active_kcal',
  'sleep_minutes',
  'weight',
] as const;

export const healthMetricNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, 'lowercase snake_case expected');

export const HEALTH_SOURCES = ['apple_health', 'manual', 'api'] as const;
export type HealthSource = (typeof HEALTH_SOURCES)[number];

/** Eigenes simples Ingest-Schema (dokumentiert in docs/HEALTH_IMPORT.md). */
export const simpleHealthIngestSchema = z.object({
  source: z.enum(HEALTH_SOURCES).default('api'),
  metrics: z
    .array(
      z.object({
        metric: healthMetricNameSchema,
        value: z.number().finite(),
        measuredAt: isoDateTimeSchema,
      }),
    )
    .min(1)
    .max(5000),
});
export type SimpleHealthIngest = z.infer<typeof simpleHealthIngestSchema>;

/**
 * Payload-Format der iOS-App „Health Auto Export" (JSON-REST-Export):
 * { data: { metrics: [{ name, units, data: [{ date, qty?, Avg?, ... }] }] } }
 */
export const healthAutoExportSchema = z.object({
  data: z.object({
    metrics: z
      .array(
        z
          .object({
            name: z.string().min(1),
            units: z.string().optional(),
            data: z
              .array(
                z
                  .object({
                    date: z.string().min(1),
                    qty: z.number().optional(),
                    Avg: z.number().optional(),
                    avg: z.number().optional(),
                    asleep: z.number().optional(),
                  })
                  .passthrough(),
              )
              .default([]),
          })
          .passthrough(),
      )
      .default([]),
  }),
});
export type HealthAutoExportPayload = z.infer<typeof healthAutoExportSchema>;

export const healthStatsQuerySchema = z.object({
  metric: healthMetricNameSchema,
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
});
export type HealthStatsQuery = z.infer<typeof healthStatsQuerySchema>;

export const createApiTokenRequestSchema = z.object({
  name: z.string().min(1).max(60),
});
export type CreateApiTokenRequest = z.infer<typeof createApiTokenRequestSchema>;
