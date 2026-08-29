import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../../core/db.js';
import { exercises } from '../schema.js';
import { seedExercises } from '../seed/seed-exercises.js';

interface InsertedRow {
  datasetId: string;
  name: string;
  nameDe: string | null;
  muscleGroups: string[];
  instructions: string[];
  equipment: string | null;
  mediaUrl: string | null;
  gifUrl: string | null;
  source: string;
  userId: string | null;
}

/**
 * Minimaler Fake der Drizzle-Insert-Chain, der nur die für
 * seedExercises() genutzten Methoden abbildet (insert -> values ->
 * onConflictDoUpdate). Kein echter DB-Zugriff nötig.
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
            onConflictDoUpdate(opts: { target: unknown; set: unknown }) {
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

describe('gymvisual-exercises.json snapshot', () => {
  const raw = readFileSync(new URL('../seed/gymvisual-exercises.json', import.meta.url), 'utf-8');
  const data = JSON.parse(raw) as Array<{
    datasetId: string;
    name: string;
    muscleGroups: string[];
    instructions: string[];
    equipment: string | null;
    image: string;
    gif: string;
  }>;

  it('is non-empty and has no duplicate datasetId', () => {
    expect(data.length).toBeGreaterThan(0);
    const ids = new Set(data.map((e) => e.datasetId));
    expect(ids.size).toBe(data.length);
  });

  it('every entry has a name and a media reference', () => {
    for (const entry of data) {
      expect(entry.name.trim().length).toBeGreaterThan(0);
      expect(entry.image).toMatch(/^[0-9]{4}-[A-Za-z0-9]+\.jpg$/);
      expect(entry.gif).toMatch(/^[0-9]{4}-[A-Za-z0-9]+\.gif$/);
    }
  });

  it('every entry carries a step-by-step instruction (en)', () => {
    for (const entry of data) {
      expect(entry.instructions.length).toBeGreaterThan(0);
      for (const step of entry.instructions) {
        expect(step.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('is sorted by datasetId', () => {
    const ids = data.map((e) => e.datasetId);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });

  it('carries no media files in the repo — only their file names', () => {
    // Die Medien selbst gehören Gym visual und werden nicht mitausgeliefert;
    // der Snapshot referenziert sie nur (siehe seed/README.md).
    for (const entry of data) {
      expect(entry.image).not.toContain('/');
      expect(entry.gif).not.toContain('/');
    }
  });
});

describe('seedExercises', () => {
  it('inserts every snapshot entry with source=gymvisual and userId=null', async () => {
    const { db, getInserted, getConflictTarget } = fakeDb();
    const count = await seedExercises(db);

    const inserted = getInserted();
    expect(count).toBe(inserted.length);
    expect(inserted.length).toBeGreaterThan(0);
    for (const row of inserted) {
      expect(row.source).toBe('gymvisual');
      expect(row.userId).toBeNull();
      expect(row.datasetId).toMatch(/^[0-9]{4}$/);
      expect(row.name.length).toBeGreaterThan(0);
    }
    expect(getConflictTarget()).toBe(exercises.datasetId);
  });

  it('builds media URLs under the /media mount', async () => {
    const { db, getInserted } = fakeDb();
    await seedExercises(db);

    for (const row of getInserted()) {
      expect(row.mediaUrl).toMatch(/^\/media\/img\/[0-9]{4}-[A-Za-z0-9]+\.jpg$/);
      expect(row.gifUrl).toMatch(/^\/media\/gif\/[0-9]{4}-[A-Za-z0-9]+\.gif$/);
    }
  });
});
