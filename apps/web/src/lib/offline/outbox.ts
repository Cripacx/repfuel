import type {
  SyncBatchRequest,
  SyncEntity,
  UpsertMealRequest,
  UpsertSetRequest,
  UpsertWeightRequest,
  UpsertWorkoutRequest,
} from '@repfuel/shared';
import type { OutboxRow } from './db.js';

/**
 * Reine Gruppierungslogik: baut aus den (chronologisch geordneten) Outbox-Zeilen
 * genau einen `/sync/batch`-Request. Pro Datensatz (entity+id) zählt nur die
 * zeitlich letzte Aktion (Last-Write-Wins lokal, bevor überhaupt zum Server
 * gegangen wird) — Zwischenzustände sind für den Server irrelevant, weil Upserts
 * idempotent sind. `resultKey` erlaubt es, eine Server-Antwort (`SyncItemResult`)
 * wieder eindeutig einer Gruppe von Outbox-Ids zuzuordnen.
 */
export interface BatchGroup {
  /** Schlüssel, unter dem die Server-Antwort zu dieser Gruppe zu finden ist. */
  resultKey: string;
  /** Alle Outbox-Ids, die durch diese eine gesendete Aktion abgedeckt sind. */
  outboxIds: number[];
}

export interface BuiltBatch {
  batch: SyncBatchRequest;
  /** resultKey -> Outbox-Ids, die bei `status:'ok'` (oder terminalem `status:'error'`)
   * aus der Queue entfernt werden dürfen. */
  groups: Map<string, BatchGroup>;
}

function resultKeyFor(entity: SyncEntity | 'deletion', id: string): string {
  return `${entity}:${id}`;
}

export function buildBatchFromEntries(entries: OutboxRow[]): BuiltBatch {
  // Letzte Aktion je Datensatz (entity+id) ermitteln — Zeilen sind nach `createdAt`/
  // Einfüge-Reihenfolge sortiert erwartet (Dexie-Outbox: `++id` aufsteigend = chronologisch).
  const latestByRecord = new Map<string, OutboxRow>();
  const idsByRecord = new Map<string, number[]>();

  for (const entry of entries) {
    const recordKey = `${entry.entity}:${entry.payload.id}`;
    latestByRecord.set(recordKey, entry);
    const ids = idsByRecord.get(recordKey) ?? [];
    ids.push(entry.id);
    idsByRecord.set(recordKey, ids);
  }

  const workouts: SyncBatchRequest['workouts'] = [];
  const sets: SyncBatchRequest['sets'] = [];
  const meals: SyncBatchRequest['meals'] = [];
  const bodyWeight: SyncBatchRequest['bodyWeight'] = [];
  const deletions: SyncBatchRequest['deletions'] = [];
  const groups = new Map<string, BatchGroup>();

  for (const [recordKey, entry] of latestByRecord) {
    const outboxIds = idsByRecord.get(recordKey) ?? [entry.id];
    const { id, ...rest } = entry.payload;

    if (entry.kind === 'delete') {
      const workoutId = typeof rest.workoutId === 'string' ? rest.workoutId : undefined;
      deletions.push({ entity: entry.entity, id, workoutId });
      groups.set(resultKeyFor('deletion', id), { resultKey: resultKeyFor('deletion', id), outboxIds });
      continue;
    }

    switch (entry.entity) {
      case 'workout':
        workouts.push({ id, ...(rest as UpsertWorkoutRequest) });
        break;
      case 'set':
        sets.push({ id, ...(rest as UpsertSetRequest & { workoutId: string }) });
        break;
      case 'meal':
        meals.push({ id, ...(rest as UpsertMealRequest) });
        break;
      case 'body_weight':
        bodyWeight.push({ id, ...(rest as UpsertWeightRequest) });
        break;
    }
    groups.set(resultKeyFor(entry.entity, id), { resultKey: resultKeyFor(entry.entity, id), outboxIds });
  }

  return {
    batch: { workouts, sets, meals, bodyWeight, deletions },
    groups,
  };
}

/** Schlüssel zum Nachschlagen eines `SyncItemResult` in `groups`. */
export function resultLookupKey(entity: SyncEntity | 'deletion', id: string): string {
  return resultKeyFor(entity, id);
}

export function isBatchEmpty(batch: SyncBatchRequest): boolean {
  return (
    batch.workouts.length === 0 &&
    batch.sets.length === 0 &&
    batch.meals.length === 0 &&
    batch.bodyWeight.length === 0 &&
    batch.deletions.length === 0
  );
}
