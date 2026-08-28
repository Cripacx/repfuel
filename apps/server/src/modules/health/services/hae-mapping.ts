import type { HealthAutoExportPayload } from '@repfuel/shared';

/**
 * Mapping des „Health Auto Export"-Payloads (iOS) auf unsere Metriken.
 * Reine Funktion — Unit-getestet, keine IO.
 */
export interface MappedMetric {
  metric: string;
  value: number;
  measuredAt: Date;
}

const NAME_MAP: Record<string, string> = {
  step_count: 'steps',
  steps: 'steps',
  resting_heart_rate: 'resting_hr',
  active_energy: 'active_kcal',
  apple_sleeping_breathing_disturbances: '',
  sleep_analysis: 'sleep_minutes',
  weight_body_mass: 'weight',
  body_mass: 'weight',
  heart_rate: 'heart_rate',
};

/** HAE-Datumsformat: "2024-01-01 00:00:00 +0200" (auch ISO wird akzeptiert). */
export function parseHaeDate(raw: string): Date | null {
  const normalized = raw
    .replace(' ', 'T')
    .replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2')
    .replace(/ ?([+-]\d{2}):?(\d{2})$/, '$1:$2');
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function convert(metric: string, value: number, units: string | undefined): number {
  const u = (units ?? '').toLowerCase();
  if (metric === 'active_kcal' && u === 'kj') return value / 4.184;
  if (metric === 'weight' && (u === 'lb' || u === 'lbs')) return value * 0.45359237;
  if (metric === 'sleep_minutes' && (u === 'hr' || u === 'hrs' || u === 'h')) return value * 60;
  return value;
}

export function mapHealthAutoExport(payload: HealthAutoExportPayload): {
  mapped: MappedMetric[];
  ignoredMetrics: string[];
} {
  const mapped: MappedMetric[] = [];
  const ignored = new Set<string>();

  for (const metric of payload.data.metrics) {
    const name = metric.name.toLowerCase();
    const target = NAME_MAP[name];
    if (!target) {
      ignored.add(metric.name);
      continue;
    }
    for (const point of metric.data) {
      const measuredAt = parseHaeDate(point.date);
      if (!measuredAt) continue;
      const raw =
        point.qty ?? point.Avg ?? point.avg ?? (target === 'sleep_minutes' ? point.asleep : undefined);
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
      mapped.push({ metric: target, value: convert(target, raw, metric.units), measuredAt });
    }
  }

  return { mapped, ignoredMetrics: [...ignored] };
}
