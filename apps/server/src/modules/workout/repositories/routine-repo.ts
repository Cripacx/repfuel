import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from '../../../core/db.js';
import { routineItems, routines, type RoutineItemRow, type RoutineRow } from '../schema.js';

export interface RoutineItemInsert {
  exerciseId: string;
  position: number;
  supersetGroup: number | null;
  targetSets: number;
  targetReps: number;
  targetWeightKg: number | null;
}

export interface RoutineRepo {
  list(userId: string): Promise<RoutineRow[]>;
  findById(userId: string, id: string): Promise<RoutineRow | null>;
  listItems(routineIds: string[]): Promise<RoutineItemRow[]>;
  create(userId: string, input: { name: string; weekday: number | null }): Promise<RoutineRow>;
  update(
    userId: string,
    id: string,
    patch: { name?: string; weekday?: number | null },
  ): Promise<RoutineRow | null>;
  replaceItems(routineId: string, items: RoutineItemInsert[]): Promise<void>;
  softDelete(userId: string, id: string): Promise<RoutineRow | null>;
}

const ownedBy = (userId: string) => and(eq(routines.userId, userId), isNull(routines.deletedAt));

export function createRoutineRepo(db: Database): RoutineRepo {
  return {
    async list(userId) {
      return db.select().from(routines).where(ownedBy(userId)).orderBy(asc(routines.createdAt));
    },
    async findById(userId, id) {
      const rows = await db
        .select()
        .from(routines)
        .where(and(eq(routines.id, id), ownedBy(userId)))
        .limit(1);
      return rows[0] ?? null;
    },
    async listItems(routineIds) {
      if (routineIds.length === 0) return [];
      return db
        .select()
        .from(routineItems)
        .where(inArray(routineItems.routineId, routineIds))
        .orderBy(asc(routineItems.position));
    },
    async create(userId, input) {
      const rows = await db
        .insert(routines)
        .values({ userId, name: input.name, weekday: input.weekday })
        .returning();
      if (!rows[0]) throw new Error('insert routines returned no row');
      return rows[0];
    },
    async update(userId, id, patch) {
      const rows = await db
        .update(routines)
        .set(patch)
        .where(and(eq(routines.id, id), ownedBy(userId)))
        .returning();
      return rows[0] ?? null;
    },
    async replaceItems(routineId, items) {
      await db.delete(routineItems).where(eq(routineItems.routineId, routineId));
      if (items.length > 0) {
        await db.insert(routineItems).values(items.map((i) => ({ ...i, routineId })));
      }
    },
    async softDelete(userId, id) {
      const rows = await db
        .update(routines)
        .set({ deletedAt: new Date() })
        .where(and(eq(routines.id, id), ownedBy(userId)))
        .returning();
      return rows[0] ?? null;
    },
  };
}
