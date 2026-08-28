import { z } from 'zod';
import type { ProposalDto, ProposalKind } from '@repfuel/shared';
import {
  createRoutineRequestSchema,
  updateProfileRequestSchema,
  updateRoutineRequestSchema,
} from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { ProfileService } from '../../auth/index.js';
import type { RoutineService } from '../../workout/index.js';
import type { ProposalRepo } from '../repositories/proposal-repo.js';
import type { AiProposalRow } from '../schema.js';

/** Anzeigehilfe im Payload: Übungs-ID → Name (nur fürs UI, nie fürs Anwenden). */
const exerciseNamesSchema = z.record(z.string(), z.string()).optional();

const routinePayloadSchema = z.object({
  routineId: z.string().uuid(),
  changes: updateRoutineRequestSchema,
  exerciseNames: exerciseNamesSchema,
});
const profilePayloadSchema = z.object({ changes: updateProfileRequestSchema });
const createRoutinePayloadSchema = z.object({
  routine: createRoutineRequestSchema,
  exerciseNames: exerciseNamesSchema,
});

const payloadSchemas = {
  update_routine: routinePayloadSchema,
  update_profile: profilePayloadSchema,
  create_routine: createRoutinePayloadSchema,
} as const;

export function toProposalDto(row: AiProposalRow): ProposalDto {
  return {
    id: row.id,
    kind: row.kind,
    summary: row.summary,
    payload: row.payload,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ProposalServiceDeps {
  proposalRepo: ProposalRepo;
  routineService: RoutineService;
  profileService: ProfileService;
}

export type ProposalService = ReturnType<typeof createProposalService>;

/**
 * Bestätigungs-Flow für KI-Schreibvorschläge: Die KI erzeugt nur Vorschläge,
 * angewendet wird ausschließlich hier — nach expliziter Nutzer-Bestätigung,
 * mit erneuter zod-Validierung und über dieselben Services wie die REST-API.
 */
export function createProposalService(deps: ProposalServiceDeps) {
  async function requirePending(userId: string, id: string): Promise<AiProposalRow> {
    const row = await deps.proposalRepo.findById(userId, id);
    if (!row) throw new AppError('not_found', 'Proposal not found');
    if (row.status !== 'pending') {
      throw new AppError('conflict', `Proposal already ${row.status}`);
    }
    return row;
  }

  return {
    async create(input: {
      userId: string;
      sessionId: string | null;
      kind: ProposalKind;
      summary: string;
      payload: unknown;
    }): Promise<ProposalDto> {
      // Payload schon beim Anlegen validieren — ungültige Vorschläge sollen
      // gar nicht erst im UI landen.
      payloadSchemas[input.kind].parse(input.payload);
      const row = await deps.proposalRepo.create(input);
      return toProposalDto(row);
    },

    /**
     * Offenen Vorschlag überarbeiten statt einen neuen anzulegen — sonst
     * stapeln sich bei jedem "mach lieber 4 Sätze" neue Vorschläge.
     * Gleiche Validierung wie beim Anlegen; nur pending und nur derselbe kind.
     */
    async revise(input: {
      userId: string;
      proposalId: string;
      kind: ProposalKind;
      summary: string;
      payload: unknown;
    }): Promise<ProposalDto> {
      const row = await requirePending(input.userId, input.proposalId);
      if (row.kind !== input.kind) {
        throw new AppError(
          'bad_request',
          `Proposal ${input.proposalId} is ${row.kind}, not ${input.kind}`,
        );
      }
      payloadSchemas[input.kind].parse(input.payload);
      await deps.proposalRepo.updateContent(row.id, {
        summary: input.summary,
        payload: input.payload,
      });
      return { ...toProposalDto(row), summary: input.summary, payload: input.payload };
    },

    async listPending(userId: string): Promise<ProposalDto[]> {
      return (await deps.proposalRepo.listByStatus(userId, 'pending')).map(toProposalDto);
    },

    async confirm(userId: string, id: string): Promise<ProposalDto> {
      const row = await requirePending(userId, id);
      if (row.kind === 'update_routine') {
        const payload = routinePayloadSchema.parse(row.payload);
        await deps.routineService.update(userId, payload.routineId, payload.changes);
      } else if (row.kind === 'create_routine') {
        const payload = createRoutinePayloadSchema.parse(row.payload);
        await deps.routineService.create(userId, payload.routine);
      } else {
        const payload = profilePayloadSchema.parse(row.payload);
        await deps.profileService.update(userId, payload.changes);
      }
      await deps.proposalRepo.setStatus(row.id, 'confirmed');
      return { ...toProposalDto(row), status: 'confirmed' };
    },

    async reject(userId: string, id: string): Promise<ProposalDto> {
      const row = await requirePending(userId, id);
      await deps.proposalRepo.setStatus(row.id, 'rejected');
      return { ...toProposalDto(row), status: 'rejected' };
    },
  };
}
