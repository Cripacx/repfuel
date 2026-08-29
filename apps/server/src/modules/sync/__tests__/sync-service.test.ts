import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createInProcessEventBus } from '../../../core/event-bus.js';
import { createWeightService } from '../../health/services/weight-service.js';
import { createMealService } from '../../nutrition/services/meal-service.js';
import {
  fakeFoodRepo,
  fakeMealRepo,
  makeFood,
} from '../../nutrition/__tests__/fakes.js';
import { createExerciseService } from '../../workout/services/exercise-service.js';
import { createWorkoutService } from '../../workout/services/workout-service.js';
import {
  fakeExerciseRepo,
  fakeRoutineRepo,
  fakeWorkoutRepo,
  makeExercise,
} from '../../workout/__tests__/fakes.js';
import type { WeightRepo, WeightUpsert } from '../../health/repositories/weight-repo.js';
import type { BodyWeightRow } from '../../health/schema.js';
import { createSyncService } from '../services/sync-service.js';

const USER = '00000000-0000-4000-8000-000000000001';

function fakeWeightRepo(): WeightRepo & { rows: BodyWeightRow[] } {
  const rows: BodyWeightRow[] = [];
  return {
    rows,
    async findByIdAnyUser(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async list(userId, filter) {
      return rows
        .filter((r) => r.userId === userId && !r.deletedAt)
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

function setup() {
  const bench = makeExercise();
  const oats = makeFood();
  const workoutRepo = fakeWorkoutRepo();
  const exerciseService = createExerciseService(fakeExerciseRepo([bench]));
  const workoutService = createWorkoutService({
    workoutRepo,
    routineRepo: fakeRoutineRepo(),
    exerciseService,
    eventBus: createInProcessEventBus(),
  });
  const weightService = createWeightService(fakeWeightRepo());
  const mealService = createMealService({
    mealRepo: fakeMealRepo(),
    foodRepo: fakeFoodRepo([oats]),
    getTargets: async () => ({
      kcalTarget: null,
      proteinTargetG: null,
      carbsTargetG: null,
      fatTargetG: null,
    }),
  });
  const service = createSyncService({ workoutService, weightService, mealService });
  return { service, bench, oats, workoutService, weightService };
}

const now = new Date().toISOString();

describe('sync batch', () => {
  it('applies a mixed batch in dependency order', async () => {
    const { service, bench, oats, workoutService } = setup();
    const wid = randomUUID();
    const sid = randomUUID();
    const res = await service.applyBatch(USER, {
      workouts: [{ id: wid, startedAt: now }],
      sets: [{ id: sid, workoutId: wid, exerciseId: bench.id, position: 0, reps: 8, weightKg: 80, isWarmup: false }],
      meals: [{ id: randomUUID(), eatenAt: now, mealType: 'lunch', foodId: oats.id, amountG: 100 }],
      bodyWeight: [{ id: randomUUID(), weightKg: 81.2, measuredAt: now }],
      deletions: [],
    });
    expect(res.results).toHaveLength(4);
    expect(res.results.every((r) => r.status === 'ok')).toBe(true);
    expect((await workoutService.get(USER, wid)).sets).toHaveLength(1);
  });

  it('is idempotent (replay of the same batch)', async () => {
    const { service } = setup();
    const batch = {
      workouts: [{ id: randomUUID(), startedAt: now }],
      sets: [],
      meals: [],
      bodyWeight: [{ id: randomUUID(), weightKg: 80, measuredAt: now }],
      deletions: [],
    };
    const first = await service.applyBatch(USER, batch);
    const second = await service.applyBatch(USER, batch);
    expect(first.results.every((r) => r.status === 'ok')).toBe(true);
    expect(second.results.every((r) => r.status === 'ok')).toBe(true);
  });

  it('continues after per-item errors', async () => {
    const { service, bench } = setup();
    const wid = randomUUID();
    const res = await service.applyBatch(USER, {
      workouts: [{ id: wid, startedAt: now }],
      sets: [
        // Unbekanntes Workout → Fehler, restliche Items laufen weiter
        { id: randomUUID(), workoutId: randomUUID(), exerciseId: bench.id, position: 0, reps: 5, weightKg: 50, isWarmup: false },
        { id: randomUUID(), workoutId: wid, exerciseId: bench.id, position: 0, reps: 5, weightKg: 50, isWarmup: false },
      ],
      meals: [],
      bodyWeight: [],
      deletions: [],
    });
    const statuses = res.results.map((r) => r.status);
    expect(statuses).toEqual(['ok', 'error', 'ok']);
  });

  it('treats deleting missing records as ok (idempotent deletions)', async () => {
    const { service } = setup();
    const res = await service.applyBatch(USER, {
      workouts: [],
      sets: [],
      meals: [],
      bodyWeight: [],
      deletions: [
        { entity: 'workout', id: randomUUID() },
        { entity: 'meal', id: randomUUID() },
        { entity: 'body_weight', id: randomUUID() },
        { entity: 'set', id: randomUUID() }, // ohne workoutId → echter Fehler
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(['ok', 'ok', 'ok', 'error']);
  });
});
