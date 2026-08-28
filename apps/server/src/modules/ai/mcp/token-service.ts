import { randomBytes } from 'node:crypto';
import type { KeyValueStore } from '../../../core/redis.js';

/**
 * Kurzlebige MCP-Tokens: werden pro Chat-Session für den CLI-Sidecar
 * ausgestellt und tragen den User-Kontext. Nur damit sind die MCP-Tools
 * erreichbar — der Sidecar selbst kennt keine Nutzer-Credentials.
 */
export interface McpTokenClaims {
  userId: string;
  chatSessionId: string;
  tzOffsetMinutes: number;
}

export interface McpTokenService {
  issue(claims: McpTokenClaims): Promise<string>;
  verify(token: string): Promise<McpTokenClaims | null>;
  revoke(token: string): Promise<void>;
}

const TTL_SECONDS = 15 * 60;
const key = (token: string) => `mcp:token:${token}`;

export function createMcpTokenService(kv: KeyValueStore): McpTokenService {
  return {
    async issue(claims) {
      const token = randomBytes(32).toString('base64url');
      await kv.setWithTtl(key(token), JSON.stringify(claims), TTL_SECONDS);
      return token;
    },
    async verify(token) {
      if (!token || token.length > 128) return null;
      const raw = await kv.get(key(token));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as McpTokenClaims;
      } catch {
        return null;
      }
    },
    async revoke(token) {
      await kv.del(key(token));
    },
  };
}
