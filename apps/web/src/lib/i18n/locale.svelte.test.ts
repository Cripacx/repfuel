import { beforeEach, describe, expect, it } from 'vitest';
import de from './de.js';
import en from './en.js';
import { getLocale, m, setLocale } from './locale.svelte.js';

type Tree = Record<string, unknown>;

function collectKeys(obj: Tree, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? collectKeys(value as Tree, path)
      : [path];
  });
}

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exposes exactly the same nested keys for de and en', () => {
    // Zusätzliches Laufzeit-Sicherheitsnetz zum Compile-Time-Check über `Messages`
    // (siehe de.ts/en.ts): jede Übersetzung muss dieselbe Struktur haben.
    expect(collectKeys(en).sort()).toEqual(collectKeys(de).sort());
  });

  it('exposes the app name identically in both dictionaries', () => {
    expect(de.common.appName).toBe('repfuel');
    expect(en.common.appName).toBe('repfuel');
  });

  it('switches the active dictionary via setLocale', () => {
    setLocale('de');
    expect(getLocale()).toBe('de');
    expect(m().auth.loginTitle).toBe('Anmelden');

    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(m().auth.loginTitle).toBe('Log in');
  });

  it('persists the chosen locale to localStorage by default', () => {
    setLocale('de');
    expect(localStorage.getItem('repfuel:locale')).toBe('de');
  });

  it('does not touch localStorage when persist=false is passed', () => {
    setLocale('de');
    localStorage.clear();
    setLocale('en', false);
    expect(getLocale()).toBe('en');
    expect(localStorage.getItem('repfuel:locale')).toBeNull();
  });
});
