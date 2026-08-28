import { describe, expect, it } from 'vitest';
import { createInProcessEventBus } from '../../../core/event-bus.js';
import { fakeKv } from '../../../core/testing/fake-kv.js';
import { hashPassword, verifyPassword } from '../services/password-service.js';
import { createAuthService } from '../services/auth-service.js';
import { createSessionService } from '../services/session-service.js';
import { createUserService } from '../services/user-service.js';
import { fakeCredentialRepo, fakeInviteRepo, fakeSettingsRepo, fakeUserRepo } from './fakes.js';

function setup(configuredMode: 'open' | 'invite' = 'open') {
  const userRepo = fakeUserRepo();
  const kv = fakeKv();
  const userService = createUserService({
    userRepo,
    inviteRepo: fakeInviteRepo(),
    settingsRepo: fakeSettingsRepo(),
    configuredMode,
    appVersion: 'test',
  });
  const sessionService = createSessionService(kv, 30);
  const service = createAuthService({
    userService,
    credentialRepo: fakeCredentialRepo(),
    flowStore: kv,
    sessionService,
    eventBus: createInProcessEventBus(),
    rpId: 'localhost',
    rpName: 'repfuel',
    origin: 'http://localhost:8080',
  });
  return { service, userRepo, userService, sessionService };
}

describe('password hashing', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('scrypt:')).toBe(true);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('produces unique salts and rejects malformed hashes', async () => {
    const h1 = await hashPassword('same');
    const h2 = await hashPassword('same');
    expect(h1).not.toBe(h2);
    expect(await verifyPassword('same', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('same', 'scrypt:16384:8:1:xx')).toBe(false);
  });
});

describe('password registration & login', () => {
  it('registers the first user as admin and logs in', async () => {
    const { service, sessionService } = setup();
    const reg = await service.registerWithPassword({ username: 'Alice', password: 'secret-pass-1' });
    expect(reg.user.role).toBe('admin');
    expect(reg.user.username).toBe('alice');
    expect(reg.user.hasPassword).toBe(true);
    const login = await service.loginWithPassword({ username: 'ALICE', password: 'secret-pass-1' });
    expect(login.user.id).toBe(reg.user.id);
    expect(await sessionService.get(login.sid)).toMatchObject({ userId: reg.user.id });
  });

  it('rejects wrong password, unknown user and passkey-only accounts identically', async () => {
    const { service, userService } = setup();
    await service.registerWithPassword({ username: 'alice', password: 'secret-pass-1' });
    // Passkey-only-Konto
    await userService.finalizeRegistration('bob');
    for (const attempt of [
      { username: 'alice', password: 'wrong-password' },
      { username: 'nobody', password: 'whatever-123' },
      { username: 'bob', password: 'whatever-123' },
    ]) {
      await expect(service.loginWithPassword(attempt)).rejects.toMatchObject({
        code: 'unauthorized',
        message: 'Invalid username or password',
      });
    }
  });

  it('honours invite mode', async () => {
    const { service, userService } = setup('invite');
    await service.registerWithPassword({ username: 'admin1', password: 'secret-pass-1' });
    await expect(
      service.registerWithPassword({ username: 'eve', password: 'secret-pass-1' }),
    ).rejects.toMatchObject({ code: 'registration_closed' });
    const invite = await userService.createInvite({
      createdBy: (await userService.getActiveUserByUsername('admin1'))!.id,
      expiresInHours: 1,
    });
    const reg = await service.registerWithPassword({
      username: 'eve',
      password: 'secret-pass-1',
      inviteToken: invite.token,
    });
    expect(reg.user.role).toBe('user');
  });

  it('rejects disabled users', async () => {
    const { service, userRepo } = setup();
    const reg = await service.registerWithPassword({ username: 'alice', password: 'secret-pass-1' });
    userRepo.rows.find((r) => r.id === reg.user.id)!.disabledAt = new Date();
    await expect(
      service.loginWithPassword({ username: 'alice', password: 'secret-pass-1' }),
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('lets a passkey user add a password later', async () => {
    const { service, userService } = setup();
    const row = await userService.finalizeRegistration('carol');
    await service.setOwnPassword(row.id, 'later-password-9');
    const login = await service.loginWithPassword({ username: 'carol', password: 'later-password-9' });
    expect(login.user.username).toBe('carol');
    expect(login.user.hasPassword).toBe(true);
  });
});
