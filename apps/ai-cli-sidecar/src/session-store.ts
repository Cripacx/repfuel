/**
 * Mapping Chat-Session (repfuel) → Agent-Session (Claude Code resume-ID),
 * mit Idle-Timeout: nach ~10 min Inaktivität wird die Zuordnung verworfen,
 * der nächste Turn startet eine frische Agent-Session.
 */
export interface SessionStore {
  get(chatSessionId: string): string | null;
  set(chatSessionId: string, agentSessionId: string): void;
  /** Anzahl aktiver Zuordnungen (für Health/Debug). */
  size(): number;
}

export function createSessionStore(
  idleTimeoutMs = 10 * 60 * 1000,
  now: () => number = Date.now,
): SessionStore {
  const map = new Map<string, { agentSessionId: string; lastUsed: number }>();

  function prune(): void {
    const cutoff = now() - idleTimeoutMs;
    for (const [key, value] of map) {
      if (value.lastUsed < cutoff) map.delete(key);
    }
  }

  return {
    get(chatSessionId) {
      prune();
      const entry = map.get(chatSessionId);
      if (!entry) return null;
      entry.lastUsed = now();
      return entry.agentSessionId;
    },
    set(chatSessionId, agentSessionId) {
      prune();
      map.set(chatSessionId, { agentSessionId, lastUsed: now() });
    },
    size() {
      prune();
      return map.size;
    },
  };
}
