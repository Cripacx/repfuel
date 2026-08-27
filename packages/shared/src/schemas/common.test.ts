import { describe, expect, it } from 'vitest';
import { usernameSchema } from './common.js';

describe('usernameSchema', () => {
  it('accepts simple usernames', () => {
    expect(usernameSchema.parse('anna')).toBe('anna');
    expect(usernameSchema.parse('max_123')).toBe('max_123');
    expect(usernameSchema.parse('a.b-c')).toBe('a.b-c');
  });

  it('rejects too short, too long and invalid characters', () => {
    expect(usernameSchema.safeParse('ab').success).toBe(false);
    expect(usernameSchema.safeParse('x'.repeat(33)).success).toBe(false);
    expect(usernameSchema.safeParse('-leading').success).toBe(false);
    expect(usernameSchema.safeParse('has space').success).toBe(false);
    expect(usernameSchema.safeParse('umläut').success).toBe(false);
  });
});
