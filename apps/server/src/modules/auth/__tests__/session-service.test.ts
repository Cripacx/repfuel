import { describe, expect, it } from 'vitest';
import { createSessionService } from '../services/session-service.js';
import { fakeKv } from './fakes.js';

describe('session service', () => {
  it('creates unique sessions and resolves them', async () => {
    const service = createSessionService(fakeKv(), 30);
    const sid1 = await service.create('user-1');
    const sid2 = await service.create('user-1');
    expect(sid1).not.toBe(sid2);
    expect(await service.get(sid1)).toMatchObject({ userId: 'user-1' });
  });

  it('returns null for unknown or destroyed sessions', async () => {
    const service = createSessionService(fakeKv(), 30);
    expect(await service.get('nope')).toBeNull();
    const sid = await service.create('user-1');
    await service.destroy(sid);
    expect(await service.get(sid)).toBeNull();
  });

  it('tolerates corrupt session payloads', async () => {
    const kv = fakeKv();
    const service = createSessionService(kv, 30);
    kv.data.set('session:broken', 'not-json');
    expect(await service.get('broken')).toBeNull();
  });
});
