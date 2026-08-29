import { describe, expect, it, vi } from 'vitest';
import { createProposalService, type ProposalServiceDeps } from '../services/proposal-service.js';
import { fakeProposalRepo } from './fakes.js';

const USER = '00000000-0000-4000-8000-000000000001';
const ROUTINE = '00000000-0000-4000-8000-00000000aaaa';

function setup() {
  const proposalRepo = fakeProposalRepo();
  const routineService = { update: vi.fn(async () => ({})), create: vi.fn(async () => ({})) };
  const profileService = { update: vi.fn(async () => ({})) };
  const exerciseService = {
    byIds: vi.fn(async (_userId: string, ids: string[]) =>
      ids
        .filter((id) => !id.endsWith('9999'))
        .map((id) => ({ id, name: 'Replacement Exercise', nameDe: null })),
    ),
  };
  const service = createProposalService({
    proposalRepo,
    routineService,
    profileService,
    exerciseService,
  } as unknown as ProposalServiceDeps);
  return { proposalRepo, routineService, profileService, exerciseService, service };
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

  it('create_routine: confirm legt die Routine über den Routine-Service an', async () => {
    const { service, routineService } = setup();
    const routine = {
      name: 'Ganzkörper A',
      weekday: 1,
      items: [
        {
          exerciseId: '00000000-0000-4000-8000-00000000bbbb',
          position: 0,
          targetSets: 3,
          targetReps: 8,
        },
      ],
    };
    const p = await service.create({
      userId: USER,
      sessionId: null,
      kind: 'create_routine',
      summary: '2x/Woche Ganzkörper für den Cut',
      payload: { routine },
    });
    expect(routineService.create).not.toHaveBeenCalled();
    const confirmed = await service.confirm(USER, p.id);
    expect(confirmed.status).toBe('confirmed');
    expect(routineService.create).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ name: 'Ganzkörper A' }),
    );

    await expect(
      service.create({
        userId: USER,
        sessionId: null,
        kind: 'create_routine',
        summary: 'kaputt',
        payload: { routine: { items: [] } },
      }),
    ).rejects.toThrow();
  });

  it('revise ersetzt Inhalt eines offenen Vorschlags statt einen neuen anzulegen', async () => {
    const { service, proposalRepo, routineService } = setup();
    const item = (reps: number) => ({
      exerciseId: '00000000-0000-4000-8000-00000000bbbb',
      position: 0,
      targetSets: 3,
      targetReps: reps,
    });
    const p = await service.create({
      userId: USER,
      sessionId: null,
      kind: 'create_routine',
      summary: 'Erster Entwurf',
      payload: { routine: { name: 'GK A', items: [item(8)] } },
    });

    const revised = await service.revise({
      userId: USER,
      proposalId: p.id,
      kind: 'create_routine',
      summary: 'Jetzt mit 12 Wiederholungen',
      payload: { routine: { name: 'GK A', items: [item(12)] } },
    });
    expect(revised.id).toBe(p.id);
    expect(revised.status).toBe('pending');
    // Kein zweiter Vorschlag entstanden
    expect(proposalRepo.rows).toHaveLength(1);
    expect(await service.listPending(USER)).toHaveLength(1);

    // Bestätigen wendet den ÜBERARBEITETEN Stand an
    await service.confirm(USER, p.id);
    expect(routineService.create).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ items: [expect.objectContaining({ targetReps: 12 })] }),
    );
  });

  it('revise prüft kind, Status und Ownership und validiert den Payload', async () => {
    const { service } = setup();
    const p = await service.create({
      userId: USER,
      sessionId: null,
      kind: 'update_profile',
      summary: 'kcal runter',
      payload: { changes: { kcalTarget: 2200 } },
    });

    await expect(
      service.revise({
        userId: USER,
        proposalId: p.id,
        kind: 'create_routine',
        summary: 'falscher kind',
        payload: { routine: { name: 'x', items: [] } },
      }),
    ).rejects.toMatchObject({ code: 'bad_request' });

    await expect(
      service.revise({
        userId: USER,
        proposalId: p.id,
        kind: 'update_profile',
        summary: 'kaputt',
        payload: { nonsense: true },
      }),
    ).rejects.toThrow();

    await expect(
      service.revise({
        userId: '00000000-0000-4000-8000-000000000002',
        proposalId: p.id,
        kind: 'update_profile',
        summary: 'fremd',
        payload: { changes: { kcalTarget: 2000 } },
      }),
    ).rejects.toMatchObject({ code: 'not_found' });

    await service.confirm(USER, p.id);
    await expect(
      service.revise({
        userId: USER,
        proposalId: p.id,
        kind: 'update_profile',
        summary: 'zu spät',
        payload: { changes: { kcalTarget: 2100 } },
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
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

  it('swapExercise tauscht die Übung, behält Sätze/Reps und bleibt pending', async () => {
    const { service, routineService } = setup();
    const FROM = '00000000-0000-4000-8000-00000000bbbb';
    const TO = '00000000-0000-4000-8000-00000000eeee';
    const p = await service.create({
      userId: USER,
      sessionId: null,
      kind: 'create_routine',
      summary: 'Push-Tag',
      payload: {
        routine: {
          name: 'Push',
          items: [{ exerciseId: FROM, position: 0, targetSets: 4, targetReps: 8 }],
        },
        exerciseNames: { [FROM]: 'Bankdrücken' },
      },
    });

    const swapped = await service.swapExercise({
      userId: USER,
      proposalId: p.id,
      fromExerciseId: FROM,
      toExerciseId: TO,
    });
    expect(swapped.status).toBe('pending');
    const payload = swapped.payload as {
      routine: { items: { exerciseId: string; targetSets: number; targetReps: number }[] };
      exerciseNames: Record<string, string>;
    };
    expect(payload.routine.items).toEqual([
      { exerciseId: TO, position: 0, targetSets: 4, targetReps: 8 },
    ]);
    expect(payload.exerciseNames).toEqual({ [TO]: 'Replacement Exercise' });

    await service.confirm(USER, p.id);
    expect(routineService.create).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({
        items: [expect.objectContaining({ exerciseId: TO })],
      }),
    );
  });

  it('swapExercise lehnt Profil-Vorschläge, fremde Übungen und unbekannte Ersatz-IDs ab', async () => {
    const { service } = setup();
    const FROM = '00000000-0000-4000-8000-00000000bbbb';
    const routineProposal = await service.create({
      userId: USER,
      sessionId: null,
      kind: 'create_routine',
      summary: 'Push-Tag',
      payload: {
        routine: { name: 'Push', items: [{ exerciseId: FROM, position: 0, targetSets: 3, targetReps: 10 }] },
      },
    });
    // Ersatz-Übung existiert nicht (Fake filtert IDs mit Suffix 9999)
    await expect(
      service.swapExercise({
        userId: USER,
        proposalId: routineProposal.id,
        fromExerciseId: FROM,
        toExerciseId: '00000000-0000-4000-8000-000000009999',
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
    // from-Übung ist nicht Teil des Vorschlags
    await expect(
      service.swapExercise({
        userId: USER,
        proposalId: routineProposal.id,
        fromExerciseId: '00000000-0000-4000-8000-00000000eeee',
        toExerciseId: '00000000-0000-4000-8000-00000000ffff',
      }),
    ).rejects.toMatchObject({ code: 'not_found' });

    const profileProposal = await service.create({
      userId: USER,
      sessionId: null,
      kind: 'update_profile',
      summary: 'kcal',
      payload: { changes: { kcalTarget: 2000 } },
    });
    await expect(
      service.swapExercise({
        userId: USER,
        proposalId: profileProposal.id,
        fromExerciseId: FROM,
        toExerciseId: '00000000-0000-4000-8000-00000000ffff',
      }),
    ).rejects.toMatchObject({ code: 'bad_request' });
  });

  it('listPending filtert auf das Gespräch; Löschen des Gesprächs verwirft Offenes', async () => {
    const { service } = setup();
    const SESSION_A = '00000000-0000-4000-8000-00000000cccc';
    const SESSION_B = '00000000-0000-4000-8000-00000000dddd';
    const make = (sessionId: string, summary: string) =>
      service.create({
        userId: USER,
        sessionId,
        kind: 'update_profile',
        summary,
        payload: { changes: { kcalTarget: 2000 } },
      });
    await make(SESSION_A, 'aus Gespräch A');
    await make(SESSION_B, 'aus Gespräch B');

    expect(await service.listPending(USER)).toHaveLength(2);
    const forA = await service.listPending(USER, SESSION_A);
    expect(forA).toHaveLength(1);
    expect(forA[0]?.summary).toBe('aus Gespräch A');

    expect(await service.rejectAllForSession(USER, SESSION_A)).toBe(1);
    expect(await service.listPending(USER, SESSION_A)).toHaveLength(0);
    expect(await service.listPending(USER, SESSION_B)).toHaveLength(1);
    expect(await service.rejectAllForSession(USER, SESSION_A)).toBe(0);
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
