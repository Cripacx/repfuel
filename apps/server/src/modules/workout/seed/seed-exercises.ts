import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../../core/db.js';
import { exercises } from '../schema.js';

/**
 * Schema für einen Eintrag in gymvisual-exercises.json (Datenschicht des
 * Datensatzes hasaneyldrm/exercises-dataset, siehe README.md in diesem Ordner).
 *
 * `image`/`gif` sind reine Dateinamen. Die Medien liegen NICHT im Repo: sie
 * werden vom Self-Hoster einmalig nach MEDIA_DIR geladen und unter /media
 * ausgeliefert (siehe docker-compose.yml).
 */
const seedExerciseSchema = z.object({
  datasetId: z.string().regex(/^[0-9]{4}$/),
  name: z.string().min(1),
  muscleGroups: z.array(z.string().min(1)),
  instructions: z.array(z.string().min(1)),
  equipment: z.string().min(1).nullable(),
  image: z.string().min(1),
  gif: z.string().min(1),
});

const seedExercisesSchema = z.array(seedExerciseSchema);

export type SeedExercise = z.infer<typeof seedExerciseSchema>;

/** Öffentliche URL-Präfixe der unter MEDIA_DIR ausgelieferten Übungsmedien. */
export const EXERCISE_IMAGE_BASE = '/media/img';
export const EXERCISE_GIF_BASE = '/media/gif';

/**
 * Lädt den Übungs-Snapshot zur Laufzeit relativ zur eigenen Modul-URL.
 * So funktioniert der Zugriff sowohl unter tsx (src/) als auch im
 * kompilierten Build (dist/), sofern die JSON-Datei beim Build mitkopiert
 * wird (siehe build-Script in apps/server/package.json).
 */
function loadSeedExercises(): SeedExercise[] {
  const url = new URL('./gymvisual-exercises.json', import.meta.url);
  const raw = readFileSync(url, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  return seedExercisesSchema.parse(parsed);
}

/**
 * Seeded die globale Übungsbibliothek aus dem Dataset-Snapshot
 * (source='gymvisual', userId=null). Idempotent: bereits vorhandene
 * Dataset-IDs behalten ihre Zeile, bekommen aber die Anleitung aus dem
 * Snapshot nachgezogen (onConflictDoUpdate auf exercises.datasetId) —
 * so erhalten Bestandsinstallationen die Beschreibungen ohne Re-Seed.
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
        datasetId: entry.datasetId,
        name: entry.name,
        nameDe: null,
        muscleGroups: entry.muscleGroups,
        instructions: entry.instructions,
        equipment: entry.equipment,
        mediaUrl: `${EXERCISE_IMAGE_BASE}/${entry.image}`,
        gifUrl: `${EXERCISE_GIF_BASE}/${entry.gif}`,
        source: 'gymvisual' as const,
        userId: null,
      })),
    )
    .onConflictDoUpdate({
      target: exercises.datasetId,
      set: { instructions: sql`excluded.instructions` },
    });

  return seedData.length;
}
