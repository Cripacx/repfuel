import { describe, expect, it } from 'vitest';
import { passwordsMatch, validatePasswordPolicy } from './auth-validation.js';

describe('validatePasswordPolicy', () => {
  it('rejects an empty password as too short', () => {
    expect(validatePasswordPolicy('')).toBe('tooShort');
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePasswordPolicy('a'.repeat(7))).toBe('tooShort');
  });

  it('accepts a password at the 8 character minimum', () => {
    expect(validatePasswordPolicy('a'.repeat(8))).toBeNull();
  });

  it('accepts a password at the 128 character maximum', () => {
    expect(validatePasswordPolicy('a'.repeat(128))).toBeNull();
  });

  it('rejects passwords longer than 128 characters', () => {
    expect(validatePasswordPolicy('a'.repeat(129))).toBe('tooLong');
  });
});

describe('passwordsMatch', () => {
  it('is true for identical passwords', () => {
    expect(passwordsMatch('hunter2000', 'hunter2000')).toBe(true);
  });

  it('is false for differing passwords', () => {
    expect(passwordsMatch('hunter2000', 'hunter2001')).toBe(false);
  });

  it('is false when the confirmation is still empty', () => {
    expect(passwordsMatch('hunter2000', '')).toBe(false);
  });

  it('is true when both are empty (required-ness is checked separately)', () => {
    expect(passwordsMatch('', '')).toBe(true);
  });
});
