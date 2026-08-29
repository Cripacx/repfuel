import { describe, expect, it, vi } from 'vitest';
import type { SyncBatchRequest, SyncBatchResponse } from '@repfuel/shared';
import type { DeadLetterEntry, OutboxRow } from './db.js';
import { createSyncQueue, type DeadLetterStore, type OutboxStore } from './sync.js';

/** In-Memory-Fakes statt echtem IndexedDB (fake-indexeddb ist keine erlaubte
 * neue Dependency) — die Queue-Logik hängt nur an den schmalen Interfaces. */
function makeOutboxFake(initial: OutboxRow[] = []): OutboxStore & { rows: OutboxRow[] } {
  return {
    rows: [...initial],
    list(): Promise<OutboxRow[]> {
      return Promise.resolve([...this.rows]);
    },
    removeMany(ids: number[]): Promise<void> {
      this.rows = this.rows.filter((r) => !ids.includes(r.id));
      return Promise.resolve();
    },
  };
}

function makeDeadLetterFake(): DeadLetterStore & { entries: DeadLetterEntry[] } {
  return {
    entries: [],
    add(entry: DeadLetterEntry): Promise<void> {
      this.entries.push(entry);
      return Promise.resolve();
    },
  };
}

function row(id: number, entity: OutboxRow['entity'], payload: Record<string, unknown> & { id: string }): OutboxRow {
  return { id, kind: 'upsert', entity, payload, createdAt: id };
}

describe('createSyncQueue.flush', () => {
  it('meldet "empty" und ruft die API nicht auf, wenn die Outbox leer ist', async () => {
    const outbox = makeOutboxFake([]);
    const deadLetters = makeDeadLetterFake();
    const postBatch = vi.fn(
      (_batch: SyncBatchRequest): Promise<SyncBatchResponse> => Promise.resolve({ results: [] }),
    );
    const queue = createSyncQueue({ outbox, deadLetters, api: { postBatch } });

    const outcome = await queue.flush();

    expect(outcome).toEqual({ status: 'empty' });
    expect(postBatch).not.toHaveBeenCalled();
  });

  it('entfernt erfolgreich verarbeitete Items aus der Outbox', async () => {
    const outbox = makeOutboxFake([row(1, 'workout', { id: 'w1', startedAt: 't' })]);
    const deadLetters = makeDeadLetterFake();
    const postBatch = vi.fn(
      (): Promise<SyncBatchResponse> =>
        Promise.resolve({ results: [{ entity: 'workout', id: 'w1', status: 'ok' }] }),
    );
    const queue = createSyncQueue({ outbox, deadLetters, api: { postBatch } });

    const outcome = await queue.flush();

    expect(outcome).toEqual({ status: 'ok', okCount: 1, errorCount: 0 });
    expect(outbox.rows).toEqual([]);
  });

  it('behält die Outbox bei einem Netzwerkfehler unverändert (Retry beim nächsten Trigger)', async () => {
    const outbox = makeOutboxFake([row(1, 'set', { id: 's1', workoutId: 'w1', reps: 5 })]);
    const deadLetters = makeDeadLetterFake();
    const postBatch = vi.fn((): Promise<SyncBatchResponse> => Promise.reject(new TypeError('offline')));
    const queue = createSyncQueue({ outbox, deadLetters, api: { postBatch } });

    const outcome = await queue.flush();

    expect(outcome).toEqual({ status: 'network-error' });
    expect(outbox.rows).toHaveLength(1);
  });

  it('entfernt Items mit Datenfehler aus der Queue und legt sie als Dead-Letter ab', async () => {
    const outbox = makeOutboxFake([row(1, 'meal', { id: 'm1', quickKcal: -5 })]);
    const deadLetters = makeDeadLetterFake();
    const postBatch = vi.fn(
      (): Promise<SyncBatchResponse> =>
        Promise.resolve({
          results: [{ entity: 'meal', id: 'm1', status: 'error', error: 'invalid quickKcal' }],
        }),
    );
    const queue = createSyncQueue({ outbox, deadLetters, api: { postBatch }, now: () => 42 });

    const outcome = await queue.flush();

    expect(outcome).toEqual({ status: 'ok', okCount: 0, errorCount: 1 });
    expect(outbox.rows).toEqual([]);
    expect(deadLetters.entries).toEqual([
      { key: 'meal:m1', entity: 'meal', id: 'm1', kind: 'upsert', error: 'invalid quickKcal', failedAt: 42 },
    ]);
  });

  it('dedupliziert nebenläufige flush()-Aufrufe (Mutex) statt doppelt zu senden', async () => {
    const outbox = makeOutboxFake([row(1, 'body_weight', { id: 'bw1', weightKg: 80 })]);
    const deadLetters = makeDeadLetterFake();
    let resolvePost!: (value: SyncBatchResponse) => void;
    const postBatch = vi.fn(
      (_batch: SyncBatchRequest) =>
        new Promise<SyncBatchResponse>((resolve) => {
          resolvePost = resolve;
        }),
    );
    const queue = createSyncQueue({ outbox, deadLetters, api: { postBatch } });

    const first = queue.flush();
    const second = queue.flush();
    // `runFlush` liest die Outbox erst async (await outbox.list()), bevor `postBatch`
    // aufgerufen wird — kurz zurückstellen, bis `resolvePost` tatsächlich gesetzt ist.
    await new Promise((r) => setTimeout(r, 0));
    resolvePost({ results: [{ entity: 'body_weight', id: 'bw1', status: 'ok' }] });

    const [firstOutcome, secondOutcome] = await Promise.all([first, second]);

    expect(postBatch).toHaveBeenCalledTimes(1);
    expect(firstOutcome).toBe(secondOutcome);
  });
});
