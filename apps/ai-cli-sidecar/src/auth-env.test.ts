import { describe, expect, it } from 'vitest';
import { resolveCliAuthEnv } from './auth-env.js';

describe('resolveCliAuthEnv', () => {
  it('maps a setup-token to CLAUDE_CODE_OAUTH_TOKEN for claude', () => {
    expect(resolveCliAuthEnv('claude', { AI_API_KEY: 'sk-ant-oat01-abc' })).toEqual({
      CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat01-abc',
    });
  });

  it('maps a plain API key to ANTHROPIC_API_KEY for claude', () => {
    expect(resolveCliAuthEnv('claude', { AI_API_KEY: 'sk-ant-api03-xyz' })).toEqual({
      ANTHROPIC_API_KEY: 'sk-ant-api03-xyz',
    });
  });

  it('maps the generic key to CODEX_API_KEY for codex', () => {
    expect(resolveCliAuthEnv('codex', { AI_API_KEY: 'sk-proj-123' })).toEqual({
      CODEX_API_KEY: 'sk-proj-123',
    });
  });

  it('never overrides specific variables', () => {
    expect(
      resolveCliAuthEnv('claude', {
        AI_API_KEY: 'sk-ant-oat01-generic',
        CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat01-specific',
      }),
    ).toEqual({});
    expect(
      resolveCliAuthEnv('codex', { AI_API_KEY: 'sk-generic', CODEX_API_KEY: 'sk-specific' }),
    ).toEqual({});
  });

  it('does nothing without a generic key', () => {
    expect(resolveCliAuthEnv('claude', {})).toEqual({});
    expect(resolveCliAuthEnv('codex', { AI_API_KEY: '  ' })).toEqual({});
  });
});
