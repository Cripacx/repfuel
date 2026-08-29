import { z } from 'zod';
import { usernameSchema } from './common.js';

/**
 * WebAuthn-Antworten des Browsers (Struktur laut WebAuthn JSON-Serialisierung).
 * Die kryptographische Verifikation übernimmt SimpleWebAuthn serverseitig;
 * die Schemas validieren die äußere Struktur an der API-Grenze.
 */
const authenticatorAttachmentSchema = z.enum(['platform', 'cross-platform']).optional();

export const registrationResponseSchema = z
  .object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    type: z.literal('public-key'),
    authenticatorAttachment: authenticatorAttachmentSchema,
    clientExtensionResults: z.record(z.unknown()).default({}),
    response: z
      .object({
        clientDataJSON: z.string().min(1),
        attestationObject: z.string().min(1),
        transports: z.array(z.string()).optional(),
        publicKeyAlgorithm: z.number().optional(),
        publicKey: z.string().optional(),
        authenticatorData: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();
export type RegistrationResponseInput = z.infer<typeof registrationResponseSchema>;

export const authenticationResponseSchema = z
  .object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    type: z.literal('public-key'),
    authenticatorAttachment: authenticatorAttachmentSchema,
    clientExtensionResults: z.record(z.unknown()).default({}),
    response: z
      .object({
        clientDataJSON: z.string().min(1),
        authenticatorData: z.string().min(1),
        signature: z.string().min(1),
        userHandle: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();
export type AuthenticationResponseInput = z.infer<typeof authenticationResponseSchema>;

export const registerOptionsRequestSchema = z.object({
  username: usernameSchema,
  inviteToken: z.string().min(1).max(128).optional(),
});
export type RegisterOptionsRequest = z.infer<typeof registerOptionsRequestSchema>;

export const registerVerifyRequestSchema = z.object({
  flowId: z.string().min(1).max(128),
  response: registrationResponseSchema,
});
export type RegisterVerifyRequest = z.infer<typeof registerVerifyRequestSchema>;

export const loginOptionsRequestSchema = z.object({
  username: usernameSchema.optional(),
});
export type LoginOptionsRequest = z.infer<typeof loginOptionsRequestSchema>;

export const passwordSchema = z.string().min(8).max(128);

export const passwordRegisterRequestSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  inviteToken: z.string().min(1).max(128).optional(),
});
export type PasswordRegisterRequest = z.infer<typeof passwordRegisterRequestSchema>;

export const passwordLoginRequestSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(128),
});
export type PasswordLoginRequest = z.infer<typeof passwordLoginRequestSchema>;

export const setPasswordRequestSchema = z.object({
  password: passwordSchema,
});
export type SetPasswordRequest = z.infer<typeof setPasswordRequestSchema>;

export const updateMeRequestSchema = z.object({
  locale: z.enum(['de', 'en']).nullable(),
});
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>;

export const loginVerifyRequestSchema = z.object({
  flowId: z.string().min(1).max(128),
  response: authenticationResponseSchema,
});
export type LoginVerifyRequest = z.infer<typeof loginVerifyRequestSchema>;
