import { and, asc, count, eq, isNull } from 'drizzle-orm';
import type { MemoryCategory } from '@repfuel/shared';
import type { Database } from '../../../core/db.js';
import { coachMemories, type CoachMemoryRow } from '../schema.js';

export interface MemoryRepo {
  list(userId: string): Promise<CoachMemoryRow[]>;
  count(userId: string): Promise<number>;
  insert(input: {
    userId: string;
    category: MemoryCategory;
    content: string;
  }): Promise<CoachMemoryRow>;
  update(userId: string, id: string, content: string): Promise<CoachMemoryRow | null>;
  softDelete(userId: string, id: string): Promise<CoachMemoryRow | null>;
  /** Löscht alle sichtbaren Einträge des Nutzers; liefert die Anzahl. */
  softDeleteAll(userId: string): Promise<number>;
}

const ownedVisible = (userId: string) =>
  and(eq(coachMemories.userId, userId), isNull(coachMemories.deletedAt));

export function createMemoryRepo(db: Database): MemoryRepo {
  return {
    async list(userId) {
      return db
        .select()
        .from(coachMemories)
        .where(ownedVisible(userId))
        .orderBy(asc(coachMemories.createdAt));
    },
    async count(userId) {
      const rows = await db
        .select({ value: count() })
        .from(coachMemories)
        .where(ownedVisible(userId));
      return rows[0]?.value ?? 0;
    },
    async insert(input) {
      const rows = await db.insert(coachMemories).values(input).returning();
      if (!rows[0]) throw new Error('insert coach_memories returned no row');
      return rows[0];
    },
    async update(userId, id, content) {
      const rows = await db
        .update(coachMemories)
        .set({ content })
        .where(and(eq(coachMemories.id, id), ownedVisible(userId)))
        .returning();
      return rows[0] ?? null;
    },
    async softDelete(userId, id) {
      const rows = await db
        .update(coachMemories)
        .set({ deletedAt: new Date() })
        .where(and(eq(coachMemories.id, id), ownedVisible(userId)))
        .returning();
      return rows[0] ?? null;
    },
    async softDeleteAll(userId) {
      const rows = await db
        .update(coachMemories)
        .set({ deletedAt: new Date() })
        .where(ownedVisible(userId))
        .returning({ id: coachMemories.id });
      return rows.length;
    },
  };
}
