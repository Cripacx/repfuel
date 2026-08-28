import { randomUUID } from 'node:crypto';
import type { ExerciseFilter, ExerciseRepo } from '../repositories/exercise-repo.js';
import type { RoutineItemInsert, RoutineRepo } from '../repositories/routine-repo.js';
import type { SetUpsert, WorkoutRepo, WorkoutUpsert } from '../repositories/workout-repo.js';
import type { ExerciseRow, RoutineItemRow, RoutineRow, SetRow, WorkoutRow } from '../schema.js';

export function makeExercise(overrides: Partial<ExerciseRow> = {}): ExerciseRow {
  return {
    id: randomUUID(),
    wgerId: null,
    name: 'Bench Press',
    nameDe: 'Bankdrücken',
    muscleGroups: ['Pectoralis major'],
    equipment: 'Barbell',
    mediaUrl: null,
    gifUrl: null,
    source: 'custom',
    userId: null,
    createdAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

export function fakeExerciseRepo(seed: ExerciseRow[] = []): ExerciseRepo & { rows: ExerciseRow[] } {
  const rows = [...seed];
  const visible = (userId: string) =>
    rows.filter((r) => !r.deletedAt && (r.userId === null || r.userId === userId));
  return {
    rows,
    async list(userId: string, filter: ExerciseFilter) {
      let out = visible(userId);
      if (filter.q) {
        const q = filter.q.toLowerCase();
        out = out.filter(
          (r) => r.name.toLowerCase().includes(q) || (r.nameDe ?? '').toLowerCase().includes(q),
        );
      }
      if (filter.muscle) out = out.filter((r) => r.muscleGroups.includes(filter.muscle!));
      if (filter.equipment) out = out.filter((r) => r.equipment === filter.equipment);
      return out.slice(filter.offset, filter.offset + filter.limit);
    },
    async findVisibleById(userId, id) {
      return visible(userId).find((r) => r.id === id) ?? null;
    },
    async findVisibleByIds(userId, ids) {
      return visible(userId).filter((r) => ids.includes(r.id));
    },
    async createCustom(input) {
      const row = makeExercise({
        userId: input.userId,
        name: input.name,
        nameDe: null,
        muscleGroups: input.muscleGroups,
        equipment: input.equipment,
      });
      rows.push(row);
      return row;
    },
  };
}

export function fakeRoutineRepo(): RoutineRepo & { rows: RoutineRow[]; items: RoutineItemRow[] } {
  const rows: RoutineRow[] = [];
  const items: RoutineItemRow[] = [];
  const owned = (userId: string) => rows.filter((r) => r.userId === userId && !r.deletedAt);
  return {
    rows,
    items,
    async list(userId) {
      return owned(userId);
    },
    async findById(userId, id) {
      return owned(userId).find((r) => r.id === id) ?? null;
    },
    async listItems(routineIds) {
      return items
        .filter((i) => routineIds.includes(i.routineId))
        .sort((a, b) => a.position - b.position);
    },
    async create(userId, input) {
      const row: RoutineRow = {
        id: randomUUID(),
        userId,
        name: input.name,
        weekday: input.weekday,
        createdAt: new Date(),
        deletedAt: null,
      };
      rows.push(row);
      return row;
    },
    async update(userId, id, patch) {
      const row = owned(userId).find((r) => r.id === id) ?? null;
      if (row) Object.assign(row, patch);
      return row;
    },
    async replaceItems(routineId, newItems: RoutineItemInsert[]) {
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i]!.routineId === routineId) items.splice(i, 1);
      }
      for (const it of newItems) {
        items.push({ id: randomUUID(), routineId, ...it });
      }
    },
    async softDelete(userId, id) {
      const row = owned(userId).find((r) => r.id === id) ?? null;
      if (row) row.deletedAt = new Date();
      return row;
    },
  };
}

export function fakeWorkoutRepo(): WorkoutRepo & { rows: WorkoutRow[]; setRows: SetRow[] } {
  const rows: WorkoutRow[] = [];
  const setRows: SetRow[] = [];
  const owned = (userId: string) => rows.filter((r) => r.userId === userId && !r.deletedAt);
  return {
    rows,
    setRows,
    async findByIdAnyUser(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async findById(userId, id) {
      return owned(userId).find((r) => r.id === id) ?? null;
    },
    async list(userId, filter) {
      let out = owned(userId);
      if (filter.from) out = out.filter((r) => r.startedAt >= filter.from!);
      if (filter.to) out = out.filter((r) => r.startedAt <= filter.to!);
      return out.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()).slice(0, filter.limit);
    },
    async upsert(input: WorkoutUpsert) {
      const existing = rows.find((r) => r.id === input.id);
      if (existing) {
        Object.assign(existing, input, { deletedAt: null, updatedAt: new Date() });
        return existing;
      }
      const row: WorkoutRow = {
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      rows.push(row);
      return row;
    },
    async softDelete(userId, id) {
      const row = owned(userId).find((r) => r.id === id) ?? null;
      if (row) row.deletedAt = new Date();
      return row;
    },
    async listSets(workoutIds) {
      return setRows
        .filter((s) => workoutIds.includes(s.workoutId) && !s.deletedAt)
        .sort((a, b) => a.position - b.position);
    },
    async findSetByIdAnyWorkout(id) {
      return setRows.find((s) => s.id === id) ?? null;
    },
    async upsertSet(input: SetUpsert) {
      const existing = setRows.find((s) => s.id === input.id);
      if (existing) {
        Object.assign(existing, input, { deletedAt: null, updatedAt: new Date() });
        return existing;
      }
      const row: SetRow = { ...input, updatedAt: new Date(), deletedAt: null };
      setRows.push(row);
      return row;
    },
    async softDeleteSet(id) {
      const row = setRows.find((s) => s.id === id);
      if (row) row.deletedAt = new Date();
    },
    async lastSetsForExercise(userId, exerciseId) {
      const candidates = setRows.filter((s) => {
        if (s.deletedAt || s.exerciseId !== exerciseId) return false;
        const w = rows.find((r) => r.id === s.workoutId);
        return !!w && w.userId === userId && !w.deletedAt;
      });
      let newest: WorkoutRow | undefined;
      for (const s of candidates) {
        const w = rows.find((r) => r.id === s.workoutId)!;
        if (!newest || w.startedAt > newest.startedAt) newest = w;
      }
      if (!newest) return [];
      return candidates
        .filter((s) => s.workoutId === newest!.id)
        .sort((a, b) => a.position - b.position);
    },
  };
}
