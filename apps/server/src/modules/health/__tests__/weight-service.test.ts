import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { WeightRepo, WeightUpsert } from '../repositories/weight-repo.js';
import type { BodyWeightRow } from '../schema.js';
import { createWeightService } from '../services/weight-service.js';

const USER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

function fakeWeightRepo(): WeightRepo & { rows: BodyWeightRow[] } {
  const rows: BodyWeightRow[] = [];
  return {
    rows,
    async findByIdAnyUser(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async list(userId, filter) {
      let out = rows.filter((r) => r.userId === userId && !r.deletedAt);
      if (filter.from) out = out.filter((r) => r.measuredAt >= filter.from!);
      if (filter.to) out = out.filter((r) => r.measuredAt <= filter.to!);
      return out
        .sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime())
        .slice(0, filter.limit);
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

describe('weight service', () => {
  it('upserts by client uuid (last write wins)', async () => {
    const repo = fakeWeightRepo();
    const service = createWeightService(repo);
    const id = randomUUID();
    await service.upsert(USER, id, { weightKg: 82.5, measuredAt: '2026-08-20T07:00:00.000Z' });
    const updated = await service.upsert(USER, id, {
      weightKg: 82.1,
      measuredAt: '2026-08-20T07:00:00.000Z',
    });
    expect(updated.weightKg).toBe(82.1);
    expect(repo.rows).toHaveLength(1);
  });

  it('rejects a foreign uuid', async () => {
    const repo = fakeWeightRepo();
    const service = createWeightService(repo);
    const id = randomUUID();
    await service.upsert(OTHER, id, { weightKg: 90, measuredAt: '2026-08-20T07:00:00.000Z' });
    await expect(
      service.upsert(USER, id, { weightKg: 80, measuredAt: '2026-08-20T07:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('lists user-scoped, newest first, and soft-deletes', async () => {
    const repo = fakeWeightRepo();
    const service = createWeightService(repo);
    const id1 = randomUUID();
    await service.upsert(USER, id1, { weightKg: 82, measuredAt: '2026-08-18T07:00:00.000Z' });
    await service.upsert(USER, randomUUID(), {
      weightKg: 81.5,
      measuredAt: '2026-08-19T07:00:00.000Z',
    });
    await service.upsert(OTHER, randomUUID(), {
      weightKg: 100,
      measuredAt: '2026-08-19T08:00:00.000Z',
    });
    const list = await service.list(USER, { limit: 500 });
    expect(list).toHaveLength(2);
    expect(list[0]?.weightKg).toBe(81.5);
    await service.remove(USER, id1);
    expect(await service.list(USER, { limit: 500 })).toHaveLength(1);
    await expect(service.remove(USER, id1)).rejects.toMatchObject({ code: 'not_found' });
  });
});
