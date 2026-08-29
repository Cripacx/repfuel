import type { KeyValueStore } from '../redis.js';

/** In-Memory-KeyValueStore für Unit-Tests (TTL wird ignoriert). */
export function fakeKv(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key) {
      return data.get(key) ?? null;
    },
    async setWithTtl(key, value) {
      data.set(key, value);
    },
    async del(key) {
      data.delete(key);
    },
    async expire() {
      /* noop */
    },
  };
}
