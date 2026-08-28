import { describe, expect, it, vi } from 'vitest';
import { createProposalService, type ProposalServiceDeps } from '../services/proposal-service.js';
import { fakeProposalRepo } from './fakes.js';

const USER = '00000000-0000-4000-8000-000000000001';
const ROUTINE = '00000000-0000-4000-8000-00000000aaaa';

function setup() {
  const proposalRepo = fakeProposalRepo();
  const routineService = { update: vi.fn(async () => ({})) };
  const profileService = { update: vi.fn(async () => ({})) };
  const service = createProposalService({
    proposalRepo,
    routineService,
    profileService,
  } as unknown as ProposalServiceDeps);
  return { proposalRepo, routineService, profileService, service };
}

describe('proposal flow (Bestätigungs-Guard)', () => {
  it('creates a pending proposal without touching services', async () => {
    const { service, routineService, profileService } = setup();
    const proposal = await service.create({
      userId: USER,
      sessionId: null,
      kind: 'update_profile',
      summary: 'kcal-Ziel auf 2200 senken (Cut)',
      payload: { changes: { kcalTarget: 2200 } },
    });
    expect(proposal.status).toBe('pending');
    expect(routineService.update).not.toHaveBeenCalled();
    expect(profileService.update).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads at creation time', async () => {
    const { service } = setup();
    await expect(
      service.create({
        userId: USER,
        sessionId: null,
        kind: 'update_routine',
        summary: 'kaputt',
        payload: { nonsense: true },
      }),
    ).rejects.toThrow();
  });

  it('confirm applies the change via the same services as the REST API', async () => {
    const { service, routineService, profileService } = setup();
    const p1 = await service.create({
      userId: USER,
      sessionId: null,
      kind: 'update_routine',
      summary: 'Mehr Volumen fürs Bankdrücken',
      payload: { routineId: ROUTINE, changes: { name: 'Push v2' } },
    });
    const confirmed = await service.confirm(USER, p1.id);
    expect(confirmed.status).toBe('confirmed');
    expect(routineService.update).toHaveBeenCalledWith(USER, ROUTINE, { name: 'Push v2' });

    const p2 = await service.create({
      userId: USER,
      sessionId: null,
      kind: 'update_profile',
      summary: 'Protein hoch',
      payload: { changes: { proteinTargetG: 170 } },
    });
    await service.confirm(USER, p2.id);
    expect(profileService.update).toHaveBeenCalledWith(USER, { proteinTargetG: 170 });
  });

  it('cannot confirm twice, reject leaves services untouched', async () => {
    const { service, profileService } = setup();
    const p = await service.create({
      userId: USER,
      sessionId: null,
      kind: 'update_profile',
      summary: 'Test',
      payload: { changes: { kcalTarget: 2000 } },
    });
    await service.confirm(USER, p.id);
    await expect(service.confirm(USER, p.id)).rejects.toMatchObject({ code: 'conflict' });

    const p2 = await service.create({
      userId: USER,
      sessionId: null,
      kind: 'update_profile',
      summary: 'Test 2',
      payload: { changes: { kcalTarget: 1900 } },
    });
    const rejected = await service.reject(USER, p2.id);
    expect(rejected.status).toBe('rejected');
    expect(profileService.update).toHaveBeenCalledTimes(1);
    expect(await service.listPending(USER)).toHaveLength(0);
  });

  it('scopes proposals to the owning user', async () => {
    const { service } = setup();
    const p = await service.create({
      userId: USER,
      sessionId: null,
      kind: 'update_profile',
      summary: 'Test',
      payload: { changes: { kcalTarget: 2000 } },
    });
    await expect(service.confirm('00000000-0000-4000-8000-000000000002', p.id)).rejects.toMatchObject(
      { code: 'not_found' },
    );
  });
});
