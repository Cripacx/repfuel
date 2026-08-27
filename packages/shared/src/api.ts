import type { RegistrationMode, SessionUser, UserRole } from './types.js';

/** Response-DTOs der REST-API (`/api/v1`). */

export interface MeResponse {
  user: SessionUser;
}

export interface RegistrationModeResponse {
  mode: RegistrationMode;
  /** true, solange noch kein Nutzer existiert (Erstlauf → erster Nutzer wird Admin). */
  bootstrap: boolean;
}

export interface AdminUserDto {
  id: string;
  username: string;
  role: UserRole;
  createdAt: string;
  disabledAt: string | null;
}

export interface AdminInviteDto {
  id: string;
  token: string;
  username: string | null;
  createdAt: string;
  expiresAt: string;
  usedBy: string | null;
  usedAt: string | null;
}

export interface AdminSettingsDto {
  registrationMode: RegistrationMode;
  /** Modus aus der Umgebungskonfiguration; DB-Override hat Vorrang. */
  configuredMode: RegistrationMode;
}

export interface InstanceStatusDto {
  version: string;
  registrationMode: RegistrationMode;
  userCount: number;
}

export interface ApiErrorBody {
  error: string;
  message: string;
}
