/**
 * Bildet den generischen `AI_API_KEY` auf die CLI-eigenen Auth-Variablen ab,
 * damit die .env mit einer einzigen Variable auskommt. Spezifische Variablen
 * (CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY, CODEX_API_KEY) gewinnen immer.
 *
 * claude: `claude setup-token` liefert OAuth-Tokens mit dem Präfix
 * `sk-ant-oat` — daran wird Abo-Auth von API-Key-Auth unterschieden.
 */
export function resolveCliAuthEnv(
  runtime: 'claude' | 'codex',
  env: Record<string, string | undefined>,
): Record<string, string> {
  const genericKey = env.AI_API_KEY?.trim();
  if (!genericKey) return {};

  if (runtime === 'claude') {
    if (env.CLAUDE_CODE_OAUTH_TOKEN || env.ANTHROPIC_API_KEY) return {};
    return genericKey.startsWith('sk-ant-oat')
      ? { CLAUDE_CODE_OAUTH_TOKEN: genericKey }
      : { ANTHROPIC_API_KEY: genericKey };
  }

  if (env.CODEX_API_KEY) return {};
  return { CODEX_API_KEY: genericKey };
}
