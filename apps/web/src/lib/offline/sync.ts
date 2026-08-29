import type { SyncBatchRequest, SyncBatchResponse } from '@repfuel/shared';
import { buildBatchFromEntries, isBatchEmpty } from './outbox.js';
import type { DeadLetterEntry, OutboxRow } from './db.js';

/** Schmales Interface über die Outbox — hält `sync.ts` unabhängig von Dexie,
 * damit die Queue-Logik in Tests mit einem einfachen In-Memory-Fake statt
 * echtem IndexedDB geprüft werden kann. */
export interface OutboxStore {
  list(): Promise<OutboxRow[]>;
  removeMany(ids: number[]): Promise<void>;
}

export interface DeadLetterStore {
  add(entry: DeadLetterEntry): Promise<void>;
}

/** Postet einen Batch; wirft bei Netzwerkfehlern (siehe `apps/web/src/lib/api.ts`:
 * `fetch` schlägt fehl → `TypeError`), damit `flush()` zwischen "Server hat
 * abgelehnt" (Antwort vorhanden) und "nicht erreichbar" (retry) unterscheiden kann. */
export interface SyncApi {
  postBatch(batch: SyncBatchRequest): Promise<SyncBatchResponse>;
}

export type FlushOutcome =
  | { status: 'empty' }
  | { status: 'ok'; okCount: number; errorCount: number }
  | { status: 'network-error' };

export interface SyncQueueDeps {
  outbox: OutboxStore;
  deadLetters: DeadLetterStore;
  api: SyncApi;
  now?: () => number;
}

export interface SyncQueue {
  /** Bündelt die aktuelle Outbox zu einem Batch-Call. Nebenläufige Aufrufe
   * teilen sich denselben laufenden Flush (Mutex) statt doppelt zu senden. */
  flush(): Promise<FlushOutcome>;
}

/**
 * Reine, testbare Sync-Queue-Logik (keine Zeitgeber/Events — die Trigger
 * App-Start/`online`/Intervall/Post-Write registriert `initSyncRuntime` in
 * `status.svelte.ts`, das ist bewusst UI-Glue und nicht Teil dieses Moduls).
 */
export function createSyncQueue(deps: SyncQueueDeps): SyncQueue {
  const now = deps.now ?? (() => Date.now());
  let inFlight: Promise<FlushOutcome> | null = null;

  async function runFlush(): Promise<FlushOutcome> {
    const entries = await deps.outbox.list();
    if (entries.length === 0) {
      return { status: 'empty' };
    }

    const { batch, groups } = buildBatchFromEntries(entries);
    if (isBatchEmpty(batch)) {
      // Sollte mit nicht-leeren Entries nicht vorkommen, aber sauber behandeln.
      return { status: 'empty' };
    }

    let response: SyncBatchResponse;
    try {
      response = await deps.api.postBatch(batch);
    } catch {
      // Netzwerkfehler: Queue bleibt unangetastet, nächster Trigger versucht erneut.
      return { status: 'network-error' };
    }

    let okCount = 0;
    let errorCount = 0;
    const idsToRemove: number[] = [];

    for (const result of response.results) {
      const key = `${result.entity}:${result.id}`;
      const group = groups.get(key);
      if (!group) continue; // unerwartet, aber nicht fatal — nichts zu entfernen

      if (result.status === 'ok') {
        okCount += 1;
        idsToRemove.push(...group.outboxIds);
      } else {
        errorCount += 1;
        // Datenfehler sind nicht retry-fähig (z. B. verletzte Constraints) — aus der
        // Queue entfernen, aber sichtbar als Dead-Letter ablegen statt still zu verwerfen.
        const [entity, id] = key.split(':', 2) as [string, string];
        await deps.deadLetters.add({
          key,
          entity: entity as DeadLetterEntry['entity'],
          id,
          kind: entries.find((e) => group.outboxIds.includes(e.id))?.kind ?? 'upsert',
          error: result.error ?? 'unknown error',
          failedAt: now(),
        });
        idsToRemove.push(...group.outboxIds);
      }
    }

    if (idsToRemove.length > 0) {
      await deps.outbox.removeMany(idsToRemove);
    }

    return { status: 'ok', okCount, errorCount };
  }

  return {
    flush(): Promise<FlushOutcome> {
      if (!inFlight) {
        inFlight = runFlush().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
