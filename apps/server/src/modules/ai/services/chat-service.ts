import type {
  AIAdapter,
  AiProvider,
  AiStatusResponse,
  ChatChunk,
  ChatMessageDto,
  ChatSessionDto,
  ProposalDto,
  ProposalKind,
  SessionUser,
  ToolCallInfo,
  UserContextSnapshot,
} from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { ProfileService } from '../../auth/index.js';
import type { WeightService } from '../../health/index.js';
import type { ChatRepo } from '../repositories/chat-repo.js';
import type { MemoryService } from './memory-service.js';
import type { ChatMessageRow, ChatSessionRow } from '../schema.js';
import type { ToolDeps } from '../tools.js';
import { buildToolSet } from '../tools.js';

export interface ChatServiceDeps {
  chatRepo: ChatRepo;
  adapter: AIAdapter | null;
  provider: AiProvider;
  profileService: ProfileService;
  weightService: WeightService;
  memoryService: MemoryService;
  /** Offene Vorschläge DIESES Gesprächs für den System-Prompt (Überarbeitung statt Duplikat). */
  listPendingProposals: (userId: string, sessionId: string) => Promise<ProposalDto[]>;
  /** Beim Löschen eines Gesprächs dessen offene Vorschläge verwerfen. */
  rejectPendingProposalsForSession: (userId: string, sessionId: string) => Promise<number>;
  /** Baut die Tool-Dependencies für einen Chat-Turn (userId/session-gebunden). */
  toolDeps: (input: {
    userId: string;
    sessionId: string;
    tzOffsetMinutes: number;
  }) => Omit<ToolDeps, 'createProposal'>;
  createProposal: (input: {
    userId: string;
    sessionId: string;
    kind: ProposalKind;
    summary: string;
    payload: unknown;
  }) => Promise<ProposalDto>;
}

const TITLE_MAX_LENGTH = 60;

/** Modell-Antwort → Listentitel: erste Zeile, ohne Markdown-Reste/Anführung. */
export function sanitizeSessionTitle(raw: string): string | null {
  const line =
    raw
      .split('\n')
      .map((part) => part.replace(/[*_#`>"„“”«»]/g, '').trim())
      .find((part) => part.length > 0) ?? '';
  const cleaned = line.replace(/\s+/g, ' ').replace(/[.!:]+$/, '').trim();
  if (cleaned.length < 2) return null;
  return cleaned.length > TITLE_MAX_LENGTH
    ? `${cleaned.slice(0, TITLE_MAX_LENGTH - 1)}…`
    : cleaned;
}

function toSessionDto(row: ChatSessionRow): ChatSessionDto {
  return {
    id: row.id,
    adapter: row.adapter,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
  };
}

function toMessageDto(row: ChatMessageRow): ChatMessageDto {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    toolCalls: row.toolCalls ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export type ChatService = ReturnType<typeof createChatService>;

export function createChatService(deps: ChatServiceDeps) {
  const enabled = deps.adapter !== null && deps.provider !== 'none';

  async function requireSession(userId: string, sessionId: string): Promise<ChatSessionRow> {
    const session = await deps.chatRepo.findSession(userId, sessionId);
    if (!session) throw new AppError('not_found', 'Chat session not found');
    return session;
  }

  function requireEnabled(): AIAdapter {
    if (!enabled || !deps.adapter) {
      throw new AppError('ai_disabled', 'No AI adapter is configured');
    }
    return deps.adapter;
  }

  async function buildContext(
    user: SessionUser,
    tzOffsetMinutes: number,
    sessionId: string,
  ): Promise<UserContextSnapshot> {
    const profile = await deps.profileService.get(user.id);
    const weights = await deps.weightService.list(user.id, { limit: 1 });
    const memories = await deps.memoryService.list(user.id);
    const pendingProposals = await deps.listPendingProposals(user.id, sessionId);
    const tzSign = tzOffsetMinutes <= 0 ? '+' : '-';
    const abs = Math.abs(tzOffsetMinutes);
    const localNow = new Date(Date.now() - tzOffsetMinutes * 60_000);
    return {
      userId: user.id,
      username: user.username,
      locale: user.locale ?? 'de',
      timezone: `UTC${tzSign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`,
      tzOffsetMinutes,
      currentDate: localNow.toISOString().slice(0, 10),
      profile: profile
        ? {
            heightCm: profile.heightCm,
            birthYear: profile.birthYear,
            sex: profile.sex,
            activityLevel: profile.activityLevel,
            goal: profile.goal,
            kcalTarget: profile.kcalTarget,
            proteinTargetG: profile.proteinTargetG,
            carbsTargetG: profile.carbsTargetG,
            fatTargetG: profile.fatTargetG,
          }
        : null,
      latestWeightKg: weights[0]?.weightKg ?? null,
      memories: memories.map((memory) => ({
        id: memory.id,
        category: memory.category,
        content: memory.content,
      })),
      pendingProposals: pendingProposals.map((proposal) => ({
        id: proposal.id,
        kind: proposal.kind,
        summary: proposal.summary,
      })),
    };
  }

  /**
   * Hintergrund-Feinschliff nach dem ersten Turn: der Adapter formuliert einen
   * kurzen Titel; bis dahin (und bei Fehlern) bleibt die gekürzte erste
   * Nachricht stehen. Läuft bewusst NACH dem Stream — blockiert nie die Antwort.
   */
  async function generateTitle(
    sessionId: string,
    firstMessage: string,
    userContext: UserContextSnapshot,
  ): Promise<void> {
    if (!deps.adapter) return;
    const prompt = [
      'Gib dieser neuen Coach-Unterhaltung einen kurzen, prägnanten Titel (2–5 Wörter, in der Sprache der Nachricht).',
      'Antworte NUR mit dem Titel — keine Anführungszeichen, kein Punkt, keine Tools benutzen.',
      '',
      `Erste Nachricht: ${firstMessage.slice(0, 500)}`,
    ].join('\n');
    try {
      let text = '';
      for await (const chunk of deps.adapter.chat({
        sessionId,
        messages: [
          {
            id: `title-${sessionId}`,
            role: 'user',
            content: prompt,
            toolCalls: null,
            createdAt: new Date().toISOString(),
          },
        ],
        tools: {},
        userContext,
      })) {
        if (chunk.type === 'text-delta') text += chunk.text;
        else if (chunk.type === 'error') return;
      }
      const title = sanitizeSessionTitle(text);
      if (title) await deps.chatRepo.setTitle(sessionId, title);
    } catch {
      // Fallback-Titel bleibt stehen; ein fehlgeschlagener Titel ist kein Fehlerfall.
    }
  }

  return {
    async status(): Promise<AiStatusResponse> {
      if (!enabled || !deps.adapter) return { enabled: false, status: null };
      return { enabled: true, status: await deps.adapter.healthCheck() };
    },

    async createSession(userId: string): Promise<ChatSessionDto> {
      requireEnabled();
      const row = await deps.chatRepo.createSession(userId, deps.provider);
      return toSessionDto(row);
    },

    async listSessions(userId: string): Promise<ChatSessionDto[]> {
      return (await deps.chatRepo.listSessions(userId)).map(toSessionDto);
    },

    async deleteSession(userId: string, sessionId: string): Promise<void> {
      const row = await deps.chatRepo.deleteSession(userId, sessionId);
      if (!row) throw new AppError('not_found', 'Chat session not found');
      await deps.rejectPendingProposalsForSession(userId, sessionId);
    },

    async listMessages(userId: string, sessionId: string): Promise<ChatMessageDto[]> {
      await requireSession(userId, sessionId);
      return (await deps.chatRepo.listMessages(sessionId)).map(toMessageDto);
    },

    /**
     * Verarbeitet eine Nutzer-Nachricht: persistieren, Adapter streamen lassen,
     * Tool-Aufrufe/Antwort sammeln und als Assistant-Nachricht persistieren.
     */
    async *streamMessage(input: {
      user: SessionUser;
      sessionId: string;
      content: string;
      tzOffsetMinutes: number;
    }): AsyncIterable<ChatChunk> {
      const adapter = requireEnabled();
      const session = await requireSession(input.user.id, input.sessionId);
      await deps.chatRepo.addMessage({
        sessionId: session.id,
        role: 'user',
        content: input.content,
        toolCalls: null,
      });
      const isFirstTurn = !session.title;
      if (isFirstTurn) {
        const title = input.content.length > 60 ? `${input.content.slice(0, 57)}…` : input.content;
        await deps.chatRepo.setTitle(session.id, title);
      }

      const history = (await deps.chatRepo.listMessages(session.id)).map(toMessageDto);
      const userContext = await buildContext(input.user, input.tzOffsetMinutes, session.id);
      const tools = buildToolSet({
        ...deps.toolDeps({
          userId: input.user.id,
          sessionId: session.id,
          tzOffsetMinutes: input.tzOffsetMinutes,
        }),
        createProposal: (p) =>
          deps.createProposal({ userId: input.user.id, sessionId: session.id, ...p }),
      });

      let text = '';
      const toolCalls: ToolCallInfo[] = [];
      let errored = false;
      for await (const chunk of adapter.chat({
        sessionId: session.id,
        messages: history,
        tools,
        userContext,
      })) {
        if (chunk.type === 'text-delta') {
          text += chunk.text;
        } else if (chunk.type === 'tool-call') {
          toolCalls.push({ toolName: chunk.toolName, args: chunk.args });
        } else if (chunk.type === 'tool-result') {
          const open = [...toolCalls].reverse().find((c) => c.toolName === chunk.toolName && c.result === undefined);
          if (open) open.result = chunk.result;
        } else if (chunk.type === 'error') {
          errored = true;
        }
        yield chunk;
      }

      if (text.length > 0 || toolCalls.length > 0) {
        const saved = await deps.chatRepo.addMessage({
          sessionId: session.id,
          role: 'assistant',
          content: text,
          toolCalls: toolCalls.length > 0 ? toolCalls : null,
        });
        yield { type: 'done', messageId: saved.id };
        if (isFirstTurn && !errored) {
          void generateTitle(session.id, input.content, userContext);
        }
      } else if (!errored) {
        yield { type: 'error', message: 'Empty response from adapter' };
      }
    },
  };
}
