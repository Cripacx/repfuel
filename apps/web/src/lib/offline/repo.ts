import type {
  BodyWeightDto,
  FoodDto,
  MealDto,
  SetDto,
  UpsertMealRequest,
  UpsertSetRequest,
  UpsertWeightRequest,
  UpsertWorkoutRequest,
  WorkoutDto,
} from '@repfuel/shared';
import { db, type LocalMeal, type LocalWorkout, type OutboxRow } from './db.js';
import { notifyLocalWrite, triggerFlush } from './status.svelte.js';

/**
 * Offline-first-Schreibpfad (siehe IMPLEMENTIERUNGSPROMPT.md „Offline-Daten"):
 * jede Schreiboperation der Logging-Flows schreibt zuerst nach Dexie + Outbox
 * und stößt danach einen best-effort Flush an (`status.svelte.ts` hält die
 * eine Sync-Queue-Instanz + den reaktiven Badge-Status). Die Rückgabewerte
 * spiegeln exakt die Server-DTO-Form, damit aufrufende Components unverändert
 * bleiben (dieselbe `WorkoutDto`/`SetDto`/`MealDto`/`BodyWeightDto`-Form wie
 * `$lib/api.ts`).
 */

async function enqueue(row: Omit<OutboxRow, 'id' | 'createdAt'>): Promise<void> {
  await db.outbox.add({ ...row, createdAt: Date.now() });
  notifyLocalWrite();
  triggerFlush();
}

async function pendingDeletedIds(entity: OutboxRow['entity']): Promise<Set<string>> {
  const rows = await db.outbox.where('entity').equals(entity).toArray();
  return new Set(
    rows.filter((r) => r.kind === 'delete').map((r) => r.payload.id),
  );
}

// --- Workouts & Sätze ---

async function assembleWorkout(local: LocalWorkout): Promise<WorkoutDto> {
  const sets = await db.sets.where('workoutId').equals(local.id).sortBy('position');
  return { ...local, sets };
}

export async function upsertWorkout(id: string, input: UpsertWorkoutRequest): Promise<WorkoutDto> {
  const local: LocalWorkout = {
    id,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt ?? null,
    routineId: input.routineId ?? null,
    notes: input.notes ?? null,
  };
  await db.workouts.put(local);
  await enqueue({ kind: 'upsert', entity: 'workout', payload: { id, ...input } });
  return assembleWorkout(local);
}

export async function getWorkoutLocal(id: string): Promise<WorkoutDto | null> {
  const local = await db.workouts.get(id);
  if (!local) return null;
  return assembleWorkout(local);
}

/** Merged eine vom Server geladene Workout-Liste in Dexie, ohne lokal noch nicht
 * synchronisierte Sätze/Workouts zu verlieren und ohne bereits (lokal, aber noch
 * nicht serverseitig verarbeitete) gelöschte Datensätze wiederherzustellen. */
export async function hydrateWorkouts(workouts: WorkoutDto[]): Promise<void> {
  const [deletedWorkoutIds, deletedSetIds] = await Promise.all([
    pendingDeletedIds('workout'),
    pendingDeletedIds('set'),
  ]);
  const workoutRows: LocalWorkout[] = [];
  const setRows: SetDto[] = [];
  for (const workout of workouts) {
    if (!deletedWorkoutIds.has(workout.id)) {
      const { sets, ...rest } = workout;
      workoutRows.push(rest);
      for (const set of sets) {
        if (!deletedSetIds.has(set.id)) setRows.push(set);
      }
    }
  }
  await db.transaction('rw', db.workouts, db.sets, async () => {
    if (workoutRows.length > 0) await db.workouts.bulkPut(workoutRows);
    if (setRows.length > 0) await db.sets.bulkPut(setRows);
  });
}

export async function listWorkoutsLocal(limit = 50): Promise<WorkoutDto[]> {
  const workouts = await db.workouts.orderBy('startedAt').reverse().limit(limit).toArray();
  return Promise.all(workouts.map(assembleWorkout));
}

export async function upsertSet(
  workoutId: string,
  setId: string,
  input: UpsertSetRequest,
): Promise<SetDto> {
  const set: SetDto = {
    id: setId,
    workoutId,
    exerciseId: input.exerciseId,
    position: input.position,
    reps: input.reps,
    weightKg: input.weightKg,
    isWarmup: input.isWarmup,
    rpe: input.rpe ?? null,
  };
  await db.sets.put(set);
  await enqueue({ kind: 'upsert', entity: 'set', payload: { id: setId, workoutId, ...input } });
  return set;
}

export async function removeSet(workoutId: string, setId: string): Promise<void> {
  await db.sets.delete(setId);
  await enqueue({ kind: 'delete', entity: 'set', payload: { id: setId, workoutId } });
}

// --- Gewicht ---

export async function upsertWeight(id: string, input: UpsertWeightRequest): Promise<BodyWeightDto> {
  const entry: BodyWeightDto = { id, weightKg: input.weightKg, measuredAt: input.measuredAt };
  await db.bodyWeight.put(entry);
  await enqueue({ kind: 'upsert', entity: 'body_weight', payload: { id, ...input } });
  return entry;
}

export async function removeWeight(id: string): Promise<void> {
  await db.bodyWeight.delete(id);
  await enqueue({ kind: 'delete', entity: 'body_weight', payload: { id } });
}

export async function hydrateWeight(entries: BodyWeightDto[]): Promise<void> {
  const deleted = await pendingDeletedIds('body_weight');
  const rows = entries.filter((e) => !deleted.has(e.id));
  if (rows.length > 0) await db.bodyWeight.bulkPut(rows);
}

export async function listWeightLocal(limit = 2000): Promise<BodyWeightDto[]> {
  return db.bodyWeight.orderBy('measuredAt').reverse().limit(limit).toArray();
}

// --- Mahlzeiten ---

/** Berechnet dieselben abgeleiteten Felder wie der Server (`MealDto.kcal`/`proteinG`/…),
 * damit offline erstellte Einträge sich visuell nicht von synchronisierten unterscheiden. */
function computeMealDto(
  id: string,
  input: UpsertMealRequest,
  resolvedFood: FoodDto | null,
): LocalMeal {
  if (resolvedFood && input.amountG != null) {
    const factor = input.amountG / 100;
    return {
      id,
      eatenAt: input.eatenAt,
      mealType: input.mealType,
      foodId: resolvedFood.id,
      amountG: input.amountG,
      quickKcal: null,
      /* Flache Kopie statt Referenz: Aufrufer reichen hier Svelte-`$state`-
         Proxies durch, und IndexedDB kann Proxies nicht klonen
         (DataCloneError beim `put`). */
      food: { ...resolvedFood },
      kcal: resolvedFood.kcalPer100 * factor,
      proteinG: resolvedFood.proteinPer100 * factor,
      carbsG: resolvedFood.carbsPer100 * factor,
      fatG: resolvedFood.fatPer100 * factor,
    };
  }
  const quickKcal = input.quickKcal ?? 0;
  return {
    id,
    eatenAt: input.eatenAt,
    mealType: input.mealType,
    foodId: null,
    amountG: null,
    quickKcal,
    food: null,
    kcal: quickKcal,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  };
}

export async function upsertMeal(
  id: string,
  input: UpsertMealRequest,
  resolvedFood: FoodDto | null = null,
): Promise<MealDto> {
  const meal = computeMealDto(id, input, resolvedFood);
  await db.meals.put(meal);
  await enqueue({ kind: 'upsert', entity: 'meal', payload: { id, ...input } });
  return meal;
}

export async function removeMeal(id: string): Promise<void> {
  await db.meals.delete(id);
  await enqueue({ kind: 'delete', entity: 'meal', payload: { id } });
}

export async function hydrateMeals(meals: MealDto[]): Promise<void> {
  const deleted = await pendingDeletedIds('meal');
  const rows = meals.filter((m) => !deleted.has(m.id));
  if (rows.length > 0) await db.meals.bulkPut(rows);
}

export async function listMealsLocal(fromIso: string, toIso: string): Promise<MealDto[]> {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  const all = await db.meals.toArray();
  return all.filter((meal) => {
    const t = new Date(meal.eatenAt).getTime();
    return t >= from && t < to;
  });
}
