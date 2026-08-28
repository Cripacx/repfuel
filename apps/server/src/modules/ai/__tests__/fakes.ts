import { randomUUID } from 'node:crypto';
import type { AIAdapter, ChatChunk, ToolCallInfo } from '@repfuel/shared';
import type { ChatRepo } from '../repositories/chat-repo.js';
import type { ProposalRepo } from '../repositories/proposal-repo.js';
import type { AiProposalRow, ChatMessageRow, ChatSessionRow } from '../schema.js';

export function fakeChatRepo(): ChatRepo & { sessions: ChatSessionRow[]; messages: ChatMessageRow[] } {
  const sessions: ChatSessionRow[] = [];
  const messages: ChatMessageRow[] = [];
  return {
    sessions,
    messages,
    async createSession(userId, adapter) {
      const row: ChatSessionRow = {
        id: randomUUID(),
        userId,
        adapter,
        title: null,
        createdAt: new Date(),
        deletedAt: null,
      };
      sessions.push(row);
      return row;
    },
    async findSession(userId, id) {
      return sessions.find((s) => s.id === id && s.userId === userId && !s.deletedAt) ?? null;
    },
    async listSessions(userId) {
      return sessions.filter((s) => s.userId === userId && !s.deletedAt);
    },
    async setTitle(id, title) {
      const row = sessions.find((s) => s.id === id);
      if (row) row.title = title;
    },
    async deleteSession(userId, id) {
      const row = sessions.find((s) => s.id === id && s.userId === userId && !s.deletedAt) ?? null;
      if (row) row.deletedAt = new Date();
      return row;
    },
    async addMessage(input) {
      const row: ChatMessageRow = {
        id: randomUUID(),
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        toolCalls: (input.toolCalls as ToolCallInfo[] | null) ?? null,
        createdAt: new Date(),
      };
      messages.push(row);
      return row;
    },
    async listMessages(sessionId) {
      return messages.filter((m) => m.sessionId === sessionId);
    },
  };
}

export function fakeProposalRepo(): ProposalRepo & { rows: AiProposalRow[] } {
  const rows: AiProposalRow[] = [];
  return {
    rows,
    async create(input) {
      const row: AiProposalRow = {
        id: randomUUID(),
        userId: input.userId,
        sessionId: input.sessionId,
        kind: input.kind,
        summary: input.summary,
        payload: input.payload,
        status: 'pending',
        createdAt: new Date(),
        resolvedAt: null,
      };
      rows.push(row);
      return row;
    },
    async findById(userId, id) {
      return rows.find((r) => r.id === id && r.userId === userId) ?? null;
    },
    async listByStatus(userId, status) {
      return rows.filter((r) => r.userId === userId && r.status === status);
    },
    async setStatus(id, status) {
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.status = status;
        row.resolvedAt = new Date();
      }
    },
  };
}

/** Skript-Adapter: liefert vorgegebene Chunks und zeichnet Aufrufe auf. */
export function scriptedAdapter(chunks: ChatChunk[]): AIAdapter & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    async *chat(input) {
      calls.push(input);
      for (const chunk of chunks) yield chunk;
    },
    async healthCheck() {
      return { provider: 'openai', configured: true, ok: true, model: 'test-model', message: null };
    },
  };
}
