import { eq } from 'drizzle-orm';
import type { Database } from '../../../core/db.js';
import { profiles, type ProfileRow } from '../schema.js';

export type ProfilePatch = Partial<Omit<ProfileRow, 'userId' | 'updatedAt'>>;

export interface ProfileRepo {
  find(userId: string): Promise<ProfileRow | null>;
  upsert(userId: string, patch: ProfilePatch): Promise<ProfileRow>;
}

export function createProfileRepo(db: Database): ProfileRepo {
  return {
    async find(userId) {
      const rows = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
      return rows[0] ?? null;
    },
    async upsert(userId, patch) {
      const rows = await db
        .insert(profiles)
        .values({ userId, ...patch, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: { ...patch, updatedAt: new Date() },
        })
        .returning();
      if (!rows[0]) throw new Error('upsert profiles returned no row');
      return rows[0];
    },
  };
}
