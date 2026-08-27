import { LOCALES, type Locale } from '@repfuel/shared';
import de from './de.js';
import en from './en.js';
import type { Messages } from './de.js';

export type { Messages } from './de.js';

const dictionaries: Record<Locale, Messages> = { de, en };

const STORAGE_KEY = 'repfuel:locale';

function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as readonly string[]).includes(value);
}

function readStoredLocale(): Locale | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return isLocale(localStorage.getItem(STORAGE_KEY)) ? (localStorage.getItem(STORAGE_KEY) as Locale) : null;
  } catch {
    // localStorage kann in privaten Modi / bestimmten Kontexten werfen.
    return null;
  }
}

function detectBrowserLocale(): Locale {
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
    }
  } catch {
    // ignore
  }
  return 'en';
}

function detectInitialLocale(): Locale {
  return readStoredLocale() ?? detectBrowserLocale();
}

let locale = $state<Locale>(detectInitialLocale());

/** Aktuelle Sprache (reaktiv, wenn innerhalb eines Template-Ausdrucks / `$derived` gelesen). */
export function getLocale(): Locale {
  return locale;
}

/** Aktuelles Message-Dictionary für die gewählte Sprache (reaktiv). */
export function m(): Messages {
  return dictionaries[locale];
}

/**
 * Sprache wechseln. `persist` schreibt die Wahl in localStorage (Default) — für
 * eingeloggte Nutzer ruft der aufrufende Code zusätzlich `PATCH /auth/me` auf, das
 * geschieht bewusst außerhalb dieses Moduls (siehe `src/routes/+layout.svelte`).
 */
export function setLocale(next: Locale, persist = true): void {
  locale = next;
  if (!persist) return;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
  } catch {
    // best effort — kein localStorage verfügbar
  }
}
