import type { SessionUser } from '@repfuel/shared';

/**
 * Aktueller Session-Nutzer als modulweiter Runes-State. `null` = nicht eingeloggt,
 * `undefined` = noch nicht initialisiert (GET /auth/me läuft noch / lief noch nie).
 * Der Root-Layout-Load füllt das genau einmal beim App-Start, siehe
 * `src/routes/+layout.ts`; Login/Logout/Locale-Wechsel schreiben danach direkt hierüber.
 */
let user = $state<SessionUser | null | undefined>(undefined);

export function getUser(): SessionUser | null | undefined {
  return user;
}

export function isAuthInitialized(): boolean {
  return user !== undefined;
}

export function setUser(next: SessionUser | null): void {
  user = next;
}
