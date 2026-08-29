import Dexie, { type EntityTable } from 'dexie';
import type { SyncEntity } from '@repfuel/shared';
import type { BodyWeightDto, MealDto, SetDto, WorkoutDto } from '@repfuel/shared';

/** Lokale Spiegelung eines Workouts ohne die eingebetteten Sätze (die liegen
 * normalisiert in der `sets`-Tabelle, wie im Server-Schema). */
export type LocalWorkout = Omit<WorkoutDto, 'sets'>;

export type LocalSet = SetDto;
export type LocalMeal = MealDto;
export type LocalBodyWeight = BodyWeightDto;

export type OutboxKind = 'upsert' | 'delete';

/** Payload einer Outbox-Zeile — je nach `entity`/`kind` eine der Upsert-Request-Formen
 * (mit client-UUID) oder eine Löschung; siehe `syncBatchRequestSchema` in `@repfuel/shared`. */
export type OutboxPayload = Record<string, unknown> & { id: string };

export interface OutboxRow {
  id: number;
  kind: OutboxKind;
  entity: SyncEntity;
  payload: OutboxPayload;
  createdAt: number;
}

export type NewOutboxRow = Omit<OutboxRow, 'id'>;

export interface DeadLetterEntry {
  key: string;
  entity: SyncEntity;
  id: string;
  kind: OutboxKind;
  error: string;
  failedAt: number;
}

const META_DEAD_LETTERS_KEY = 'dead-letters';

interface MetaRow {
  key: string;
  value: unknown;
}

class RepfuelOfflineDb extends Dexie {
  workouts!: EntityTable<LocalWorkout, 'id'>;
  sets!: EntityTable<LocalSet, 'id'>;
  meals!: EntityTable<LocalMeal, 'id'>;
  bodyWeight!: EntityTable<LocalBodyWeight, 'id'>;
  outbox!: EntityTable<OutboxRow, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor() {
    super('repfuel-offline');
    this.version(1).stores({
      workouts: 'id, startedAt',
      sets: 'id, workoutId',
      meals: 'id, eatenAt',
      bodyWeight: 'id, measuredAt',
      outbox: '++id, entity, createdAt',
      meta: 'key',
    });
  }
}

/** Einziger Dexie-Zugriffspunkt der App. Repo-/Sync-Schicht kapseln alle Zugriffe
 * dahinter (siehe `repo.ts`, `sync.ts`), damit Geschäftslogik gegen schmale
 * Interfaces statt gegen Dexie direkt testbar bleibt. */
export const db = new RepfuelOfflineDb();

/** Liest die abgelegten Dead-Letter-Einträge (fehlgeschlagene Sync-Items, die
 * dauerhaft aus der Outbox entfernt wurden) aus `meta`. */
export async function readDeadLetters(): Promise<DeadLetterEntry[]> {
  const row = await db.meta.get(META_DEAD_LETTERS_KEY);
  return Array.isArray(row?.value) ? (row.value as DeadLetterEntry[]) : [];
}

export async function appendDeadLetter(entry: DeadLetterEntry): Promise<void> {
  const existing = await readDeadLetters();
  const next = [...existing, entry].slice(-50);
  await db.meta.put({ key: META_DEAD_LETTERS_KEY, value: next });
}

export async function clearDeadLetters(): Promise<void> {
  await db.meta.delete(META_DEAD_LETTERS_KEY);
}
