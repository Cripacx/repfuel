import type { NutritionTargets, ProfileDto, UpdateProfileRequest } from '@repfuel/shared';
import type { ProfileRepo } from '../repositories/profile-repo.js';
import type { ProfileRow } from '../schema.js';

const EMPTY_PROFILE: ProfileDto = {
  heightCm: null,
  birthYear: null,
  sex: null,
  activityLevel: null,
  goal: null,
  kcalTarget: null,
  proteinTargetG: null,
  carbsTargetG: null,
  fatTargetG: null,
};

function toDto(row: ProfileRow | null): ProfileDto {
  if (!row) return { ...EMPTY_PROFILE };
  return {
    heightCm: row.heightCm,
    birthYear: row.birthYear,
    sex: row.sex,
    activityLevel: row.activityLevel,
    goal: row.goal,
    kcalTarget: row.kcalTarget,
    proteinTargetG: row.proteinTargetG,
    carbsTargetG: row.carbsTargetG,
    fatTargetG: row.fatTargetG,
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;

export function createProfileService(profileRepo: ProfileRepo) {
  return {
    async get(userId: string): Promise<ProfileDto> {
      return toDto(await profileRepo.find(userId));
    },

    async update(userId: string, input: UpdateProfileRequest): Promise<ProfileDto> {
      const patch = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined),
      );
      return toDto(await profileRepo.upsert(userId, patch));
    },

    /** kcal-/Makro-Ziele für andere Module (z.B. Ernährungs-Dashboard). */
    async getTargets(userId: string): Promise<NutritionTargets> {
      const row = await profileRepo.find(userId);
      return {
        kcalTarget: row?.kcalTarget ?? null,
        proteinTargetG: row?.proteinTargetG ?? null,
        carbsTargetG: row?.carbsTargetG ?? null,
        fatTargetG: row?.fatTargetG ?? null,
      };
    },
  };
}
