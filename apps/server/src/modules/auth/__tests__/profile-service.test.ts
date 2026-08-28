import { describe, expect, it } from 'vitest';
import type { ProfilePatch, ProfileRepo } from '../repositories/profile-repo.js';
import type { ProfileRow } from '../schema.js';
import { createProfileService } from '../services/profile-service.js';

const USER = '00000000-0000-4000-8000-000000000001';

function fakeProfileRepo(): ProfileRepo & { rows: Map<string, ProfileRow> } {
  const rows = new Map<string, ProfileRow>();
  const empty = (userId: string): ProfileRow => ({
    userId,
    heightCm: null,
    birthYear: null,
    sex: null,
    activityLevel: null,
    goal: null,
    kcalTarget: null,
    proteinTargetG: null,
    carbsTargetG: null,
    fatTargetG: null,
    updatedAt: new Date(),
  });
  return {
    rows,
    async find(userId) {
      return rows.get(userId) ?? null;
    },
    async upsert(userId, patch: ProfilePatch) {
      const row = { ...(rows.get(userId) ?? empty(userId)), ...patch, updatedAt: new Date() };
      rows.set(userId, row);
      return row;
    },
  };
}

describe('profile service', () => {
  it('returns an empty profile before anything is stored', async () => {
    const service = createProfileService(fakeProfileRepo());
    const profile = await service.get(USER);
    expect(profile.heightCm).toBeNull();
    expect(profile.kcalTarget).toBeNull();
  });

  it('merges partial updates and keeps existing values', async () => {
    const service = createProfileService(fakeProfileRepo());
    await service.update(USER, { heightCm: 180, sex: 'male' });
    const updated = await service.update(USER, { kcalTarget: 2600 });
    expect(updated.heightCm).toBe(180);
    expect(updated.kcalTarget).toBe(2600);
  });

  it('allows clearing values with null', async () => {
    const service = createProfileService(fakeProfileRepo());
    await service.update(USER, { kcalTarget: 2600 });
    const cleared = await service.update(USER, { kcalTarget: null });
    expect(cleared.kcalTarget).toBeNull();
  });

  it('exposes targets for other modules', async () => {
    const service = createProfileService(fakeProfileRepo());
    await service.update(USER, { kcalTarget: 2600, proteinTargetG: 170 });
    expect(await service.getTargets(USER)).toEqual({
      kcalTarget: 2600,
      proteinTargetG: 170,
      carbsTargetG: null,
      fatTargetG: null,
    });
  });
});
