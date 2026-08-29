import { randomBytes } from 'node:crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { SessionUser } from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { EventBus } from '../../../core/event-bus.js';
import type { KeyValueStore } from '../../../core/redis.js';
import type { CredentialRepo } from '../repositories/credential-repo.js';
import { hashPassword, verifyPassword } from './password-service.js';
import { toSessionUser, type UserService } from './user-service.js';
import type { SessionService } from './session-service.js';

const FLOW_TTL_SECONDS = 5 * 60;

interface RegisterFlow {
  type: 'register';
  challenge: string;
  username: string;
  inviteToken?: string;
}

interface LoginFlow {
  type: 'login';
  challenge: string;
  username?: string;
}

type Flow = RegisterFlow | LoginFlow;

export interface WebAuthnLib {
  generateRegistrationOptions: typeof generateRegistrationOptions;
  verifyRegistrationResponse: typeof verifyRegistrationResponse;
  generateAuthenticationOptions: typeof generateAuthenticationOptions;
  verifyAuthenticationResponse: typeof verifyAuthenticationResponse;
}

export const defaultWebAuthnLib: WebAuthnLib = {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
};

export interface AuthServiceDeps {
  userService: UserService;
  credentialRepo: CredentialRepo;
  flowStore: KeyValueStore;
  sessionService: SessionService;
  eventBus: EventBus;
  rpId: string;
  rpName: string;
  origin: string;
  webauthn?: WebAuthnLib;
}

export type AuthService = ReturnType<typeof createAuthService>;

export function createAuthService(deps: AuthServiceDeps) {
  const webauthn = deps.webauthn ?? defaultWebAuthnLib;
  const flowKey = (id: string) => `authflow:${id}`;

  async function storeFlow(flow: Flow): Promise<string> {
    const flowId = randomBytes(16).toString('base64url');
    await deps.flowStore.setWithTtl(flowKey(flowId), JSON.stringify(flow), FLOW_TTL_SECONDS);
    return flowId;
  }

  async function consumeFlow<T extends Flow['type']>(
    flowId: string,
    type: T,
  ): Promise<Extract<Flow, { type: T }>> {
    const raw = await deps.flowStore.get(flowKey(flowId));
    await deps.flowStore.del(flowKey(flowId));
    if (!raw) throw new AppError('verification_failed', 'Auth flow expired, please retry');
    const flow = JSON.parse(raw) as Flow;
    if (flow.type !== type) throw new AppError('verification_failed', 'Auth flow mismatch');
    return flow as Extract<Flow, { type: T }>;
  }

  return {
    async startRegistration(input: {
      username: string;
      inviteToken?: string;
    }): Promise<{ flowId: string; options: PublicKeyCredentialCreationOptionsJSON }> {
      const username = input.username.toLowerCase();
      await deps.userService.checkRegistrationAllowed(username, input.inviteToken);
      const options = await webauthn.generateRegistrationOptions({
        rpName: deps.rpName,
        rpID: deps.rpId,
        userName: username,
        attestationType: 'none',
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
      });
      const flowId = await storeFlow({
        type: 'register',
        challenge: options.challenge,
        username,
        inviteToken: input.inviteToken,
      });
      return { flowId, options };
    },

    async finishRegistration(input: {
      flowId: string;
      response: RegistrationResponseJSON;
    }): Promise<{ user: SessionUser; sid: string }> {
      const flow = await consumeFlow(input.flowId, 'register');
      const verification = await webauthn.verifyRegistrationResponse({
        response: input.response,
        expectedChallenge: flow.challenge,
        expectedOrigin: deps.origin,
        expectedRPID: deps.rpId,
        requireUserVerification: false,
      });
      if (!verification.verified || !verification.registrationInfo) {
        throw new AppError('verification_failed', 'Passkey registration could not be verified');
      }
      const { credential } = verification.registrationInfo;
      const user = await deps.userService.finalizeRegistration(flow.username, flow.inviteToken);
      await deps.credentialRepo.create({
        id: credential.id,
        userId: user.id,
        publicKey: new Uint8Array(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? null,
      });
      const sid = await deps.sessionService.create(user.id);
      await deps.eventBus.publish('auth.user_registered', { userId: user.id, role: user.role });
      return { user: toSessionUser(user), sid };
    },

    async startLogin(input: {
      username?: string;
    }): Promise<{ flowId: string; options: PublicKeyCredentialRequestOptionsJSON }> {
      const username = input.username?.toLowerCase();
      let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined;
      if (username) {
        // Unbekannte Nutzer nicht verraten: dann wie usernameless weitermachen.
        const user = await deps.userService.getActiveUserByUsername(username);
        if (user) {
          const creds = await deps.credentialRepo.listByUserId(user.id);
          allowCredentials = creds.map((c) => ({
            id: c.id,
            transports: (c.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
          }));
        }
      }
      const options = await webauthn.generateAuthenticationOptions({
        rpID: deps.rpId,
        userVerification: 'preferred',
        allowCredentials,
      });
      const flowId = await storeFlow({ type: 'login', challenge: options.challenge, username });
      return { flowId, options };
    },

    async finishLogin(input: {
      flowId: string;
      response: AuthenticationResponseJSON;
    }): Promise<{ user: SessionUser; sid: string }> {
      const flow = await consumeFlow(input.flowId, 'login');
      const credential = await deps.credentialRepo.findById(input.response.id);
      if (!credential) throw new AppError('verification_failed', 'Unknown passkey');
      const user = await deps.userService.getActiveUser(credential.userId);
      if (!user) throw new AppError('unauthorized', 'Account is disabled or missing');
      if (flow.username && user.username !== flow.username) {
        throw new AppError('verification_failed', 'Passkey does not belong to this user');
      }
      const verification = await webauthn.verifyAuthenticationResponse({
        response: input.response,
        expectedChallenge: flow.challenge,
        expectedOrigin: deps.origin,
        expectedRPID: deps.rpId,
        requireUserVerification: false,
        credential: {
          id: credential.id,
          publicKey: credential.publicKey,
          counter: credential.counter,
          transports: (credential.transports ?? undefined) as
            | AuthenticatorTransportFuture[]
            | undefined,
        },
      });
      if (!verification.verified) {
        throw new AppError('verification_failed', 'Passkey login could not be verified');
      }
      await deps.credentialRepo.updateCounter(
        credential.id,
        verification.authenticationInfo.newCounter,
      );
      const sid = await deps.sessionService.create(user.id);
      return { user: toSessionUser(user), sid };
    },

    async registerWithPassword(input: {
      username: string;
      password: string;
      inviteToken?: string;
    }): Promise<{ user: SessionUser; sid: string }> {
      const username = input.username.toLowerCase();
      const user = await deps.userService.finalizeRegistration(username, input.inviteToken);
      await deps.userService.setPasswordHash(user.id, await hashPassword(input.password));
      const sid = await deps.sessionService.create(user.id);
      await deps.eventBus.publish('auth.user_registered', { userId: user.id, role: user.role });
      return { user: { ...toSessionUser(user), hasPassword: true }, sid };
    },

    async loginWithPassword(input: {
      username: string;
      password: string;
    }): Promise<{ user: SessionUser; sid: string }> {
      const user = await deps.userService.getActiveUserByUsername(input.username.toLowerCase());
      // Kein Unterschied zwischen "Nutzer unbekannt", "kein Passwort gesetzt"
      // und "Passwort falsch" — verhindert Username-Enumeration.
      if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new AppError('unauthorized', 'Invalid username or password');
      }
      const sid = await deps.sessionService.create(user.id);
      return { user: toSessionUser(user), sid };
    },

    /** Setzt/ändert das Passwort des eingeloggten Nutzers. */
    async setOwnPassword(userId: string, password: string): Promise<void> {
      await deps.userService.setPasswordHash(userId, await hashPassword(password));
    },

    async logout(sid: string): Promise<void> {
      await deps.sessionService.destroy(sid);
    },
  };
}
