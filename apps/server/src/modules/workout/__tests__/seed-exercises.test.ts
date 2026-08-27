import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../../core/db.js';
import { exercises } from '../schema.js';
import { seedExercises } from '../seed/seed-exercises.js';

interface InsertedRow {
  wgerId: number;
  name: string;
  nameDe: string | null;
  muscleGroups: string[];
  equipment: string | null;
  mediaUrl: string | null;
  source: string;
  userId: string | null;
}

/**
 * Minimaler Fake der Drizzle-Insert-Chain, der nur die für
 * seedExercises() genutzten Methoden abbildet (insert -> values ->
 * onConflictDoNothing). Kein echter DB-Zugriff nötig.
 */
function fakeDb() {
  let inserted: InsertedRow[] = [];
  let conflictTarget: unknown;

  const fake = {
    insert(table: unknown) {
      expect(table).toBe(exercises);
      return {
        values(rows: InsertedRow[]) {
          inserted = rows;
          return {
            onConflictDoNothing(opts: { target: unknown }) {
              conflictTarget = opts.target;
              return Promise.resolve();
            },
          };
        },
      };
    },
  };

  return {
    db: fake as unknown as Database,
    getInserted: () => inserted,
    getConflictTarget: () => conflictTarget,
  };
}

describe('wger-exercises.json snapshot', () => {
  const raw = readFileSync(new URL('../seed/wger-exercises.json', import.meta.url), 'utf-8');
  const data = JSON.parse(raw) as Array<{
    wgerId: number;
    name: string;
    nameDe: string | null;
    muscleGroups: string[];
    equipment: string | null;
    mediaUrl: string | null;
  }>;

  it('is non-empty and has no duplicate wgerId', () => {
    expect(data.length).toBeGreaterThan(0);
    const ids = new Set(data.map((e) => e.wgerId));
    expect(ids.size).toBe(data.length);
  });

  it('every entry has a non-empty English name', () => {
    for (const entry of data) {
      expect(entry.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('is sorted by name', () => {
    const names = data.map((e) => e.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });
});

describe('seedExercises', () => {
  it('inserts every snapshot entry with source=wger and userId=null', async () => {
    const { db, getInserted, getConflictTarget } = fakeDb();
    const count = await seedExercises(db);

    const inserted = getInserted();
    expect(count).toBe(inserted.length);
    expect(inserted.length).toBeGreaterThan(0);
    for (const row of inserted) {
      expect(row.source).toBe('wger');
      expect(row.userId).toBeNull();
      expect(typeof row.wgerId).toBe('number');
      expect(row.name.length).toBeGreaterThan(0);
    }
    expect(getConflictTarget()).toBe(exercises.wgerId);
  });
});
