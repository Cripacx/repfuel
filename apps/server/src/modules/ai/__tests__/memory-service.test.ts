import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { MemoryRepo } from '../repositories/memory-repo.js';
import type { CoachMemoryRow } from '../schema.js';
import { createMemoryService, MEMORY_LIMIT } from '../services/memory-service.js';

const USER = randomUUID();

function fakeMemoryRepo(): MemoryRepo & { rows: CoachMemoryRow[] } {
  const rows: CoachMemoryRow[] = [];
  const visible = (userId: string) => rows.filter((r) => r.userId === userId && !r.deletedAt);
  return {
    rows,
    async list(userId) {
      return visible(userId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    async count(userId) {
      return visible(userId).length;
    },
    async insert(input) {
      const row: CoachMemoryRow = {
        id: randomUUID(),
        ...input,
        createdAt: new Date(),
        deletedAt: null,
      };
      rows.push(row);
      return row;
    },
    async softDelete(userId, id) {
      const row = visible(userId).find((r) => r.id === id) ?? null;
      if (row) row.deletedAt = new Date();
      return row;
    },
  };
}

describe('memory service', () => {
  it('stores trimmed memories and lists them', async () => {
    const service = createMemoryService(fakeMemoryRepo());
    await service.add(USER, 'preference', '  Mag keinen Brokkoli  ');
    await service.add(USER, 'goal', 'Halbmarathon im Mai 2027');

    const list = await service.list(USER);
    expect(list.map((memory) => memory.content)).toEqual([
      'Mag keinen Brokkoli',
      'Halbmarathon im Mai 2027',
    ]);
  });

  it('collapses exact duplicates instead of storing twice', async () => {
    const service = createMemoryService(fakeMemoryRepo());
    const first = await service.add(USER, 'preference', 'Mag keinen Brokkoli');
    const second = await service.add(USER, 'preference', 'mag keinen brokkoli');
    expect(second.id).toBe(first.id);
    expect(await service.list(USER)).toHaveLength(1);
  });

  it('enforces the per-user limit', async () => {
    const repo = fakeMemoryRepo();
    const service = createMemoryService(repo);
    for (let i = 0; i < MEMORY_LIMIT; i++) {
      await service.add(USER, 'fact', `Fakt Nummer ${i}`);
    }
    await expect(service.add(USER, 'fact', 'einer zu viel')).rejects.toMatchObject({
      code: 'bad_request',
    });
  });

  it('removes memories and 404s on unknown ids', async () => {
    const repo = fakeMemoryRepo();
    const service = createMemoryService(repo);
    const memory = await service.add(USER, 'constraint', 'Laktoseintoleranz');
    await service.remove(USER, memory.id);
    expect(await service.list(USER)).toHaveLength(0);
    await expect(service.remove(USER, memory.id)).rejects.toMatchObject({ code: 'not_found' });
  });
});
