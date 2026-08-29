import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { MemoryCategory, ProposalKind, ProposalStatus, ToolCallInfo } from '@repfuel/shared';
import { users } from '../auth/schema.js';

export const chatSessions = pgTable(
  'chat_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    adapter: text('adapter').notNull(),
    title: text('title'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('chat_sessions_user_id_idx').on(t.userId)],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: text('role').$type<'user' | 'assistant'>().notNull(),
    content: text('content').notNull(),
    toolCalls: jsonb('tool_calls').$type<ToolCallInfo[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('chat_messages_session_id_idx').on(t.sessionId)],
);

export const aiProposals = pgTable(
  'ai_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => chatSessions.id, { onDelete: 'set null' }),
    kind: text('kind').$type<ProposalKind>().notNull(),
    summary: text('summary').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').$type<ProposalStatus>().notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [index('ai_proposals_user_id_idx').on(t.userId)],
);

export const coachMemories = pgTable(
  'coach_memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: text('category').$type<MemoryCategory>().notNull().default('fact'),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('coach_memories_user_id_idx').on(t.userId)],
);

export type ChatSessionRow = typeof chatSessions.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type AiProposalRow = typeof aiProposals.$inferSelect;
export type CoachMemoryRow = typeof coachMemories.$inferSelect;
