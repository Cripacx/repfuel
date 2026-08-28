import { randomBytes } from 'node:crypto';
import type {
  AdminInviteDto,
  AdminSettingsDto,
  AdminUserDto,
  InstanceStatusDto,
  Locale,
  RegistrationMode,
  SessionUser,
} from '@repfuel/shared';
import { REGISTRATION_MODES } from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { InviteRepo } from '../repositories/invite-repo.js';
import type { SettingsRepo } from '../repositories/settings-repo.js';
import type { UserRepo } from '../repositories/user-repo.js';
import type { InviteRow, UserRow } from '../schema.js';

const REGISTRATION_MODE_KEY = 'registration_mode';

export interface UserServiceDeps {
  userRepo: UserRepo;
  inviteRepo: InviteRepo;
  settingsRepo: SettingsRepo;
  configuredMode: RegistrationMode;
  appVersion: string;
}

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    locale: row.locale ?? null,
    hasPassword: row.passwordHash != null,
  };
}

export function toAdminUserDto(row: UserRow): AdminUserDto {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    disabledAt: row.disabledAt ? row.disabledAt.toISOString() : null,
  };
}

export function toInviteDto(row: InviteRow): AdminInviteDto {
  return {
    id: row.id,
    token: row.token,
    username: row.username,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    usedBy: row.usedBy,
    usedAt: row.usedAt ? row.usedAt.toISOString() : null,
  };
}

export type UserService = ReturnType<typeof createUserService>;

export function createUserService(deps: UserServiceDeps) {
  const { userRepo, inviteRepo, settingsRepo, configuredMode, appVersion } = deps;

  async function getEffectiveMode(): Promise<RegistrationMode> {
    const override = await settingsRepo.get(REGISTRATION_MODE_KEY);
    if (typeof override === 'string' && (REGISTRATION_MODES as readonly string[]).includes(override)) {
      return override as RegistrationMode;
    }
    return configuredMode;
  }

  /** Gültiges, unbenutztes, nicht abgelaufenes Invite — sonst AppError. */
  async function validateInvite(token: string, now: Date = new Date()): Promise<InviteRow> {
    const invite = await inviteRepo.findByToken(token);
    if (!invite || invite.revokedAt || invite.usedAt || invite.expiresAt.getTime() < now.getTime()) {
      throw new AppError('invalid_invite', 'Invite is invalid, expired or already used');
    }
    return invite;
  }

  return {
    async getRegistrationState() {
      const userCount = await userRepo.countActive();
      return { mode: await getEffectiveMode(), bootstrap: userCount === 0 };
    },

    /**
     * Prüft, ob eine Registrierung mit diesem Username/Invite zulässig ist.
     * Bootstrap (noch kein Nutzer) ist immer offen; danach gilt der Modus.
     * Gibt das validierte Invite zurück (falls verwendet).
     */
    async checkRegistrationAllowed(username: string, inviteToken?: string) {
      const { mode, bootstrap } = await this.getRegistrationState();
      let invite: InviteRow | null = null;
      if (!bootstrap && mode === 'invite') {
        if (!inviteToken) {
          throw new AppError('registration_closed', 'Registration requires an invite');
        }
        invite = await validateInvite(inviteToken);
        if (invite.username && invite.username !== username) {
          throw new AppError('invalid_invite', 'Invite is bound to a different username');
        }
      } else if (inviteToken) {
        // Invite auch im open-Modus einlösbar (Username-Bindung prüfen).
        invite = await validateInvite(inviteToken);
        if (invite.username && invite.username !== username) {
          throw new AppError('invalid_invite', 'Invite is bound to a different username');
        }
      }
      const existing = await userRepo.findByUsername(username);
      if (existing) throw new AppError('conflict', 'Username is already taken');
      return { bootstrap, invite };
    },

    /** Legt den Nutzer nach erfolgreicher WebAuthn-Verifikation an (Bootstrap → admin). */
    async finalizeRegistration(username: string, inviteToken?: string): Promise<UserRow> {
      const { bootstrap, invite } = await this.checkRegistrationAllowed(username, inviteToken);
      const user = await userRepo.create({ username, role: bootstrap ? 'admin' : 'user' });
      if (invite) await inviteRepo.markUsed(invite.id, user.id);
      return user;
    },

    async getActiveUser(userId: string): Promise<UserRow | null> {
      const user = await userRepo.findById(userId);
      if (!user || user.disabledAt) return null;
      return user;
    },

    async setPasswordHash(userId: string, hash: string): Promise<void> {
      const row = await userRepo.setPasswordHash(userId, hash);
      if (!row) throw new AppError('not_found', 'User not found');
    },

    async getActiveUserByUsername(username: string): Promise<UserRow | null> {
      const user = await userRepo.findByUsername(username);
      if (!user || user.disabledAt) return null;
      return user;
    },

    async updateLocale(userId: string, locale: Locale | null): Promise<SessionUser> {
      const row = await userRepo.updateLocale(userId, locale);
      if (!row) throw new AppError('not_found', 'User not found');
      return toSessionUser(row);
    },

    // --- Verwaltung (vom Admin-Modul über die öffentliche Schnittstelle genutzt) ---

    async listUsers(): Promise<AdminUserDto[]> {
      return (await userRepo.list()).map(toAdminUserDto);
    },

    async setUserDisabled(actorId: string, userId: string, disabled: boolean): Promise<AdminUserDto> {
      if (actorId === userId) {
        throw new AppError('bad_request', 'You cannot disable your own account');
      }
      const row = await userRepo.setDisabled(userId, disabled);
      if (!row) throw new AppError('not_found', 'User not found');
      return toAdminUserDto(row);
    },

    async deleteUser(actorId: string, userId: string): Promise<void> {
      if (actorId === userId) {
        throw new AppError('bad_request', 'You cannot delete your own account');
      }
      const row = await userRepo.softDelete(userId);
      if (!row) throw new AppError('not_found', 'User not found');
    },

    async createInvite(input: {
      createdBy: string;
      username?: string;
      expiresInHours: number;
    }): Promise<AdminInviteDto> {
      if (input.username) {
        const existing = await userRepo.findByUsername(input.username);
        if (existing) throw new AppError('conflict', 'Username is already taken');
      }
      const invite = await inviteRepo.create({
        token: randomBytes(24).toString('base64url'),
        username: input.username ?? null,
        createdBy: input.createdBy,
        expiresAt: new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000),
      });
      return toInviteDto(invite);
    },

    async listInvites(): Promise<AdminInviteDto[]> {
      const rows = await inviteRepo.list();
      return rows.filter((r) => !r.revokedAt).map(toInviteDto);
    },

    async revokeInvite(id: string): Promise<void> {
      const row = await inviteRepo.revoke(id);
      if (!row) throw new AppError('not_found', 'Invite not found');
    },

    async getSettings(): Promise<AdminSettingsDto> {
      return { registrationMode: await getEffectiveMode(), configuredMode };
    },

    async updateSettings(input: { registrationMode?: RegistrationMode }): Promise<AdminSettingsDto> {
      if (input.registrationMode) {
        await settingsRepo.set(REGISTRATION_MODE_KEY, input.registrationMode);
      }
      return this.getSettings();
    },

    async getInstanceStatus(): Promise<InstanceStatusDto> {
      return {
        version: appVersion,
        registrationMode: await getEffectiveMode(),
        userCount: await userRepo.countActive(),
      };
    },
  };
}
