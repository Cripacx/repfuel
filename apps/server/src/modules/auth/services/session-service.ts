import { randomBytes } from 'node:crypto';
import type { KeyValueStore } from '../../../core/redis.js';

export interface SessionData {
  userId: string;
  createdAt: string;
}

export interface SessionService {
  create(userId: string): Promise<string>;
  get(sid: string): Promise<SessionData | null>;
  /** Rolling-TTL: Session bei Nutzung verlängern. */
  touch(sid: string): Promise<void>;
  destroy(sid: string): Promise<void>;
}

const key = (sid: string) => `session:${sid}`;

export function createSessionService(store: KeyValueStore, ttlDays: number): SessionService {
  const ttlSeconds = ttlDays * 24 * 60 * 60;
  return {
    async create(userId) {
      const sid = randomBytes(32).toString('base64url');
      const data: SessionData = { userId, createdAt: new Date().toISOString() };
      await store.setWithTtl(key(sid), JSON.stringify(data), ttlSeconds);
      return sid;
    },
    async get(sid) {
      const raw = await store.get(key(sid));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as SessionData;
      } catch {
        return null;
      }
    },
    async touch(sid) {
      await store.expire(key(sid), ttlSeconds);
    },
    async destroy(sid) {
      await store.del(key(sid));
    },
  };
}
