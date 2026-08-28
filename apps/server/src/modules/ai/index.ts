/** Öffentliche Schnittstelle des KI-Moduls. */
import type { FastifyInstance } from 'fastify';
import type { AIAdapter, AiProvider } from '@repfuel/shared';
import type { Database } from '../../core/db.js';
import type { AuthGuards, ProfileService } from '../auth/index.js';
import type { WeightService } from '../health/index.js';
import type { FoodService, MealService } from '../nutrition/index.js';
import type { RoutineService, WorkoutService } from '../workout/index.js';
import { createApiAdapter, type ApiAdapterConfig } from './adapters/api-adapter.js';
import { createChatRepo } from './repositories/chat-repo.js';
import { createProposalRepo } from './repositories/proposal-repo.js';
import { aiRoutes } from './routes.js';
import { createChatService, type ChatService } from './services/chat-service.js';
import { createProposalService } from './services/proposal-service.js';

export type { ChatService } from './services/chat-service.js';
export type { ProposalService } from './services/proposal-service.js';

export interface AiModuleOptions {
  db: Database;
  guards: AuthGuards;
  provider: AiProvider;
  apiKey: string | null;
  model: string | null;
  baseUrl: string | null;
  profileService: ProfileService;
  weightService: WeightService;
  mealService: MealService;
  foodService: FoodService;
  workoutService: WorkoutService;
  routineService: RoutineService;
  /** Test-Injektion: ersetzt den aus der Config gebauten Adapter. */
  adapterOverride?: AIAdapter | null;
}

export interface AiModuleApi {
  chatService: ChatService;
}

function buildAdapter(opts: AiModuleOptions): AIAdapter | null {
  if (opts.adapterOverride !== undefined) return opts.adapterOverride;
  if (opts.provider === 'none' || opts.provider === 'cli') return null; // CLI-Adapter folgt in M6
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
  const adapter = buildAdapter(opts);

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
    toolDeps: ({ userId, sessionId, tzOffsetMinutes }) => ({
      userId,
      sessionId,
      tzOffsetMinutes,
      mealService: opts.mealService,
      foodService: opts.foodService,
      workoutService: opts.workoutService,
      routineService: opts.routineService,
      weightService: opts.weightService,
      profileService: opts.profileService,
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

  await app.register(aiRoutes({ chatService, proposalService, guards: opts.guards }), {
    prefix: '/api/v1',
  });

  return { chatService };
}
