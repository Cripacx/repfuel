import { and, asc, count, eq, isNull } from 'drizzle-orm';
import type { Locale, UserRole } from '@repfuel/shared';
import type { Database } from '../../../core/db.js';
import { users, type UserRow } from '../schema.js';

export interface UserRepo {
  findById(id: string): Promise<UserRow | null>;
  findByUsername(username: string): Promise<UserRow | null>;
  countActive(): Promise<number>;
  list(): Promise<UserRow[]>;
  create(input: { username: string; role: UserRole }): Promise<UserRow>;
  updateLocale(id: string, locale: Locale | null): Promise<UserRow | null>;
  setDisabled(id: string, disabled: boolean): Promise<UserRow | null>;
  softDelete(id: string): Promise<UserRow | null>;
}

const notDeleted = isNull(users.deletedAt);

export function createUserRepo(db: Database): UserRepo {
  return {
    async findById(id) {
      const rows = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), notDeleted))
        .limit(1);
      return rows[0] ?? null;
    },
    async findByUsername(username) {
      const rows = await db
        .select()
        .from(users)
        .where(and(eq(users.username, username), notDeleted))
        .limit(1);
      return rows[0] ?? null;
    },
    async countActive() {
      const rows = await db.select({ n: count() }).from(users).where(notDeleted);
      return rows[0]?.n ?? 0;
    },
    async list() {
      return db.select().from(users).where(notDeleted).orderBy(asc(users.createdAt));
    },
    async create(input) {
      const rows = await db
        .insert(users)
        .values({ username: input.username, role: input.role })
        .returning();
      if (!rows[0]) throw new Error('insert users returned no row');
      return rows[0];
    },
    async updateLocale(id, locale) {
      const rows = await db
        .update(users)
        .set({ locale })
        .where(and(eq(users.id, id), notDeleted))
        .returning();
      return rows[0] ?? null;
    },
    async setDisabled(id, disabled) {
      const rows = await db
        .update(users)
        .set({ disabledAt: disabled ? new Date() : null })
        .where(and(eq(users.id, id), notDeleted))
        .returning();
      return rows[0] ?? null;
    },
    async softDelete(id) {
      const rows = await db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(and(eq(users.id, id), notDeleted))
        .returning();
      return rows[0] ?? null;
    },
  };
}
