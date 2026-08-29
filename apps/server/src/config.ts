import { z } from 'zod';
import { AI_PROVIDERS, REGISTRATION_MODES } from '@repfuel/shared';

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
  /**
   * Verzeichnis mit den Übungsmedien (Unterordner img/ und gif/), ausgeliefert
   * unter /media. Die Medien liegen bewusst nicht im Repo/Image — sie werden
   * einmalig vom Self-Hoster geladen (siehe docker-compose.yml).
   * Leer = kein Media-Serving, Übungen werden ohne Bild angezeigt.
   */
  MEDIA_DIR: z.string().default(''),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** KI ist strikt optional: none = Chat und alle KI-Features deaktiviert. */
  AI_PROVIDER: z.enum(AI_PROVIDERS).default('none'),
  AI_API_KEY: z.string().default(''),
  /** Coach-Modell (Provider-spezifische Modell-ID; keine Defaults im Code). */
  AI_MODEL: z.string().default(''),
  /** Optionales Billig-Modell für Hilfsaufgaben (Fallback: AI_MODEL). */
  AI_MODEL_LIGHT: z.string().default(''),
  /** Für ollama/openrouter bzw. OpenAI-kompatible Endpunkte. */
  AI_BASE_URL: z.string().default(''),
  /** CLI-Sidecar (AI_PROVIDER=cli): HTTP-Endpunkt im Compose-Netz. */
  AI_SIDECAR_URL: z.string().default('http://ai-cli:8090'),
  /** URL, unter der der Sidecar den MCP-Wrapper dieses Servers erreicht. */
  AI_MCP_URL: z.string().default('http://app:8080/internal/mcp'),
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
