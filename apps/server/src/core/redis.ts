import { Redis } from 'ioredis';

export type RedisClient = Redis;

export function createRedis(redisUrl: string): RedisClient {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
  });
}

/**
 * Minimales Key-Value-Interface, das Services statt eines vollen Redis-Clients
 * erhalten — hält Services testbar (In-Memory-Fake in Unit-Tests).
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  expire(key: string, ttlSeconds: number): Promise<void>;
}

export function redisKeyValueStore(redis: RedisClient): KeyValueStore {
  return {
    async get(key) {
      return redis.get(key);
    },
    async setWithTtl(key, value, ttlSeconds) {
      await redis.set(key, value, 'EX', ttlSeconds);
    },
    async del(key) {
      await redis.del(key);
    },
    async expire(key, ttlSeconds) {
      await redis.expire(key, ttlSeconds);
    },
  };
}
