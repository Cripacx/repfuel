import { describe, expect, it, vi } from 'vitest';
import { createInProcessEventBus } from './event-bus.js';

describe('event bus', () => {
  it('delivers events to subscribers and supports unsubscribe', async () => {
    const bus = createInProcessEventBus();
    const seen: number[] = [];
    const unsubscribe = bus.subscribe<number>('t', (n) => {
      seen.push(n);
    });
    await bus.publish('t', 1);
    unsubscribe();
    await bus.publish('t', 2);
    expect(seen).toEqual([1]);
  });

  it('isolates handler errors and reports them', async () => {
    const onError = vi.fn();
    const bus = createInProcessEventBus(onError);
    bus.subscribe('t', () => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    bus.subscribe('t', ok);
    await bus.publish('t', null);
    expect(onError).toHaveBeenCalledOnce();
    expect(ok).toHaveBeenCalledOnce();
  });
});
