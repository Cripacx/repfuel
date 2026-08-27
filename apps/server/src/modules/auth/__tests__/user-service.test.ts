import { describe, expect, it } from 'vitest';
import { AppError } from '../../../core/errors.js';
import { createUserService } from '../services/user-service.js';
import { fakeInviteRepo, fakeSettingsRepo, fakeUserRepo } from './fakes.js';

function setup(configuredMode: 'open' | 'invite' = 'open') {
  const userRepo = fakeUserRepo();
  const inviteRepo = fakeInviteRepo();
  const settingsRepo = fakeSettingsRepo();
  const service = createUserService({
    userRepo,
    inviteRepo,
    settingsRepo,
    configuredMode,
    appVersion: '0.0.0-test',
  });
  return { userRepo, inviteRepo, settingsRepo, service };
}

describe('registration state', () => {
  it('reports bootstrap=true while no user exists', async () => {
    const { service } = setup('invite');
    expect(await service.getRegistrationState()).toEqual({ mode: 'invite', bootstrap: true });
  });

  it('db override wins over configured mode', async () => {
    const { service, settingsRepo } = setup('open');
    await settingsRepo.set('registration_mode', 'invite');
    expect((await service.getRegistrationState()).mode).toBe('invite');
  });

  it('ignores invalid override values', async () => {
    const { service, settingsRepo } = setup('open');
    await settingsRepo.set('registration_mode', 'nonsense');
    expect((await service.getRegistrationState()).mode).toBe('open');
  });
});

describe('finalizeRegistration', () => {
  it('makes the first user admin, later users regular', async () => {
    const { service } = setup('open');
    const first = await service.finalizeRegistration('alice');
    const second = await service.finalizeRegistration('bob');
    expect(first.role).toBe('admin');
    expect(second.role).toBe('user');
  });

  it('rejects duplicate usernames', async () => {
    const { service } = setup('open');
    await service.finalizeRegistration('alice');
    await expect(service.finalizeRegistration('alice')).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('allows bootstrap registration even in invite mode', async () => {
    const { service } = setup('invite');
    const user = await service.finalizeRegistration('alice');
    expect(user.role).toBe('admin');
  });

  it('requires an invite in invite mode after bootstrap', async () => {
    const { service } = setup('invite');
    await service.finalizeRegistration('admin1');
    await expect(service.finalizeRegistration('bob')).rejects.toMatchObject({
      code: 'registration_closed',
    });
  });

  it('accepts a valid invite and marks it used', async () => {
    const { service, inviteRepo } = setup('invite');
    const admin = await service.finalizeRegistration('admin1');
    const invite = await service.createInvite({ createdBy: admin.id, expiresInHours: 1 });
    const user = await service.finalizeRegistration('bob', invite.token);
    expect(user.role).toBe('user');
    expect(inviteRepo.rows[0]?.usedBy).toBe(user.id);
    // Zweitverwendung schlägt fehl
    await expect(service.finalizeRegistration('carol', invite.token)).rejects.toMatchObject({
      code: 'invalid_invite',
    });
  });

  it('rejects expired and revoked invites', async () => {
    const { service, inviteRepo } = setup('invite');
    const admin = await service.finalizeRegistration('admin1');
    const expired = await inviteRepo.create({
      token: 'expired-token',
      username: null,
      createdBy: admin.id,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.finalizeRegistration('bob', expired.token)).rejects.toMatchObject({
      code: 'invalid_invite',
    });
    const invite = await service.createInvite({ createdBy: admin.id, expiresInHours: 1 });
    await service.revokeInvite(invite.id);
    await expect(service.finalizeRegistration('bob', invite.token)).rejects.toMatchObject({
      code: 'invalid_invite',
    });
  });

  it('enforces the username bound to an invite', async () => {
    const { service } = setup('invite');
    const admin = await service.finalizeRegistration('admin1');
    const invite = await service.createInvite({
      createdBy: admin.id,
      username: 'bob',
      expiresInHours: 1,
    });
    await expect(service.finalizeRegistration('mallory', invite.token)).rejects.toMatchObject({
      code: 'invalid_invite',
    });
    const user = await service.finalizeRegistration('bob', invite.token);
    expect(user.username).toBe('bob');
  });
});

describe('admin user management', () => {
  it('disables and re-enables users', async () => {
    const { service } = setup();
    const admin = await service.finalizeRegistration('admin1');
    const bob = await service.finalizeRegistration('bob');
    const disabled = await service.setUserDisabled(admin.id, bob.id, true);
    expect(disabled.disabledAt).not.toBeNull();
    expect(await service.getActiveUser(bob.id)).toBeNull();
    const enabled = await service.setUserDisabled(admin.id, bob.id, false);
    expect(enabled.disabledAt).toBeNull();
  });

  it('forbids disabling or deleting yourself', async () => {
    const { service } = setup();
    const admin = await service.finalizeRegistration('admin1');
    await expect(service.setUserDisabled(admin.id, admin.id, true)).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(service.deleteUser(admin.id, admin.id)).rejects.toBeInstanceOf(AppError);
  });

  it('soft-deletes users', async () => {
    const { service, userRepo } = setup();
    const admin = await service.finalizeRegistration('admin1');
    const bob = await service.finalizeRegistration('bob');
    await service.deleteUser(admin.id, bob.id);
    expect(await service.getActiveUser(bob.id)).toBeNull();
    expect(userRepo.rows.find((r) => r.id === bob.id)?.deletedAt).not.toBeNull();
  });

  it('rejects invites for taken usernames', async () => {
    const { service } = setup();
    const admin = await service.finalizeRegistration('admin1');
    await expect(
      service.createInvite({ createdBy: admin.id, username: 'admin1', expiresInHours: 1 }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('settings & status', () => {
  it('updates the registration mode override', async () => {
    const { service } = setup('open');
    const settings = await service.updateSettings({ registrationMode: 'invite' });
    expect(settings).toEqual({ registrationMode: 'invite', configuredMode: 'open' });
  });

  it('reports instance status', async () => {
    const { service } = setup('open');
    await service.finalizeRegistration('alice');
    const status = await service.getInstanceStatus();
    expect(status.userCount).toBe(1);
    expect(status.version).toBe('0.0.0-test');
  });
});
