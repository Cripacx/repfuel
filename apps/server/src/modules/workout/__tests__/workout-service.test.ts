import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createInProcessEventBus } from '../../../core/event-bus.js';
import { createExerciseService } from '../services/exercise-service.js';
import { createWorkoutService } from '../services/workout-service.js';
import { fakeExerciseRepo, fakeRoutineRepo, fakeWorkoutRepo, makeExercise } from './fakes.js';

const USER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

function setup() {
  const bench = makeExercise();
  const exerciseRepo = fakeExerciseRepo([bench]);
  const workoutRepo = fakeWorkoutRepo();
  const routineRepo = fakeRoutineRepo();
  const service = createWorkoutService({
    workoutRepo,
    routineRepo,
    exerciseService: createExerciseService(exerciseRepo),
    eventBus: createInProcessEventBus(),
  });
  return { service, workoutRepo, bench };
}

const workoutInput = { startedAt: new Date().toISOString() };
const setInput = (exerciseId: string, position = 0) => ({
  exerciseId,
  position,
  reps: 8,
  weightKg: 80,
  isWarmup: false,
});

describe('workout service', () => {
  it('upserts a workout by client uuid (idempotent)', async () => {
    const { service } = setup();
    const id = randomUUID();
    await service.upsert(USER, id, workoutInput);
    const updated = await service.upsert(USER, id, { ...workoutInput, notes: 'good session' });
    expect(updated.id).toBe(id);
    expect(updated.notes).toBe('good session');
    expect((await service.list(USER, { limit: 50 })).length).toBe(1);
  });

  it('rejects upsert on a foreign workout id', async () => {
    const { service } = setup();
    const id = randomUUID();
    await service.upsert(OTHER, id, workoutInput);
    await expect(service.upsert(USER, id, workoutInput)).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('logs sets and lists them with the workout', async () => {
    const { service, bench } = setup();
    const wid = randomUUID();
    await service.upsert(USER, wid, workoutInput);
    await service.upsertSet(USER, wid, randomUUID(), setInput(bench.id, 0));
    await service.upsertSet(USER, wid, randomUUID(), setInput(bench.id, 1));
    const workout = await service.get(USER, wid);
    expect(workout.sets).toHaveLength(2);
    expect(workout.sets[0]?.weightKg).toBe(80);
  });

  it('prefills last sets from the most recent workout containing the exercise', async () => {
    const { service, bench } = setup();
    const oldW = randomUUID();
    await service.upsert(USER, oldW, { startedAt: '2026-08-01T10:00:00.000Z' });
    await service.upsertSet(USER, oldW, randomUUID(), { ...setInput(bench.id), weightKg: 70 });
    const newW = randomUUID();
    await service.upsert(USER, newW, { startedAt: '2026-08-20T10:00:00.000Z' });
    await service.upsertSet(USER, newW, randomUUID(), { ...setInput(bench.id), weightKg: 75 });
    const last = await service.lastSets(USER, [bench.id]);
    expect(last[bench.id]?.sets).toHaveLength(1);
    expect(last[bench.id]?.sets[0]?.weightKg).toBe(75);
    // Das Datum stammt aus dem jüngeren Workout, nicht aus dem älteren.
    expect(last[bench.id]?.performedAt).toBe('2026-08-20T10:00:00.000Z');
  });

  it('removes sets softly and keeps others', async () => {
    const { service, workoutRepo, bench } = setup();
    const wid = randomUUID();
    await service.upsert(USER, wid, workoutInput);
    const sid = randomUUID();
    await service.upsertSet(USER, wid, sid, setInput(bench.id));
    await service.removeSet(USER, wid, sid);
    expect((await service.get(USER, wid)).sets).toHaveLength(0);
    expect(workoutRepo.setRows[0]?.deletedAt).not.toBeNull();
  });

  it('scopes sets strictly to the owner', async () => {
    const { service, bench } = setup();
    const wid = randomUUID();
    await service.upsert(USER, wid, workoutInput);
    await expect(
      service.upsertSet(OTHER, wid, randomUUID(), setInput(bench.id)),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
