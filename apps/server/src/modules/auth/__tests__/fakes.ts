import { randomUUID } from 'node:crypto';
import type { Locale, UserRole } from '@repfuel/shared';
import type { CredentialRepo } from '../repositories/credential-repo.js';
import type { InviteRepo } from '../repositories/invite-repo.js';
import type { SettingsRepo } from '../repositories/settings-repo.js';
import type { UserRepo } from '../repositories/user-repo.js';
import type { CredentialRow, InviteRow, UserRow } from '../schema.js';

export { fakeKv } from '../../../core/testing/fake-kv.js';

export function fakeUserRepo(): UserRepo & { rows: UserRow[] } {
  const rows: UserRow[] = [];
  const active = () => rows.filter((r) => !r.deletedAt);
  return {
    rows,
    async findById(id) {
      return active().find((r) => r.id === id) ?? null;
    },
    async findByUsername(username) {
      return active().find((r) => r.username === username) ?? null;
    },
    async countActive() {
      return active().length;
    },
    async list() {
      return active();
    },
    async create(input: { username: string; role: UserRole }) {
      const row: UserRow = {
        id: randomUUID(),
        username: input.username,
        role: input.role,
        locale: null,
        passwordHash: null,
        createdAt: new Date(),
        disabledAt: null,
        deletedAt: null,
      };
      rows.push(row);
      return row;
    },
    async setPasswordHash(id, passwordHash) {
      const row = active().find((r) => r.id === id) ?? null;
      if (row) row.passwordHash = passwordHash;
      return row;
    },
    async updateLocale(id, locale: Locale | null) {
      const row = active().find((r) => r.id === id) ?? null;
      if (row) row.locale = locale;
      return row;
    },
    async setDisabled(id, disabled) {
      const row = active().find((r) => r.id === id) ?? null;
      if (row) row.disabledAt = disabled ? new Date() : null;
      return row;
    },
    async softDelete(id) {
      const row = active().find((r) => r.id === id) ?? null;
      if (row) row.deletedAt = new Date();
      return row;
    },
  };
}

export function fakeCredentialRepo(): CredentialRepo & { rows: CredentialRow[] } {
  const rows: CredentialRow[] = [];
  return {
    rows,
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async listByUserId(userId) {
      return rows.filter((r) => r.userId === userId);
    },
    async create(input) {
      const row: CredentialRow = {
        id: input.id,
        userId: input.userId,
        publicKey: input.publicKey,
        counter: input.counter,
        transports: input.transports,
        createdAt: new Date(),
      };
      rows.push(row);
      return row;
    },
    async updateCounter(id, counter) {
      const row = rows.find((r) => r.id === id);
      if (row) row.counter = counter;
    },
  };
}

export function fakeInviteRepo(): InviteRepo & { rows: InviteRow[] } {
  const rows: InviteRow[] = [];
  return {
    rows,
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async findByToken(token) {
      return rows.find((r) => r.token === token) ?? null;
    },
    async list() {
      return [...rows];
    },
    async create(input) {
      const row: InviteRow = {
        id: randomUUID(),
        token: input.token,
        username: input.username,
        createdBy: input.createdBy,
        createdAt: new Date(),
        expiresAt: input.expiresAt,
        usedBy: null,
        usedAt: null,
        revokedAt: null,
      };
      rows.push(row);
      return row;
    },
    async markUsed(id, usedBy) {
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.usedBy = usedBy;
        row.usedAt = new Date();
      }
    },
    async revoke(id) {
      const row = rows.find((r) => r.id === id) ?? null;
      if (row) row.revokedAt = new Date();
      return row;
    },
  };
}

export function fakeSettingsRepo(): SettingsRepo & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    async get(key) {
      return data.get(key) ?? null;
    },
    async set(key, value) {
      data.set(key, value);
    },
  };
}
