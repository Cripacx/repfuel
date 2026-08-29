import { describe, expect, it } from 'vitest';
import { createSessionStore } from './session-store.js';

describe('session store', () => {
  it('maps chat sessions to agent sessions', () => {
    const store = createSessionStore();
    expect(store.get('a')).toBeNull();
    store.set('a', 'agent-1');
    expect(store.get('a')).toBe('agent-1');
    expect(store.size()).toBe(1);
  });

  it('expires idle sessions after the timeout', () => {
    let t = 0;
    const store = createSessionStore(10 * 60 * 1000, () => t);
    store.set('a', 'agent-1');
    t = 9 * 60 * 1000;
    expect(store.get('a')).toBe('agent-1'); // Zugriff verlängert
    t = 18 * 60 * 1000;
    expect(store.get('a')).toBe('agent-1');
    t = 40 * 60 * 1000;
    expect(store.get('a')).toBeNull();
    expect(store.size()).toBe(0);
  });
});
