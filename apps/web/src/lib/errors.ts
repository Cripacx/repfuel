import { WebAuthnError } from '@simplewebauthn/browser';
import { ApiError } from './api.js';
import { m } from './i18n/index.js';

/** Bekannte API-Fehlercodes → übersetzte, nutzerfreundliche Meldung. */
function knownApiErrorMessage(code: string): string | undefined {
  switch (code) {
    case 'unauthorized':
      return m().errors.unauthorized;
    case 'forbidden':
      return m().errors.forbidden;
    case 'invalid_credentials':
      return m().errors.invalidCredentials;
    case 'username_taken':
      return m().errors.usernameTaken;
    case 'invite_invalid':
    case 'invite_expired':
    case 'invite_used':
      return m().errors.invalidInviteToken;
    default:
      return undefined;
  }
}

function describeWebAuthnError(err: WebAuthnError): string {
  switch (err.code) {
    case 'ERROR_CEREMONY_ABORTED':
      return m().errors.webauthnCancelled;
    case 'ERROR_INVALID_DOMAIN':
    case 'ERROR_INVALID_RP_ID':
      return m().errors.webauthnUnsupported;
    default:
      return m().errors.webauthnNotAllowed;
  }
}

/**
 * Übersetzt einen Fehler aus einem Auth-/API-Aufruf in eine anzeigbare Nutzermeldung.
 * Deckt WebAuthn-Abbrüche (`@simplewebauthn/browser`), `DOMException`en des Browsers,
 * bekannte `ApiError`-Codes und Netzwerkfehler ab; alles andere fällt auf eine
 * generische Meldung zurück.
 */
export function describeError(err: unknown): string {
  if (err instanceof WebAuthnError) {
    return describeWebAuthnError(err);
  }
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
      return m().errors.webauthnNotAllowed;
    }
  }
  if (err instanceof ApiError) {
    return knownApiErrorMessage(err.code) ?? err.message ?? m().errors.generic;
  }
  if (err instanceof TypeError) {
    return m().errors.network;
  }
  return m().errors.generic;
}
