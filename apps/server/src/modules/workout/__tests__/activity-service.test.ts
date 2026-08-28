import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ActivityRepo, ActivityUpsert } from '../repositories/activity-repo.js';
import type { ActivityRow } from '../schema.js';
import { createActivityService } from '../services/activity-service.js';

const USER = randomUUID();
const OTHER_USER = randomUUID();

function fakeActivityRepo(): ActivityRepo & { rows: ActivityRow[] } {
  const rows: ActivityRow[] = [];
  return {
    rows,
    async findByIdAnyUser(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async list(userId, filter) {
      let out = rows.filter((r) => r.userId === userId && !r.deletedAt);
      if (filter.from) out = out.filter((r) => r.startedAt >= filter.from!);
      if (filter.to) out = out.filter((r) => r.startedAt <= filter.to!);
      return out
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, filter.limit);
    },
    async upsert(input: ActivityUpsert) {
      const existing = rows.find((r) => r.id === input.id);
      if (existing) {
        Object.assign(existing, input, { deletedAt: null });
        return existing;
      }
      const row: ActivityRow = { ...input, createdAt: new Date(), deletedAt: null };
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

describe('activity service', () => {
  it('upserts and lists activities, newest first', async () => {
    const service = createActivityService(fakeActivityRepo());
    await service.upsert(USER, randomUUID(), {
      activityType: 'run',
      startedAt: '2026-08-27T07:00:00.000Z',
      durationMin: 30,
      kcal: 320,
    });
    await service.upsert(USER, randomUUID(), {
      activityType: 'bike',
      startedAt: '2026-08-28T18:00:00.000Z',
      durationMin: 45,
    });

    const list = await service.list(USER, { limit: 50 });
    expect(list.map((a) => a.activityType)).toEqual(['bike', 'run']);
    expect(list[0]).toMatchObject({ durationMin: 45, kcal: null, notes: null });
    expect(list[1]).toMatchObject({ kcal: 320 });
  });

  it('rejects an id that belongs to another user', async () => {
    const repo = fakeActivityRepo();
    const service = createActivityService(repo);
    const id = randomUUID();
    await service.upsert(OTHER_USER, id, {
      activityType: 'walk',
      startedAt: '2026-08-28T08:00:00.000Z',
      durationMin: 20,
    });
    await expect(
      service.upsert(USER, id, {
        activityType: 'walk',
        startedAt: '2026-08-28T08:00:00.000Z',
        durationMin: 20,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('soft-deletes activities', async () => {
    const repo = fakeActivityRepo();
    const service = createActivityService(repo);
    const id = randomUUID();
    await service.upsert(USER, id, {
      activityType: 'hike',
      startedAt: '2026-08-28T10:00:00.000Z',
      durationMin: 90,
    });
    await service.remove(USER, id);
    expect(await service.list(USER, { limit: 50 })).toHaveLength(0);
    expect(repo.rows[0]?.deletedAt).not.toBeNull();
    await expect(service.remove(USER, id)).rejects.toMatchObject({ code: 'not_found' });
  });
});
