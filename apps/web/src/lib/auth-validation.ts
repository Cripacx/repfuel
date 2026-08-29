import { passwordSchema } from '@repfuel/shared';

export type PasswordPolicyError = 'tooShort' | 'tooLong';

/**
 * Client-seitige Spiegelung der Server-Passwort-Policy (`passwordSchema`: 8–128 Zeichen),
 * damit ein zu kurzes/langes Passwort schon on-blur sichtbar wird statt erst nach einem
 * Roundtrip zum Server. Leerer String zählt als "zu kurz", nicht als eigener Fall — das
 * Pflichtfeld selbst meldet sich über `required`.
 */
export function validatePasswordPolicy(password: string): PasswordPolicyError | null {
  if (passwordSchema.safeParse(password).success) return null;
  return password.length < 8 ? 'tooShort' : 'tooLong';
}

/** true, wenn Passwort und Wiederholung exakt übereinstimmen. */
export function passwordsMatch(password: string, confirmation: string): boolean {
  return password === confirmation;
}
