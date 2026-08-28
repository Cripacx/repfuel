import { z } from 'zod';
import type { ProposalDto } from '@repfuel/shared';
import { updateProfileRequestSchema, updateRoutineRequestSchema } from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { ProfileService } from '../../auth/index.js';
import type { RoutineService } from '../../workout/index.js';
import type { ProposalRepo } from '../repositories/proposal-repo.js';
import type { AiProposalRow } from '../schema.js';

const routinePayloadSchema = z.object({
  routineId: z.string().uuid(),
  changes: updateRoutineRequestSchema,
});
const profilePayloadSchema = z.object({ changes: updateProfileRequestSchema });

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
      kind: 'update_routine' | 'update_profile';
      summary: string;
      payload: unknown;
    }): Promise<ProposalDto> {
      // Payload schon beim Anlegen validieren — ungültige Vorschläge sollen
      // gar nicht erst im UI landen.
      if (input.kind === 'update_routine') routinePayloadSchema.parse(input.payload);
      else profilePayloadSchema.parse(input.payload);
      const row = await deps.proposalRepo.create(input);
      return toProposalDto(row);
    },

    async listPending(userId: string): Promise<ProposalDto[]> {
      return (await deps.proposalRepo.listByStatus(userId, 'pending')).map(toProposalDto);
    },

    async confirm(userId: string, id: string): Promise<ProposalDto> {
      const row = await requirePending(userId, id);
      if (row.kind === 'update_routine') {
        const payload = routinePayloadSchema.parse(row.payload);
        await deps.routineService.update(userId, payload.routineId, payload.changes);
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
