import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../../core/db.js';
import { apiTokens, type ApiTokenRow } from '../schema.js';

export interface ApiTokenRepo {
  create(input: { userId: string; name: string; tokenHash: string }): Promise<ApiTokenRow>;
  findByHash(tokenHash: string): Promise<ApiTokenRow | null>;
  list(userId: string): Promise<ApiTokenRow[]>;
  revoke(userId: string, id: string): Promise<ApiTokenRow | null>;
  touch(id: string): Promise<void>;
}

export function createApiTokenRepo(db: Database): ApiTokenRepo {
  return {
    async create(input) {
      const rows = await db.insert(apiTokens).values(input).returning();
      if (!rows[0]) throw new Error('insert api_tokens returned no row');
      return rows[0];
    },
    async findByHash(tokenHash) {
      const rows = await db
        .select()
        .from(apiTokens)
        .where(and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt)))
        .limit(1);
      return rows[0] ?? null;
    },
    async list(userId) {
      return db
        .select()
        .from(apiTokens)
        .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
        .orderBy(desc(apiTokens.createdAt));
    },
    async revoke(userId, id) {
      const rows = await db
        .update(apiTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
        .returning();
      return rows[0] ?? null;
    },
    async touch(id) {
      await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, id));
    },
  };
}
