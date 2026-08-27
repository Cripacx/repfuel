import { z } from 'zod';
import { REGISTRATION_MODES } from '../types.js';
import { usernameSchema, uuidSchema } from './common.js';

export const createInviteRequestSchema = z.object({
  username: usernameSchema.optional(),
  expiresInHours: z.number().int().min(1).max(24 * 90).default(72),
});
export type CreateInviteRequest = z.infer<typeof createInviteRequestSchema>;

export const updateUserRequestSchema = z
  .object({
    disabled: z.boolean().optional(),
  })
  .refine((v) => v.disabled !== undefined, { message: 'no fields to update' });
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

export const updateSettingsRequestSchema = z
  .object({
    registrationMode: z.enum(REGISTRATION_MODES).optional(),
  })
  .refine((v) => v.registrationMode !== undefined, { message: 'no fields to update' });
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;

export const userIdParamsSchema = z.object({ id: uuidSchema });
export const inviteIdParamsSchema = z.object({ id: uuidSchema });
