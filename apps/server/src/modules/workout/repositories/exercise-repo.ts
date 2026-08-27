import { and, asc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../../core/db.js';
import { exercises, type ExerciseRow } from '../schema.js';

export interface ExerciseFilter {
  q?: string;
  muscle?: string;
  equipment?: string;
  limit: number;
  offset: number;
}

export interface ExerciseRepo {
  /** Sichtbare Übungen: globale (user_id null) + eigene des Nutzers. */
  list(userId: string, filter: ExerciseFilter): Promise<ExerciseRow[]>;
  findVisibleById(userId: string, id: string): Promise<ExerciseRow | null>;
  findVisibleByIds(userId: string, ids: string[]): Promise<ExerciseRow[]>;
  createCustom(input: {
    userId: string;
    name: string;
    muscleGroups: string[];
    equipment: string | null;
  }): Promise<ExerciseRow>;
}

const visibleTo = (userId: string) =>
  and(isNull(exercises.deletedAt), or(isNull(exercises.userId), eq(exercises.userId, userId)));

export function createExerciseRepo(db: Database): ExerciseRepo {
  return {
    async list(userId, filter) {
      const conditions: SQL[] = [];
      if (filter.q) {
        const pattern = `%${filter.q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
        const nameMatch = or(ilike(exercises.name, pattern), ilike(exercises.nameDe, pattern));
        if (nameMatch) conditions.push(nameMatch);
      }
      if (filter.muscle) {
        conditions.push(
          sql`${exercises.muscleGroups} @> ${JSON.stringify([filter.muscle])}::jsonb`,
        );
      }
      if (filter.equipment) conditions.push(eq(exercises.equipment, filter.equipment));
      return db
        .select()
        .from(exercises)
        .where(and(visibleTo(userId), ...conditions))
        .orderBy(asc(exercises.name))
        .limit(filter.limit)
        .offset(filter.offset);
    },
    async findVisibleById(userId, id) {
      const rows = await db
        .select()
        .from(exercises)
        .where(and(eq(exercises.id, id), visibleTo(userId)))
        .limit(1);
      return rows[0] ?? null;
    },
    async findVisibleByIds(userId, ids) {
      if (ids.length === 0) return [];
      return db
        .select()
        .from(exercises)
        .where(and(sql`${exercises.id} in ${ids}`, visibleTo(userId)));
    },
    async createCustom(input) {
      const rows = await db
        .insert(exercises)
        .values({
          name: input.name,
          muscleGroups: input.muscleGroups,
          equipment: input.equipment,
          source: 'custom',
          userId: input.userId,
        })
        .returning();
      if (!rows[0]) throw new Error('insert exercises returned no row');
      return rows[0];
    },
  };
}
