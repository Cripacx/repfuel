import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { Database } from '../../../core/db.js';
import { exercises } from '../schema.js';

/**
 * Schema für einen Eintrag in wger-exercises.json (Snapshot der wger
 * Exercise-DB, siehe README.md in diesem Ordner).
 */
const seedExerciseSchema = z.object({
  wgerId: z.number().int().positive(),
  name: z.string().min(1),
  nameDe: z.string().min(1).nullable(),
  muscleGroups: z.array(z.string().min(1)),
  equipment: z.string().min(1).nullable(),
  mediaUrl: z.string().min(1).nullable(),
});

const seedExercisesSchema = z.array(seedExerciseSchema);

export type SeedExercise = z.infer<typeof seedExerciseSchema>;

/**
 * Lädt den Übungs-Snapshot zur Laufzeit relativ zur eigenen Modul-URL.
 * So funktioniert der Zugriff sowohl unter tsx (src/) als auch im
 * kompilierten Build (dist/), sofern die JSON-Datei beim Build mitkopiert
 * wird (siehe README.md).
 */
function loadSeedExercises(): SeedExercise[] {
  const url = new URL('./wger-exercises.json', import.meta.url);
  const raw = readFileSync(url, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  return seedExercisesSchema.parse(parsed);
}

/**
 * Seeded die globale Übungsbibliothek aus dem wger-Snapshot (source='wger',
 * userId=null). Idempotent: bereits vorhandene wger-IDs werden übersprungen
 * (onConflictDoNothing auf exercises.wgerId).
 *
 * @returns Anzahl der Übungen im Snapshot (nicht die Anzahl neu eingefügter
 *   Zeilen — bei wiederholtem Aufruf bleibt der Rückgabewert also gleich).
 */
export async function seedExercises(db: Database): Promise<number> {
  const seedData = loadSeedExercises();

  if (seedData.length === 0) {
    return 0;
  }

  await db
    .insert(exercises)
    .values(
      seedData.map((entry) => ({
        wgerId: entry.wgerId,
        name: entry.name,
        nameDe: entry.nameDe,
        muscleGroups: entry.muscleGroups,
        equipment: entry.equipment,
        mediaUrl: entry.mediaUrl,
        source: 'wger' as const,
        userId: null,
      })),
    )
    .onConflictDoNothing({ target: exercises.wgerId });

  return seedData.length;
}
