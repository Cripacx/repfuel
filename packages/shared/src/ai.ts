import { z } from 'zod';

/** KI-Schicht: Adapter-Interface und Chat-Typen (provider-neutral). */

export const AI_PROVIDERS = [
  'none',
  'anthropic',
  'openai',
  'openrouter',
  'ollama',
  /** Veralteter Alias für claude-local (bleibt für bestehende .env-Dateien). */
  'cli',
  'claude-local',
  'codex-local',
] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Läuft dieser Provider über den CLI-Sidecar (statt API/Ollama)? */
export function isCliProvider(
  provider: AiProvider,
): provider is 'cli' | 'claude-local' | 'codex-local' {
  return provider === 'cli' || provider === 'claude-local' || provider === 'codex-local';
}

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

export const PROPOSAL_KINDS = ['update_routine', 'update_profile', 'create_routine'] as const;
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

// ---------- Antwort-Aktionen: von der KI vorgeschlagene Schnellantworten ----------

/**
 * Die KI hängt über das Tool `suggest_actions` bis zu drei Buttons an ihre
 * Antwort; ein Klick schickt den hinterlegten Prompt als Nutzer-Nachricht.
 * Dasselbe Schema validiert den Tool-Input (Server) und die persistierten
 * Tool-Args beim Rendern (Web) — kaputte Args fallen still weg.
 */
export const chatActionSchema = z.object({
  label: z.string().min(1).max(40),
  prompt: z.string().min(1).max(500),
});
export type ChatAction = z.infer<typeof chatActionSchema>;

export const suggestActionsInputSchema = z.object({
  actions: z.array(chatActionSchema).min(1).max(3),
});

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

// ---------- Coach-Gedächtnis: dauerhafte Nutzer-Fakten für Pläne & Vorschläge ----------

export const MEMORY_CATEGORIES = ['goal', 'preference', 'constraint', 'fact'] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export interface CoachMemoryDto {
  id: string;
  category: MemoryCategory;
  content: string;
  createdAt: string;
}

export const addCoachMemoryRequestSchema = z.object({
  category: z.enum(MEMORY_CATEGORIES),
  content: z.string().min(2).max(1000),
});
export type AddCoachMemoryRequest = z.infer<typeof addCoachMemoryRequestSchema>;

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
  /** Coach-Gedächtnis: vom Nutzer stammende, dauerhafte Fakten (klein halten). */
  memories: { id: string; category: MemoryCategory; content: string }[];
  /** Offene KI-Vorschläge — Basis für Überarbeitungen per revises_proposal_id. */
  pendingProposals: { id: string; kind: ProposalKind; summary: string }[];
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

/** Nutzer tauscht in einem offenen Routinen-Vorschlag eine Übung gegen eine ähnliche. */
export const swapProposalExerciseRequestSchema = z.object({
  fromExerciseId: z.string().uuid(),
  toExerciseId: z.string().uuid(),
});
export type SwapProposalExerciseRequest = z.infer<typeof swapProposalExerciseRequestSchema>;

export interface AiStatusResponse {
  /** false ⇒ Chat-Tab und alle KI-UI-Elemente ausblenden. */
  enabled: boolean;
  status: AdapterStatus | null;
}
