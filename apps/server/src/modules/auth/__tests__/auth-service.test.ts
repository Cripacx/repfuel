import { describe, expect, it, vi } from 'vitest';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { createInProcessEventBus } from '../../../core/event-bus.js';
import { createAuthService, type WebAuthnLib } from '../services/auth-service.js';
import { createSessionService } from '../services/session-service.js';
import { createUserService } from '../services/user-service.js';
import { fakeCredentialRepo, fakeInviteRepo, fakeKv, fakeSettingsRepo, fakeUserRepo } from './fakes.js';

const regResponse = { id: 'cred-1' } as RegistrationResponseJSON;
const authResponse = { id: 'cred-1' } as AuthenticationResponseJSON;

function fakeWebAuthn(overrides: Partial<WebAuthnLib> = {}): WebAuthnLib {
  return {
    generateRegistrationOptions: vi.fn(async () => {
      return { challenge: 'reg-challenge' } as PublicKeyCredentialCreationOptionsJSON;
    }),
    verifyRegistrationResponse: vi.fn(async () => ({
      verified: true,
      registrationInfo: {
        fmt: 'none',
        aaguid: '',
        credentialType: 'public-key',
        attestationObject: new Uint8Array(),
        userVerified: true,
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
        origin: 'http://localhost:8080',
        credential: {
          id: 'cred-1',
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
          transports: ['internal'],
        },
      },
    })) as unknown as WebAuthnLib['verifyRegistrationResponse'],
    generateAuthenticationOptions: vi.fn(async () => {
      return { challenge: 'login-challenge' } as PublicKeyCredentialRequestOptionsJSON;
    }),
    verifyAuthenticationResponse: vi.fn(async () => ({
      verified: true,
      authenticationInfo: { newCounter: 5 },
    })) as unknown as WebAuthnLib['verifyAuthenticationResponse'],
    ...overrides,
  };
}

function setup(webauthn: WebAuthnLib = fakeWebAuthn()) {
  const userRepo = fakeUserRepo();
  const credentialRepo = fakeCredentialRepo();
  const kv = fakeKv();
  const userService = createUserService({
    userRepo,
    inviteRepo: fakeInviteRepo(),
    settingsRepo: fakeSettingsRepo(),
    configuredMode: 'open',
    appVersion: 'test',
  });
  const sessionService = createSessionService(kv, 30);
  const service = createAuthService({
    userService,
    credentialRepo,
    flowStore: kv,
    sessionService,
    eventBus: createInProcessEventBus(),
    rpId: 'localhost',
    rpName: 'repfuel',
    origin: 'http://localhost:8080',
    webauthn,
  });
  return { service, userRepo, credentialRepo, kv, sessionService, webauthn };
}

describe('registration flow', () => {
  it('registers the first user as admin and creates a session', async () => {
    const { service, credentialRepo, sessionService } = setup();
    const start = await service.startRegistration({ username: 'Alice' });
    expect(start.flowId).toBeTruthy();
    const { user, sid } = await service.finishRegistration({
      flowId: start.flowId,
      response: regResponse,
    });
    expect(user.username).toBe('alice'); // lowercased
    expect(user.role).toBe('admin');
    expect(credentialRepo.rows).toHaveLength(1);
    expect(await sessionService.get(sid)).toMatchObject({ userId: user.id });
  });

  it('rejects an unknown or reused flow', async () => {
    const { service } = setup();
    await expect(
      service.finishRegistration({ flowId: 'missing', response: regResponse }),
    ).rejects.toMatchObject({ code: 'verification_failed' });
    const start = await service.startRegistration({ username: 'alice' });
    await service.finishRegistration({ flowId: start.flowId, response: regResponse });
    await expect(
      service.finishRegistration({ flowId: start.flowId, response: regResponse }),
    ).rejects.toMatchObject({ code: 'verification_failed' });
  });

  it('fails when webauthn verification fails', async () => {
    const webauthn = fakeWebAuthn({
      verifyRegistrationResponse: vi.fn(async () => ({
        verified: false,
      })) as unknown as WebAuthnLib['verifyRegistrationResponse'],
    });
    const { service, userRepo } = setup(webauthn);
    const start = await service.startRegistration({ username: 'alice' });
    await expect(
      service.finishRegistration({ flowId: start.flowId, response: regResponse }),
    ).rejects.toMatchObject({ code: 'verification_failed' });
    expect(userRepo.rows).toHaveLength(0);
  });
});

describe('login flow', () => {
  async function registered() {
    const ctx = setup();
    const start = await ctx.service.startRegistration({ username: 'alice' });
    const { user } = await ctx.service.finishRegistration({
      flowId: start.flowId,
      response: regResponse,
    });
    return { ...ctx, user };
  }

  it('logs in with a known passkey and updates the counter', async () => {
    const ctx = await registered();
    const start = await ctx.service.startLogin({ username: 'alice' });
    const { user, sid } = await ctx.service.finishLogin({
      flowId: start.flowId,
      response: authResponse,
    });
    expect(user.username).toBe('alice');
    expect(await ctx.sessionService.get(sid)).not.toBeNull();
    expect(ctx.credentialRepo.rows[0]?.counter).toBe(5);
  });

  it('does not leak whether a username exists', async () => {
    const ctx = await registered();
    const start = await ctx.service.startLogin({ username: 'nobody' });
    expect(start.options).toBeTruthy();
    const gen = ctx.webauthn.generateAuthenticationOptions as ReturnType<typeof vi.fn>;
    const lastCall = gen.mock.calls.at(-1)?.[0] as { allowCredentials?: unknown[] };
    expect(lastCall.allowCredentials ?? undefined).toBeUndefined();
  });

  it('rejects login for disabled users', async () => {
    const ctx = await registered();
    ctx.userRepo.rows[0]!.disabledAt = new Date();
    const start = await ctx.service.startLogin({});
    await expect(
      ctx.service.finishLogin({ flowId: start.flowId, response: authResponse }),
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('rejects a passkey of a different user when username was given', async () => {
    const ctx = await registered();
    const start = await ctx.service.startLogin({ username: 'alice' });
    // Credential gehört plötzlich jemand anderem (simuliert fremden Nutzer)
    const other = await ctx.userRepo.create({ username: 'bob', role: 'user' });
    ctx.credentialRepo.rows[0]!.userId = other.id;
    await expect(
      ctx.service.finishLogin({ flowId: start.flowId, response: authResponse }),
    ).rejects.toMatchObject({ code: 'verification_failed' });
  });

  it('logout destroys the session', async () => {
    const ctx = await registered();
    const start = await ctx.service.startLogin({ username: 'alice' });
    const { sid } = await ctx.service.finishLogin({ flowId: start.flowId, response: authResponse });
    await ctx.service.logout(sid);
    expect(await ctx.sessionService.get(sid)).toBeNull();
  });
});
