import type { BodyWeightDto } from '@repfuel/shared';

export const WEIGHT_CHART_RANGES = [30, 90, 365, 'all'] as const;
export type WeightChartRange = (typeof WEIGHT_CHART_RANGES)[number];

/** Filtert Gewichtseinträge auf die letzten `range` Tage (oder alle), aufsteigend nach Datum. */
export function filterByRange(
  entries: readonly BodyWeightDto[],
  range: number | 'all',
  now: Date = new Date(),
): BodyWeightDto[] {
  const sorted = entries
    .slice()
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
  if (range === 'all') return sorted;
  const cutoff = now.getTime() - range * 24 * 60 * 60 * 1000;
  return sorted.filter((entry) => new Date(entry.measuredAt).getTime() >= cutoff);
}
