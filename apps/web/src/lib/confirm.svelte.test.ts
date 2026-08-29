import { describe, expect, it } from 'vitest';
import { getPendingConfirm, requestConfirm, resolveConfirm } from './confirm.svelte.js';

describe('requestConfirm', () => {
  it('resolves true only when confirmed', async () => {
    const pending = requestConfirm({ message: 'Wirklich löschen?', confirmLabel: 'Löschen' });
    expect(getPendingConfirm()?.message).toBe('Wirklich löschen?');

    resolveConfirm(true);
    await expect(pending).resolves.toBe(true);
    expect(getPendingConfirm()).toBeNull();
  });

  it('resolves false on cancel', async () => {
    const pending = requestConfirm({ message: 'x', confirmLabel: 'Löschen' });
    resolveConfirm(false);
    await expect(pending).resolves.toBe(false);
  });

  it('declines the previous request instead of dropping it silently', async () => {
    const first = requestConfirm({ message: 'erste', confirmLabel: 'Löschen' });
    const second = requestConfirm({ message: 'zweite', confirmLabel: 'Löschen' });

    // Die erste Anfrage darf nicht ewig offen bleiben — sonst hinge der
    // aufrufende await für immer.
    await expect(first).resolves.toBe(false);
    expect(getPendingConfirm()?.message).toBe('zweite');

    resolveConfirm(true);
    await expect(second).resolves.toBe(true);
  });

  it('ignores a resolve without a pending request', () => {
    expect(() => resolveConfirm(true)).not.toThrow();
    expect(getPendingConfirm()).toBeNull();
  });
});
