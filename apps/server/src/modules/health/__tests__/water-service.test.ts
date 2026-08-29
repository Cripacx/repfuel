import { describe, expect, it } from 'vitest';
import type { MetricRepo } from '../repositories/metric-repo.js';
import type { HealthMetricRow } from '../schema.js';
import { WATER_METRIC, createWaterService } from '../services/water-service.js';

function fakeMetricRepo() {
  const rows: HealthMetricRow[] = [];
  const repo: MetricRepo = {
    async upsertMany(entries) {
      for (const entry of entries) {
        rows.push({ id: `id-${rows.length}`, ...entry } as HealthMetricRow);
      }
      return entries.length;
    },
    async list({ userId, metric, from, to }) {
      return rows.filter(
        (r) =>
          r.userId === userId &&
          r.metric === metric &&
          (!from || r.measuredAt >= from) &&
          (!to || r.measuredAt <= to),
      );
    },
    async listAll(userId) {
      return rows.filter((r) => r.userId === userId);
    },
  };
  return { repo, rows };
}

describe('waterService', () => {
  it('stores an entry as a health metric so the export picks it up for free', async () => {
    const { repo, rows } = fakeMetricRepo();
    await createWaterService(repo).log('u1', { ml: 250, at: '2026-08-27T09:00:00.000Z' });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: 'u1',
      metric: WATER_METRIC,
      value: 250,
      source: 'manual',
    });
  });

  it('sums only the entries inside the range', async () => {
    const { repo } = fakeMetricRepo();
    const service = createWaterService(repo);
    await service.log('u1', { ml: 250, at: '2026-08-27T09:00:00.000Z' });
    await service.log('u1', { ml: 500, at: '2026-08-27T18:00:00.000Z' });
    // Am Folgetag — darf nicht mitzählen.
    await service.log('u1', { ml: 750, at: '2026-08-28T09:00:00.000Z' });

    const total = await service.total('u1', {
      from: '2026-08-27T00:00:00.000Z',
      to: '2026-08-27T23:59:59.999Z',
    });
    expect(total.totalMl).toBe(750);
  });

  it('keeps users apart and returns zero without entries', async () => {
    const { repo } = fakeMetricRepo();
    const service = createWaterService(repo);
    await service.log('u1', { ml: 300, at: '2026-08-27T09:00:00.000Z' });

    const other = await service.total('u2', {
      from: '2026-08-27T00:00:00.000Z',
      to: '2026-08-27T23:59:59.999Z',
    });
    expect(other.totalMl).toBe(0);
  });
});
