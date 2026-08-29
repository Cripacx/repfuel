import { describe, expect, it } from 'vitest';
import type { OutboxRow } from './db.js';
import { buildBatchFromEntries, isBatchEmpty } from './outbox.js';

function row(partial: Partial<OutboxRow> & Pick<OutboxRow, 'id' | 'kind' | 'entity' | 'payload'>): OutboxRow {
  return { createdAt: partial.id, ...partial };
}

describe('buildBatchFromEntries', () => {
  it('gruppiert leere Outbox zu einem leeren Batch', () => {
    const { batch, groups } = buildBatchFromEntries([]);
    expect(isBatchEmpty(batch)).toBe(true);
    expect(groups.size).toBe(0);
  });

  it('ordnet Upserts nach Entity-Typ ein und trackt die Outbox-Ids je Gruppe', () => {
    const entries: OutboxRow[] = [
      row({ id: 1, kind: 'upsert', entity: 'workout', payload: { id: 'w1', startedAt: 't' } }),
      row({ id: 2, kind: 'upsert', entity: 'set', payload: { id: 's1', workoutId: 'w1', reps: 8 } }),
      row({ id: 3, kind: 'upsert', entity: 'meal', payload: { id: 'm1', quickKcal: 200 } }),
      row({ id: 4, kind: 'upsert', entity: 'body_weight', payload: { id: 'bw1', weightKg: 80 } }),
    ];

    const { batch, groups } = buildBatchFromEntries(entries);
    expect(batch.workouts).toEqual([{ id: 'w1', startedAt: 't' }]);
    expect(batch.sets).toEqual([{ id: 's1', workoutId: 'w1', reps: 8 }]);
    expect(batch.meals).toEqual([{ id: 'm1', quickKcal: 200 }]);
    expect(batch.bodyWeight).toEqual([{ id: 'bw1', weightKg: 80 }]);
    expect(batch.deletions).toEqual([]);
    expect(groups.get('workout:w1')?.outboxIds).toEqual([1]);
    expect(groups.get('set:s1')?.outboxIds).toEqual([2]);
  });

  it('behält pro Datensatz nur die zeitlich letzte Aktion (lokales Last-Write-Wins)', () => {
    const entries: OutboxRow[] = [
      row({ id: 1, kind: 'upsert', entity: 'set', payload: { id: 's1', workoutId: 'w1', reps: 5 } }),
      row({ id: 2, kind: 'upsert', entity: 'set', payload: { id: 's1', workoutId: 'w1', reps: 8 } }),
      row({ id: 3, kind: 'upsert', entity: 'set', payload: { id: 's1', workoutId: 'w1', reps: 10 } }),
    ];

    const { batch, groups } = buildBatchFromEntries(entries);
    expect(batch.sets).toEqual([{ id: 's1', workoutId: 'w1', reps: 10 }]);
    // Alle drei Outbox-Zeilen gehören zur selben Gruppe (werden nach Erfolg gemeinsam entfernt).
    expect(groups.get('set:s1')?.outboxIds).toEqual([1, 2, 3]);
  });

  it('sendet nur eine Löschung, wenn Upsert und Delete für dieselbe Id vorliegen (Delete gewinnt)', () => {
    const entries: OutboxRow[] = [
      row({ id: 1, kind: 'upsert', entity: 'meal', payload: { id: 'm1', quickKcal: 100 } }),
      row({ id: 2, kind: 'delete', entity: 'meal', payload: { id: 'm1' } }),
    ];

    const { batch, groups } = buildBatchFromEntries(entries);
    expect(batch.meals).toEqual([]);
    expect(batch.deletions).toEqual([{ entity: 'meal', id: 'm1', workoutId: undefined }]);
    expect(groups.get('deletion:m1')?.outboxIds).toEqual([1, 2]);
    expect(groups.has('meal:m1')).toBe(false);
  });

  it('sendet nur den letzten Upsert, wenn ein Delete durch einen späteren Upsert überschrieben wird', () => {
    const entries: OutboxRow[] = [
      row({ id: 1, kind: 'delete', entity: 'set', payload: { id: 's1', workoutId: 'w1' } }),
      row({ id: 2, kind: 'upsert', entity: 'set', payload: { id: 's1', workoutId: 'w1', reps: 3 } }),
    ];

    const { batch, groups } = buildBatchFromEntries(entries);
    expect(batch.deletions).toEqual([]);
    expect(batch.sets).toEqual([{ id: 's1', workoutId: 'w1', reps: 3 }]);
    expect(groups.get('set:s1')?.outboxIds).toEqual([1, 2]);
  });

  it('gibt die workoutId einer Set-Löschung weiter', () => {
    const entries: OutboxRow[] = [
      row({ id: 1, kind: 'delete', entity: 'set', payload: { id: 's1', workoutId: 'w9' } }),
    ];
    const { batch } = buildBatchFromEntries(entries);
    expect(batch.deletions).toEqual([{ entity: 'set', id: 's1', workoutId: 'w9' }]);
  });
});
