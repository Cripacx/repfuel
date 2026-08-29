import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { mapHealthAutoExport, parseHaeDate } from '../services/hae-mapping.js';
import { createIngestService, mirrorWeightId } from '../services/ingest-service.js';
import { createWeightService } from '../services/weight-service.js';
import type { ApiTokenRepo } from '../repositories/api-token-repo.js';
import type { MetricRepo, MetricUpsert } from '../repositories/metric-repo.js';
import type { WeightRepo, WeightUpsert } from '../repositories/weight-repo.js';
import type { ApiTokenRow, BodyWeightRow, HealthMetricRow } from '../schema.js';

function fakeMetricRepo(): MetricRepo & { rows: HealthMetricRow[] } {
  const rows: HealthMetricRow[] = [];
  const keyOf = (e: { userId: string; metric: string; measuredAt: Date; source: string }) =>
    `${e.userId}|${e.metric}|${e.measuredAt.toISOString()}|${e.source}`;
  return {
    rows,
    async upsertMany(entries: MetricUpsert[]) {
      for (const entry of entries) {
        const existing = rows.find((r) => keyOf(r) === keyOf(entry));
        if (existing) existing.value = entry.value;
        else rows.push({ id: randomUUID(), ...entry });
      }
      return entries.length;
    },
    async list({ userId, metric, limit }) {
      return rows.filter((r) => r.userId === userId && r.metric === metric).slice(0, limit);
    },
    async listAll(userId) {
      return rows.filter((r) => r.userId === userId);
    },
  };
}

function fakeApiTokenRepo(): ApiTokenRepo & { rows: ApiTokenRow[] } {
  const rows: ApiTokenRow[] = [];
  return {
    rows,
    async create(input) {
      const row: ApiTokenRow = {
        id: randomUUID(),
        userId: input.userId,
        name: input.name,
        tokenHash: input.tokenHash,
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
      };
      rows.push(row);
      return row;
    },
    async findByHash(tokenHash) {
      return rows.find((r) => r.tokenHash === tokenHash && !r.revokedAt) ?? null;
    },
    async list(userId) {
      return rows.filter((r) => r.userId === userId && !r.revokedAt);
    },
    async revoke(userId, id) {
      const row = rows.find((r) => r.id === id && r.userId === userId && !r.revokedAt) ?? null;
      if (row) row.revokedAt = new Date();
      return row;
    },
    async touch(id) {
      const row = rows.find((r) => r.id === id);
      if (row) row.lastUsedAt = new Date();
    },
  };
}

function fakeWeightRepo(): WeightRepo & { rows: BodyWeightRow[] } {
  const rows: BodyWeightRow[] = [];
  return {
    rows,
    async findByIdAnyUser(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async list(userId, filter) {
      return rows.filter((r) => r.userId === userId && !r.deletedAt).slice(0, filter.limit);
    },
    async upsert(input: WeightUpsert) {
      const existing = rows.find((r) => r.id === input.id);
      if (existing) {
        Object.assign(existing, input, { deletedAt: null, updatedAt: new Date() });
        return existing;
      }
      const row: BodyWeightRow = { ...input, updatedAt: new Date(), deletedAt: null };
      rows.push(row);
      return row;
    },
    async softDelete(userId, id) {
      const row = rows.find((r) => r.id === id && r.userId === userId && !r.deletedAt) ?? null;
      if (row) row.deletedAt = new Date();
      return row;
    },
  };
}

const USER = '00000000-0000-4000-8000-000000000001';

function setup() {
  const metricRepo = fakeMetricRepo();
  const apiTokenRepo = fakeApiTokenRepo();
  const weightRepo = fakeWeightRepo();
  const service = createIngestService({
    metricRepo,
    apiTokenRepo,
    weightService: createWeightService(weightRepo),
  });
  return { metricRepo, apiTokenRepo, weightRepo, service };
}

describe('hae mapping', () => {
  it('parses HAE dates with offset', () => {
    expect(parseHaeDate('2026-08-27 08:30:00 +0200')?.toISOString()).toBe(
      '2026-08-27T06:30:00.000Z',
    );
    expect(parseHaeDate('2026-08-27T08:30:00Z')?.toISOString()).toBe('2026-08-27T08:30:00.000Z');
    expect(parseHaeDate('nonsense')).toBeNull();
  });

  it('maps known metrics with unit conversion and reports ignored ones', () => {
    const { mapped, ignoredMetrics } = mapHealthAutoExport({
      data: {
        metrics: [
          { name: 'step_count', units: 'count', data: [{ date: '2026-08-27 00:00:00 +0200', qty: 8500 }] },
          { name: 'resting_heart_rate', units: 'count/min', data: [{ date: '2026-08-27 00:00:00 +0200', Avg: 52 }] },
          { name: 'active_energy', units: 'kJ', data: [{ date: '2026-08-27 00:00:00 +0200', qty: 4184 }] },
          { name: 'weight_body_mass', units: 'lb', data: [{ date: '2026-08-27 07:00:00 +0200', qty: 180 }] },
          { name: 'mindful_minutes', units: 'min', data: [{ date: '2026-08-27 00:00:00 +0200', qty: 5 }] },
        ],
      },
    });
    const byMetric = Object.fromEntries(mapped.map((m) => [m.metric, m.value]));
    expect(byMetric.steps).toBe(8500);
    expect(byMetric.resting_hr).toBe(52);
    expect(byMetric.active_kcal).toBeCloseTo(1000, 0);
    expect(byMetric.weight).toBeCloseTo(81.65, 1);
    expect(ignoredMetrics).toEqual(['mindful_minutes']);
  });
});

describe('api tokens', () => {
  it('creates, verifies, touches and revokes tokens', async () => {
    const { service } = setup();
    const created = await service.createToken(USER, 'iPhone');
    expect(created.token.startsWith('rf_')).toBe(true);
    expect(await service.verifyToken(created.token)).toBe(USER);
    expect(await service.verifyToken('rf_wrong')).toBeNull();
    await service.revokeToken(USER, created.id);
    expect(await service.verifyToken(created.token)).toBeNull();
    expect(await service.listTokens(USER)).toHaveLength(0);
  });
});

describe('health ingest', () => {
  it('upserts idempotently and mirrors weight into body_weight', async () => {
    const { service, metricRepo, weightRepo } = setup();
    const payload = {
      source: 'api' as const,
      metrics: [
        { metric: 'steps', value: 9000, measuredAt: '2026-08-27T00:00:00Z' },
        { metric: 'weight', value: 81.4, measuredAt: '2026-08-27T07:00:00Z' },
      ],
    };
    const first = await service.ingestSimple(USER, payload);
    expect(first).toMatchObject({ accepted: 2, mirroredWeights: 1 });
    // Replay: keine Duplikate, Gewichtseintrag bleibt derselbe (deterministische UUID)
    await service.ingestSimple(USER, payload);
    expect(metricRepo.rows).toHaveLength(2);
    expect(weightRepo.rows).toHaveLength(1);
    expect(weightRepo.rows[0]!.id).toBe(mirrorWeightId(USER, new Date('2026-08-27T07:00:00Z'), 'api'));
    // Korrigierter Wert überschreibt
    await service.ingestSimple(USER, {
      source: 'api',
      metrics: [{ metric: 'steps', value: 9100, measuredAt: '2026-08-27T00:00:00Z' }],
    });
    expect(metricRepo.rows.find((r) => r.metric === 'steps')?.value).toBe(9100);
  });

  it('ingests Health Auto Export payloads end to end', async () => {
    const { service, metricRepo } = setup();
    const res = await service.ingestHealthAutoExport(USER, {
      data: {
        metrics: [
          { name: 'step_count', units: 'count', data: [{ date: '2026-08-26 00:00:00 +0200', qty: 7000 }] },
          { name: 'unknown_thing', data: [{ date: '2026-08-26 00:00:00 +0200', qty: 1 }] },
        ],
      },
    });
    expect(res.accepted).toBe(1);
    expect(res.ignoredMetrics).toEqual(['unknown_thing']);
    expect(metricRepo.rows[0]).toMatchObject({ metric: 'steps', source: 'apple_health' });
  });

  it('serves stats back', async () => {
    const { service } = setup();
    await service.ingestSimple(USER, {
      source: 'api',
      metrics: [{ metric: 'resting_hr', value: 51, measuredAt: '2026-08-27T00:00:00Z' }],
    });
    const stats = await service.stats(USER, { metric: 'resting_hr', limit: 100 });
    expect(stats.entries).toEqual([
      { measuredAt: '2026-08-27T00:00:00.000Z', value: 51, source: 'api' },
    ]);
  });
});
