/** Öffentliche Schnittstelle des KI-Moduls. */
import type { FastifyInstance } from 'fastify';
import { isCliProvider } from '@repfuel/shared';
import type { AIAdapter, AiProvider } from '@repfuel/shared';
import type { Database } from '../../core/db.js';
import type { KeyValueStore } from '../../core/redis.js';
import type { AuthGuards, ProfileService } from '../auth/index.js';
import type { IngestService, WeightService } from '../health/index.js';
import type { FoodService, MealService } from '../nutrition/index.js';
import type { ExerciseService, RoutineService, WorkoutService } from '../workout/index.js';
import { createApiAdapter, type ApiAdapterConfig } from './adapters/api-adapter.js';
import { createCliAdapter } from './adapters/cli-adapter.js';
import { mcpRoutes } from './mcp/mcp-routes.js';
import { createMcpTokenService, type McpTokenService } from './mcp/token-service.js';
import { buildToolSet } from './tools.js';
import { createChatRepo } from './repositories/chat-repo.js';
import { createMemoryRepo } from './repositories/memory-repo.js';
import { createProposalRepo } from './repositories/proposal-repo.js';
import { aiRoutes } from './routes.js';
import { createChatService, type ChatService } from './services/chat-service.js';
import { createMemoryService, type MemoryService } from './services/memory-service.js';
import { createProposalService } from './services/proposal-service.js';

export type { ChatService } from './services/chat-service.js';
export type { MemoryService } from './services/memory-service.js';
export type { ProposalService } from './services/proposal-service.js';

export interface AiModuleOptions {
  db: Database;
  kv: KeyValueStore;
  guards: AuthGuards;
  provider: AiProvider;
  apiKey: string | null;
  model: string | null;
  baseUrl: string | null;
  /** CLI-Sidecar (Adapter 3): HTTP-Endpunkt + MCP-URL, die der Sidecar nutzt. */
  sidecarUrl: string;
  mcpUrl: string;
  profileService: ProfileService;
  weightService: WeightService;
  ingestService: IngestService;
  mealService: MealService;
  foodService: FoodService;
  workoutService: WorkoutService;
  routineService: RoutineService;
  exerciseService: ExerciseService;
  /** Test-Injektion: ersetzt den aus der Config gebauten Adapter. */
  adapterOverride?: AIAdapter | null;
}

export interface AiModuleApi {
  chatService: ChatService;
  memoryService: MemoryService;
}

function buildAdapter(opts: AiModuleOptions, tokenService: McpTokenService): AIAdapter | null {
  if (opts.adapterOverride !== undefined) return opts.adapterOverride;
  if (opts.provider === 'none') return null;
  if (isCliProvider(opts.provider)) {
    return createCliAdapter({
      config: { provider: opts.provider, sidecarUrl: opts.sidecarUrl, mcpUrl: opts.mcpUrl },
      tokenService,
    });
  }
  if (!opts.model) return null;
  const config: ApiAdapterConfig = {
    provider: opts.provider,
    apiKey: opts.apiKey,
    model: opts.model,
    baseUrl: opts.baseUrl,
  };
  return createApiAdapter(config);
}

export async function registerAiModule(
  app: FastifyInstance,
  opts: AiModuleOptions,
): Promise<AiModuleApi> {
  const chatRepo = createChatRepo(opts.db);
  const proposalRepo = createProposalRepo(opts.db);
  const memoryService = createMemoryService(createMemoryRepo(opts.db));
  const tokenService = createMcpTokenService(opts.kv);
  const adapter = buildAdapter(opts, tokenService);

  const proposalService = createProposalService({
    proposalRepo,
    routineService: opts.routineService,
    profileService: opts.profileService,
  });

  const chatService = createChatService({
    chatRepo,
    adapter,
    provider: adapter ? opts.provider : 'none',
    profileService: opts.profileService,
    weightService: opts.weightService,
    memoryService,
    toolDeps: ({ userId, sessionId, tzOffsetMinutes }) => ({
      userId,
      sessionId,
      tzOffsetMinutes,
      mealService: opts.mealService,
      foodService: opts.foodService,
      workoutService: opts.workoutService,
      routineService: opts.routineService,
      exerciseService: opts.exerciseService,
      weightService: opts.weightService,
      ingestService: opts.ingestService,
      profileService: opts.profileService,
      memoryService,
    }),
    createProposal: (input) =>
      proposalService.create({
        userId: input.userId,
        sessionId: input.sessionId,
        kind: input.kind,
        summary: input.summary,
        payload: input.payload,
      }),
  });

  await app.register(aiRoutes({ chatService, proposalService, memoryService, guards: opts.guards }), {
    prefix: '/api/v1',
  });

  // MCP-Wrapper für den CLI-Sidecar: dieselben Tools, Auth per Session-Token.
  await app.register(
    mcpRoutes({
      tokenService,
      appVersion: '0.1.0',
      buildTools: (claims) =>
        buildToolSet({
          userId: claims.userId,
          sessionId: claims.chatSessionId,
          tzOffsetMinutes: claims.tzOffsetMinutes,
          mealService: opts.mealService,
          foodService: opts.foodService,
          workoutService: opts.workoutService,
          routineService: opts.routineService,
          exerciseService: opts.exerciseService,
          weightService: opts.weightService,
          ingestService: opts.ingestService,
          profileService: opts.profileService,
          memoryService,
          createProposal: (input) =>
            proposalService.create({
              userId: claims.userId,
              sessionId: claims.chatSessionId,
              kind: input.kind,
              summary: input.summary,
              payload: input.payload,
            }),
        }),
    }),
    { prefix: '/internal/mcp' },
  );

  return { chatService, memoryService };
}
