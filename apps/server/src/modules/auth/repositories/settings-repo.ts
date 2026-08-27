import { eq } from 'drizzle-orm';
import type { Database } from '../../../core/db.js';
import { appSettings } from '../schema.js';

export interface SettingsRepo {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
}

export function createSettingsRepo(db: Database): SettingsRepo {
  return {
    async get(key) {
      const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
      return rows[0]?.value ?? null;
    },
    async set(key, value) {
      await db
        .insert(appSettings)
        .values({ key, value })
        .onConflictDoUpdate({ target: appSettings.key, set: { value } });
    },
  };
}
