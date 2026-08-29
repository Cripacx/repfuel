export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const REGISTRATION_MODES = ['open', 'invite'] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

export interface SessionUser {
  id: string;
  username: string;
  role: UserRole;
  locale: Locale | null;
  /** true, wenn das Konto ein Passwort gesetzt hat (zusätzlich zu Passkeys). */
  hasPassword: boolean;
}
