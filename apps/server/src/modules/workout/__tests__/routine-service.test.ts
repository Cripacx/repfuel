import { describe, expect, it } from 'vitest';
import { createExerciseService } from '../services/exercise-service.js';
import { createRoutineService } from '../services/routine-service.js';
import { fakeExerciseRepo, fakeRoutineRepo, makeExercise } from './fakes.js';

const USER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

function setup() {
  const bench = makeExercise({ name: 'Bench Press' });
  const squat = makeExercise({ name: 'Squat' });
  const foreign = makeExercise({ name: 'Private Curl', userId: OTHER });
  const exerciseRepo = fakeExerciseRepo([bench, squat, foreign]);
  const routineRepo = fakeRoutineRepo();
  const exerciseService = createExerciseService(exerciseRepo);
  const service = createRoutineService({ routineRepo, exerciseRepo, exerciseService });
  return { service, routineRepo, bench, squat, foreign };
}

const item = (exerciseId: string, position = 0) => ({
  exerciseId,
  position,
  targetSets: 3,
  targetReps: 10,
});

describe('routine service', () => {
  it('creates a routine with items and returns exercise details', async () => {
    const { service, bench, squat } = setup();
    const routine = await service.create(USER, {
      name: 'Push Day',
      weekday: 0,
      items: [item(bench.id, 0), item(squat.id, 1)],
    });
    expect(routine.items).toHaveLength(2);
    expect(routine.items[0]?.exercise?.name).toBe('Bench Press');
  });

  it('rejects items with invisible exercises (other user`s custom)', async () => {
    const { service, foreign } = setup();
    await expect(
      service.create(USER, { name: 'X', weekday: null, items: [item(foreign.id)] }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('replaces items on update and keeps name when omitted', async () => {
    const { service, bench, squat } = setup();
    const routine = await service.create(USER, {
      name: 'Day A',
      weekday: null,
      items: [item(bench.id)],
    });
    const updated = await service.update(USER, routine.id, { items: [item(squat.id)] });
    expect(updated.name).toBe('Day A');
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0]?.exerciseId).toBe(squat.id);
  });

  it('is strictly user-scoped', async () => {
    const { service, bench } = setup();
    const routine = await service.create(USER, { name: 'Mine', weekday: null, items: [item(bench.id)] });
    await expect(service.get(OTHER, routine.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(service.remove(OTHER, routine.id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('soft-deletes routines', async () => {
    const { service, routineRepo, bench } = setup();
    const routine = await service.create(USER, { name: 'Del', weekday: null, items: [item(bench.id)] });
    await service.remove(USER, routine.id);
    expect(await service.list(USER)).toHaveLength(0);
    expect(routineRepo.rows[0]?.deletedAt).not.toBeNull();
  });
});
