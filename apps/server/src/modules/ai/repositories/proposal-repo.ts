import { and, desc, eq } from 'drizzle-orm';
import type { ProposalKind, ProposalStatus } from '@repfuel/shared';
import type { Database } from '../../../core/db.js';
import { aiProposals, type AiProposalRow } from '../schema.js';

export interface ProposalRepo {
  create(input: {
    userId: string;
    sessionId: string | null;
    kind: ProposalKind;
    summary: string;
    payload: unknown;
  }): Promise<AiProposalRow>;
  findById(userId: string, id: string): Promise<AiProposalRow | null>;
  listByStatus(userId: string, status: ProposalStatus): Promise<AiProposalRow[]>;
  setStatus(id: string, status: ProposalStatus): Promise<void>;
}

export function createProposalRepo(db: Database): ProposalRepo {
  return {
    async create(input) {
      const rows = await db.insert(aiProposals).values(input).returning();
      if (!rows[0]) throw new Error('insert ai_proposals returned no row');
      return rows[0];
    },
    async findById(userId, id) {
      const rows = await db
        .select()
        .from(aiProposals)
        .where(and(eq(aiProposals.id, id), eq(aiProposals.userId, userId)))
        .limit(1);
      return rows[0] ?? null;
    },
    async listByStatus(userId, status) {
      return db
        .select()
        .from(aiProposals)
        .where(and(eq(aiProposals.userId, userId), eq(aiProposals.status, status)))
        .orderBy(desc(aiProposals.createdAt));
    },
    async setStatus(id, status) {
      await db
        .update(aiProposals)
        .set({ status, resolvedAt: new Date() })
        .where(eq(aiProposals.id, id));
    },
  };
}
