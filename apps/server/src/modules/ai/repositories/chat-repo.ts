import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { ToolCallInfo } from '@repfuel/shared';
import type { Database } from '../../../core/db.js';
import {
  chatMessages,
  chatSessions,
  type ChatMessageRow,
  type ChatSessionRow,
} from '../schema.js';

export interface ChatRepo {
  createSession(userId: string, adapter: string): Promise<ChatSessionRow>;
  findSession(userId: string, id: string): Promise<ChatSessionRow | null>;
  listSessions(userId: string): Promise<ChatSessionRow[]>;
  setTitle(id: string, title: string): Promise<void>;
  deleteSession(userId: string, id: string): Promise<ChatSessionRow | null>;
  addMessage(input: {
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    toolCalls: ToolCallInfo[] | null;
  }): Promise<ChatMessageRow>;
  listMessages(sessionId: string): Promise<ChatMessageRow[]>;
}

export function createChatRepo(db: Database): ChatRepo {
  return {
    async createSession(userId, adapter) {
      const rows = await db.insert(chatSessions).values({ userId, adapter }).returning();
      if (!rows[0]) throw new Error('insert chat_sessions returned no row');
      return rows[0];
    },
    async findSession(userId, id) {
      const rows = await db
        .select()
        .from(chatSessions)
        .where(
          and(eq(chatSessions.id, id), eq(chatSessions.userId, userId), isNull(chatSessions.deletedAt)),
        )
        .limit(1);
      return rows[0] ?? null;
    },
    async listSessions(userId) {
      return db
        .select()
        .from(chatSessions)
        .where(and(eq(chatSessions.userId, userId), isNull(chatSessions.deletedAt)))
        .orderBy(desc(chatSessions.createdAt));
    },
    async setTitle(id, title) {
      await db.update(chatSessions).set({ title }).where(eq(chatSessions.id, id));
    },
    async deleteSession(userId, id) {
      const rows = await db
        .update(chatSessions)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(chatSessions.id, id), eq(chatSessions.userId, userId), isNull(chatSessions.deletedAt)),
        )
        .returning();
      return rows[0] ?? null;
    },
    async addMessage(input) {
      const rows = await db.insert(chatMessages).values(input).returning();
      if (!rows[0]) throw new Error('insert chat_messages returned no row');
      return rows[0];
    },
    async listMessages(sessionId) {
      return db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(asc(chatMessages.createdAt));
    },
  };
}
