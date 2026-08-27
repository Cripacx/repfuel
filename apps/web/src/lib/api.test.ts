import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api.js';

/**
 * Minimaler Response-Stub statt einer echten `Response`-Instanz — vermeidet
 * jede Abhängigkeit davon, ob die Fetch API in der jsdom-Testumgebung vollständig
 * verfügbar ist, und deckt genau das ab, was `src/lib/api.ts` tatsächlich liest.
 */
function stubResponse(status: number, body: unknown, statusText = ''): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('returns parsed JSON on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        stubResponse(200, { user: { id: '1', username: 'ada', role: 'user', locale: null } }),
      ),
    );

    const res = await api.getMe();
    expect(res.user.username).toBe('ada');
  });

  it('resolves to undefined for a 204 No Content response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stubResponse(204, undefined)));

    await expect(api.logout()).resolves.toBeUndefined();
  });

  it('throws an ApiError with the server-provided code and message on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        stubResponse(401, { error: 'unauthorized', message: 'Please sign in.' }),
      ),
    );

    const err = await api.getMe().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, code: 'unauthorized', message: 'Please sign in.' });
  });

  it('falls back to a generic error when the error body is not well-formed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(stubResponse(500, 'not-json', 'Server Error')),
    );

    const err = await api.getMe().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
    expect((err as ApiError).message).toBe('Server Error');
  });

  it('wraps a network failure (fetch rejection) in a TypeError, distinct from ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));

    const err = await api.getMe().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TypeError);
    expect(err).not.toBeInstanceOf(ApiError);
  });
});
