import { z } from 'zod';

/** KI-Schicht: Adapter-Interface und Chat-Typen (provider-neutral). */

export const AI_PROVIDERS = ['none', 'anthropic', 'openai', 'openrouter', 'ollama', 'cli'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export type ChatRole = 'user' | 'assistant';

export interface ToolCallInfo {
  toolName: string;
  args: unknown;
  result?: unknown;
}

export interface ChatMessageDto {
  id: string;
  role: ChatRole;
  content: string;
  toolCalls: ToolCallInfo[] | null;
  createdAt: string;
}

export interface ChatSessionDto {
  id: string;
  adapter: string;
  title: string | null;
  createdAt: string;
}

export const PROPOSAL_KINDS = ['update_routine', 'update_profile'] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export type ProposalStatus = 'pending' | 'confirmed' | 'rejected';

export interface ProposalDto {
  id: string;
  kind: ProposalKind;
  /** Menschlich lesbare Zusammenfassung des Vorschlags (von der KI formuliert). */
  summary: string;
  /** Validierter Payload — wird erst nach Nutzer-Bestätigung angewendet. */
  payload: unknown;
  status: ProposalStatus;
  createdAt: string;
}

/** Streaming-Chunks des Chat-Endpoints (SSE) und der Adapter. */
export type ChatChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolName: string; args: unknown }
  | { type: 'tool-result'; toolName: string; result: unknown }
  | { type: 'proposal'; proposal: ProposalDto }
  | { type: 'done'; messageId: string }
  | { type: 'error'; message: string };

export interface AdapterStatus {
  provider: AiProvider;
  configured: boolean;
  /** true = Adapter erreichbar und nutzbar. */
  ok: boolean;
  model: string | null;
  message: string | null;
}

/** Kompakter Profil-Snapshot für den System-Prompt (keine Rohdaten!). */
export interface UserContextSnapshot {
  userId: string;
  username: string;
  locale: string;
  timezone: string;
  tzOffsetMinutes: number;
  currentDate: string;
  profile: {
    heightCm: number | null;
    birthYear: number | null;
    sex: string | null;
    activityLevel: string | null;
    goal: string | null;
    kcalTarget: number | null;
    proteinTargetG: number | null;
    carbsTargetG: number | null;
    fatTargetG: number | null;
  } | null;
  latestWeightKg: number | null;
}

/**
 * Tool-Definition, wie Adapter sie konsumieren: zod-Schema + Ausführung über
 * die Service-Schicht. Beim CLI-Adapter (M6) läuft die Ausführung stattdessen
 * über den MCP-Wrapper — dieselben Services, andere Anbindung.
 */
export interface ToolDefinition<TInput = unknown> {
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute: (input: TInput) => Promise<unknown>;
}

export type ToolSet = Record<string, ToolDefinition<never>>;

export interface AIAdapter {
  chat(input: {
    sessionId: string;
    messages: ChatMessageDto[];
    tools: ToolSet;
    userContext: UserContextSnapshot;
  }): AsyncIterable<ChatChunk>;
  healthCheck(): Promise<AdapterStatus>;
}

// --- API-Schemas ---

export const createChatSessionRequestSchema = z.object({});

export const postChatMessageRequestSchema = z.object({
  content: z.string().min(1).max(8000),
  tzOffsetMinutes: z.number().int().min(-840).max(840).default(0),
});
export type PostChatMessageRequest = z.infer<typeof postChatMessageRequestSchema>;

export const chatSessionIdParamsSchema = z.object({ id: z.string().uuid() });
export const proposalIdParamsSchema = z.object({ id: z.string().uuid() });

export interface AiStatusResponse {
  /** false ⇒ Chat-Tab und alle KI-UI-Elemente ausblenden. */
  enabled: boolean;
  status: AdapterStatus | null;
}
