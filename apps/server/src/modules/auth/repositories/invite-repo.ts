import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../../core/db.js';
import { invites, type InviteRow } from '../schema.js';

export interface InviteRepo {
  findById(id: string): Promise<InviteRow | null>;
  findByToken(token: string): Promise<InviteRow | null>;
  list(): Promise<InviteRow[]>;
  create(input: {
    token: string;
    username: string | null;
    createdBy: string;
    expiresAt: Date;
  }): Promise<InviteRow>;
  markUsed(id: string, usedBy: string): Promise<void>;
  revoke(id: string): Promise<InviteRow | null>;
}

export function createInviteRepo(db: Database): InviteRepo {
  return {
    async findById(id) {
      const rows = await db.select().from(invites).where(eq(invites.id, id)).limit(1);
      return rows[0] ?? null;
    },
    async findByToken(token) {
      const rows = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
      return rows[0] ?? null;
    },
    async list() {
      return db.select().from(invites).orderBy(desc(invites.createdAt));
    },
    async create(input) {
      const rows = await db.insert(invites).values(input).returning();
      if (!rows[0]) throw new Error('insert invites returned no row');
      return rows[0];
    },
    async markUsed(id, usedBy) {
      await db.update(invites).set({ usedBy, usedAt: new Date() }).where(eq(invites.id, id));
    },
    async revoke(id) {
      const rows = await db
        .update(invites)
        .set({ revokedAt: new Date() })
        .where(eq(invites.id, id))
        .returning();
      return rows[0] ?? null;
    },
  };
}
