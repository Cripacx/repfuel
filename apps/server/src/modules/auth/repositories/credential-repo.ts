import { eq } from 'drizzle-orm';
import type { Database } from '../../../core/db.js';
import { credentials, type CredentialRow } from '../schema.js';

export interface CredentialRepo {
  findById(id: string): Promise<CredentialRow | null>;
  listByUserId(userId: string): Promise<CredentialRow[]>;
  create(input: {
    id: string;
    userId: string;
    publicKey: Uint8Array<ArrayBuffer>;
    counter: number;
    transports: string[] | null;
  }): Promise<CredentialRow>;
  updateCounter(id: string, counter: number): Promise<void>;
}

export function createCredentialRepo(db: Database): CredentialRepo {
  return {
    async findById(id) {
      const rows = await db.select().from(credentials).where(eq(credentials.id, id)).limit(1);
      return rows[0] ?? null;
    },
    async listByUserId(userId) {
      return db.select().from(credentials).where(eq(credentials.userId, userId));
    },
    async create(input) {
      const rows = await db.insert(credentials).values(input).returning();
      if (!rows[0]) throw new Error('insert credentials returned no row');
      return rows[0];
    },
    async updateCounter(id, counter) {
      await db.update(credentials).set({ counter }).where(eq(credentials.id, id));
    },
  };
}
