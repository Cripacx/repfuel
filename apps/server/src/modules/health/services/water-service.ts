import type { LogWaterRequest, WaterTotalDto } from '@repfuel/shared';
import type { MetricRepo } from '../repositories/metric-repo.js';

/**
 * Wasseraufnahme. Liegt bewusst in derselben health_metrics-Tabelle wie die
 * übrigen Messwerte (metric='water_ml'): es ist ein Messpunkt mit Zeitstempel
 * wie Schritte oder Ruhepuls, und der Datenexport erfasst es dadurch ohne
 * Zusatzarbeit.
 */
export const WATER_METRIC = 'water_ml';
const MANUAL_SOURCE = 'manual';

export type WaterService = ReturnType<typeof createWaterService>;

export function createWaterService(metricRepo: MetricRepo) {
  return {
    async log(userId: string, input: LogWaterRequest): Promise<void> {
      await metricRepo.upsertMany([
        {
          userId,
          metric: WATER_METRIC,
          value: input.ml,
          measuredAt: input.at ? new Date(input.at) : new Date(),
          source: MANUAL_SOURCE,
        },
      ]);
    },

    /**
     * Summe über einen Zeitraum. Die lokalen Tagesgrenzen rechnet der Aufrufer
     * aus — dieselbe Konvention wie bei Mahlzeiten, damit die Zeitzonenlogik
     * nur an einer Stelle lebt.
     */
    async total(userId: string, range: { from: string; to: string }): Promise<WaterTotalDto> {
      const rows = await metricRepo.list({
        userId,
        metric: WATER_METRIC,
        from: new Date(range.from),
        to: new Date(range.to),
        limit: 1000,
      });
      return { totalMl: rows.reduce((sum, row) => sum + row.value, 0) };
    },
  };
}
