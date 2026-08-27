import { z } from 'zod';
import { REGISTRATION_MODES } from '@repfuel/shared';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  /** Öffentliche Origin der App, z.B. https://fit.example.com — zwingend für WebAuthn. */
  ORIGIN: z.string().url().default('http://localhost:8080'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgres://repfuel:repfuel@localhost:5432/repfuel'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  REGISTRATION_MODE: z.enum(REGISTRATION_MODES).default('open'),
  /** Verzeichnis mit dem gebauten Frontend (SPA). Leer = kein Static-Serving (Dev). */
  STATIC_DIR: z.string().default(''),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.parse(env);
  const originUrl = new URL(parsed.ORIGIN);
  return {
    ...parsed,
    /** WebAuthn Relying Party ID = Hostname der Origin. */
    rpId: originUrl.hostname,
    rpName: 'repfuel',
    version: '0.1.0',
  };
}
