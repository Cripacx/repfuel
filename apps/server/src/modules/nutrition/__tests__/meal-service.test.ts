import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createMealService } from '../services/meal-service.js';
import { fakeFoodRepo, fakeMealRepo, makeFood } from './fakes.js';

const USER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

function setup(targets = { kcalTarget: 2500, proteinTargetG: 160, carbsTargetG: 300, fatTargetG: 72 }) {
  const oats = makeFood({ kcalPer100: 372, proteinPer100: 13.5, carbsPer100: 58.7, fatPer100: 7 });
  const foodRepo = fakeFoodRepo([oats]);
  const mealRepo = fakeMealRepo();
  const service = createMealService({ mealRepo, foodRepo, getTargets: async () => targets });
  return { service, mealRepo, oats };
}

describe('meal service', () => {
  it('computes macros from food and amount', async () => {
    const { service, oats } = setup();
    const meal = await service.upsert(USER, randomUUID(), {
      eatenAt: '2026-08-28T08:00:00.000Z',
      mealType: 'breakfast',
      foodId: oats.id,
      amountG: 80,
    });
    expect(meal.kcal).toBe(297.6);
    expect(meal.proteinG).toBe(10.8);
    expect(meal.food?.name).toBe('Oats');
  });

  it('supports quick kcal entries without food', async () => {
    const { service } = setup();
    const meal = await service.upsert(USER, randomUUID(), {
      eatenAt: '2026-08-28T12:00:00.000Z',
      mealType: 'snack',
      quickKcal: 250,
    });
    expect(meal.kcal).toBe(250);
    expect(meal.proteinG).toBe(0);
    expect(meal.food).toBeNull();
  });

  it('rejects foreign meal ids and unknown foods', async () => {
    const { service } = setup();
    const id = randomUUID();
    await service.upsert(OTHER, id, {
      eatenAt: '2026-08-28T08:00:00.000Z',
      mealType: 'lunch',
      quickKcal: 100,
    });
    await expect(
      service.upsert(USER, id, {
        eatenAt: '2026-08-28T08:00:00.000Z',
        mealType: 'lunch',
        quickKcal: 100,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      service.upsert(USER, randomUUID(), {
        eatenAt: '2026-08-28T08:00:00.000Z',
        mealType: 'lunch',
        foodId: randomUUID(),
        amountG: 100,
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('aggregates stats per local day with timezone offset', async () => {
    const { service, oats } = setup();
    // 23:30 UTC am 27.8. = 01:30 am 28.8. in UTC+2
    await service.upsert(USER, randomUUID(), {
      eatenAt: '2026-08-27T23:30:00.000Z',
      mealType: 'snack',
      foodId: oats.id,
      amountG: 100,
    });
    await service.upsert(USER, randomUUID(), {
      eatenAt: '2026-08-28T10:00:00.000Z',
      mealType: 'lunch',
      quickKcal: 500,
    });
    const stats = await service.stats(USER, {
      from: '2026-08-28',
      to: '2026-08-28',
      tzOffsetMinutes: 120,
    });
    expect(stats.days).toHaveLength(1);
    expect(stats.days[0]).toMatchObject({ date: '2026-08-28', kcal: 872, mealCount: 2 });
    expect(stats.targets.kcalTarget).toBe(2500);

    // Ohne Offset fällt der 23:30-Eintrag auf den 27.8.
    const utcStats = await service.stats(USER, {
      from: '2026-08-27',
      to: '2026-08-28',
      tzOffsetMinutes: 0,
    });
    expect(utcStats.days.map((d) => d.date)).toEqual(['2026-08-27', '2026-08-28']);
  });

  it('soft-deletes meals', async () => {
    const { service, mealRepo } = setup();
    const id = randomUUID();
    await service.upsert(USER, id, {
      eatenAt: '2026-08-28T08:00:00.000Z',
      mealType: 'dinner',
      quickKcal: 700,
    });
    await service.remove(USER, id);
    expect(await service.list(USER, { limit: 100 })).toHaveLength(0);
    expect(mealRepo.rows[0]?.deletedAt).not.toBeNull();
    await expect(service.remove(USER, id)).rejects.toMatchObject({ code: 'not_found' });
  });
});
