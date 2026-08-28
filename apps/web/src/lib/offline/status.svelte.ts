import { api } from '$lib/api.js';
import type { SyncBatchRequest } from '@repfuel/shared';
import {
  appendDeadLetter,
  clearDeadLetters,
  db,
  readDeadLetters,
  type DeadLetterEntry,
} from './db.js';
import { createSyncQueue } from './sync.js';

/**
 * Reaktiver Offline-/Sync-Status + die eine Sync-Queue-Instanz der App (analog
 * `auth.svelte.ts`: ein Modul trägt sowohl den Runes-State als auch die Logik,
 * die ihn schreibt). `repo.ts` importiert nur `notifyLocalWrite`/`triggerFlush`
 * von hier — so bleibt `sync.ts`/`outbox.ts` frei von UI-Glue und einzeln testbar.
 */

const POLL_INTERVAL_MS = 30_000;

const dexieOutbox = {
  list: () => db.outbox.orderBy('id').toArray(),
  removeMany: (ids: number[]) => db.outbox.bulkDelete(ids),
};

const dexieDeadLetters = { add: appendDeadLetter };

const httpSyncApi = {
  postBatch: (batch: SyncBatchRequest) => api.sync.batch(batch),
};

export const syncQueue = createSyncQueue({
  outbox: dexieOutbox,
  deadLetters: dexieDeadLetters,
  api: httpSyncApi,
});

let online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
let pendingCount = $state(0);
let deadLetters = $state<DeadLetterEntry[]>([]);
let syncing = $state(false);
let initialized = false;

export function isOnline(): boolean {
  return online;
}

export function getPendingCount(): number {
  return pendingCount;
}

export function getDeadLetters(): DeadLetterEntry[] {
  return deadLetters;
}

export function isSyncing(): boolean {
  return syncing;
}

async function refreshPendingCount(): Promise<void> {
  try {
    pendingCount = await db.outbox.count();
  } catch {
    // Dexie evtl. nicht verfügbar (privates Fenster o. ä.) — Badge bleibt bei 0.
  }
}

async function refreshDeadLetters(): Promise<void> {
  try {
    deadLetters = await readDeadLetters();
  } catch {
    deadLetters = [];
  }
}

/** Optimistisches Hochzählen direkt nach dem lokalen Schreiben, damit die Badge
 * nicht erst auf den (async) Flush warten muss; `syncNow` korrigiert danach ohnehin. */
export function notifyLocalWrite(): void {
  pendingCount += 1;
}

/** Manueller Sync-Trigger (Settings/Topbar-Button) und Ziel jedes automatischen
 * Triggers (App-Start, `online`, Intervall, nach jedem lokalen Write). */
export async function syncNow(): Promise<void> {
  syncing = true;
  try {
    await syncQueue.flush();
  } finally {
    syncing = false;
    await Promise.all([refreshPendingCount(), refreshDeadLetters()]);
  }
}

/** Fire-and-forget-Variante für Schreibpfade — die Logging-Flows dürfen nie auf
 * das Netzwerk warten. */
export function triggerFlush(): void {
  void syncNow();
}

export async function dismissDeadLetters(): Promise<void> {
  await clearDeadLetters();
  await refreshDeadLetters();
}

/** Registriert die Sync-Trigger: App-Start, `online`-Event, ~30s-Intervall (nur
 * wenn die Queue nicht leer ist). Nur im Browser aufrufen (SPA, kein SSR). */
export function initOfflineRuntime(): () => void {
  if (initialized) return () => {};
  initialized = true;

  void refreshPendingCount();
  void refreshDeadLetters();
  triggerFlush();

  const handleOnline = (): void => {
    online = true;
    triggerFlush();
  };
  const handleOffline = (): void => {
    online = false;
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  const intervalId = setInterval(() => {
    if (online && pendingCount > 0) {
      triggerFlush();
    } else {
      void refreshPendingCount();
    }
  }, POLL_INTERVAL_MS);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(intervalId);
    initialized = false;
  };
}
