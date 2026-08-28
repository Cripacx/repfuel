import type { CoachMemoryDto, MemoryCategory } from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { MemoryRepo } from '../repositories/memory-repo.js';
import type { CoachMemoryRow } from '../schema.js';

/**
 * Obergrenze pro Nutzer: das Gedächtnis wird komplett in den System-Prompt
 * injiziert — es muss klein bleiben, sonst frisst es das Kontextfenster.
 */
export const MEMORY_LIMIT = 200;

function toDto(row: CoachMemoryRow): CoachMemoryDto {
  return {
    id: row.id,
    category: row.category,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

export type MemoryService = ReturnType<typeof createMemoryService>;

/**
 * Coach-Gedächtnis: dauerhafte, vom Nutzer stammende Fakten (Vorhaben,
 * Vorlieben/Abneigungen, Einschränkungen). Die KI schreibt direkt über das
 * remember-Tool — anders als Routinen/Profil kein Bestätigungs-Flow, dafür
 * ist jedes Gedächtnis im Profil sichtbar und löschbar.
 */
export function createMemoryService(memoryRepo: MemoryRepo) {
  return {
    async list(userId: string): Promise<CoachMemoryDto[]> {
      return (await memoryRepo.list(userId)).map(toDto);
    },

    async add(userId: string, category: MemoryCategory, content: string): Promise<CoachMemoryDto> {
      const trimmed = content.trim();
      if (trimmed.length < 2) {
        throw new AppError('bad_request', 'Memory content too short');
      }
      // Exakte Duplikate still zusammenfalten: "merk dir X" zweimal gesagt
      // soll keine zwei Einträge erzeugen.
      const existing = await memoryRepo.list(userId);
      const duplicate = existing.find(
        (row) => row.content.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) return toDto(duplicate);
      if (existing.length >= MEMORY_LIMIT) {
        throw new AppError('bad_request', `Memory limit of ${MEMORY_LIMIT} entries reached`);
      }
      return toDto(await memoryRepo.insert({ userId, category, content: trimmed }));
    },

    /** Eintrag fortschreiben: die KI bündelt Zusammengehöriges in EINEM
     * Eintrag pro Thema und ersetzt dessen Text, statt Zeilen anzuhäufen. */
    async update(userId: string, id: string, content: string): Promise<CoachMemoryDto> {
      const trimmed = content.trim();
      if (trimmed.length < 2) {
        throw new AppError('bad_request', 'Memory content too short');
      }
      const row = await memoryRepo.update(userId, id, trimmed);
      if (!row) throw new AppError('not_found', 'Memory not found');
      return toDto(row);
    },

    async remove(userId: string, id: string): Promise<void> {
      const row = await memoryRepo.softDelete(userId, id);
      if (!row) throw new AppError('not_found', 'Memory not found');
    },

    /** "Alles vergessen" — der Nutzer behält die volle Kontrolle. */
    async removeAll(userId: string): Promise<number> {
      return memoryRepo.softDeleteAll(userId);
    },
  };
}
