# KI über lokale CLIs (claude-local / codex-local)

Der CLI-Adapter nutzt ein bestehendes Abo über eine lokal laufende
Coding-Agent-CLI statt eines API-Keys — wahlweise **Claude Code**
(`AI_PROVIDER=claude-local`, Anthropic-Abo) oder die **Codex CLI**
(`AI_PROVIDER=codex-local`, ChatGPT-Abo oder OpenAI-Key). Beide laufen im
selben Sidecar-Container neben der App, nur im internen Compose-Netz
erreichbar. `AI_PROVIDER=cli` bleibt als Alias für `claude-local` gültig.

```
Browser ──▶ app (Fastify) ──POST /chat──▶ ai-cli (Sidecar: Claude Code ODER Codex)
                 ▲                             │
                 └──── MCP (kurzlebiges Token) ┘
```

Die Tools des Coaches (Mahlzeiten, Workouts, Gewicht, Ziele …) stellt das
Backend als **MCP-Server** bereit. Pro Chat-Nachricht wird ein kurzlebiges
Token ausgestellt, das den Nutzer-Kontext trägt — der Sidecar sieht nie
Credentials oder fremde Daten, und es gibt keine zweite Tool-Implementierung.

## Aktivieren

```bash
# .env:
AI_PROVIDER=claude-local     # oder: codex-local
AI_MODEL=                    # optional, siehe „Modellwahl"

docker compose --profile cli-adapter up -d
```

Der Status ist im **Profil-Tab** (Abschnitt KI) sichtbar
(„Verbunden" / „Nicht angemeldet") bzw. per `GET /api/v1/ai/status`.

## Modellwahl

`AI_MODEL` wählt das Modell der jeweiligen CLI; leer = der Default der CLI.

| Provider | `AI_MODEL`-Beispiele |
|---|---|
| `claude-local` | `opus`, `sonnet` oder eine volle ID wie `claude-opus-5` |
| `codex-local` | `gpt-5.2-codex`, `o4-mini` — was `codex -m` akzeptiert |

`AI_MODEL_LIGHT` ist für künftige Hilfsaufgaben reserviert und wird von den
CLI-Providern derzeit nicht genutzt.

## Auth: Claude Code (claude-local)

### 1. `claude setup-token` → `.env` (empfohlen für Headless-Server)

Auf einem beliebigen Rechner, auf dem du bei Claude angemeldet bist:

```bash
claude setup-token
```

Den ausgegebenen Token in die `.env` des Servers eintragen:

```
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat...
```

Danach `docker compose --profile cli-adapter up -d` (neu) starten.

### 2. Host-Login mounten

Wenn der Docker-Host selbst ein Claude-Code-Login besitzt (`~/.claude`),
in `docker-compose.yml` beim Service `ai-cli` das Volume einkommentieren:

```yaml
volumes:
  - ~/.claude:/root/.claude
```

### 3. Einmalig im Container anmelden

```bash
docker compose exec ai-cli npx @anthropic-ai/claude-code login
```

Der Login landet im Container-Dateisystem und übersteht `restart`,
aber kein `docker compose down` ohne Volume — für dauerhafte Setups
Weg 1 oder 2 verwenden.

## Auth: Codex CLI (codex-local)

### 1. API-Key in der `.env` (einfachster Weg)

```
CODEX_API_KEY=sk-…
```

Der Sidecar reicht den Key als `OPENAI_API_KEY` an die Codex CLI durch
(Abrechnung über die OpenAI-API).

### 2. ChatGPT-Abo: Host-Login mounten

Auf dem Docker-Host einmal `codex login` ausführen (öffnet den
ChatGPT-Login) und in `docker-compose.yml` beim Service `ai-cli` das Volume
einkommentieren:

```yaml
volumes:
  - ~/.codex:/root/.codex
```

### 3. Einmalig im Container anmelden

```bash
docker compose exec ai-cli codex login --api-key sk-…
```

Wie beim Claude-Login gilt: übersteht `restart`, aber kein
`docker compose down` ohne Volume.

## Verhalten

- Pro repfuel-Chat-Session hält der Sidecar eine CLI-Session (Claude-Code-
  Session bzw. Codex-Thread — Gesprächskontext bleibt erhalten); nach ~10
  Minuten Inaktivität wird sie verworfen und beim nächsten Turn frisch
  gestartet.
- Bei `codex-local` läuft die CLI mit `--sandbox read-only`; der System-
  Prompt wird beim ersten Turn dem Prompt vorangestellt (Codex kennt keinen
  separaten System-Prompt-Kanal).
- Der Coach hat **nur** die repfuel-MCP-Tools — keine Datei-, Shell- oder
  Web-Tools.
- Schreibvorschläge (Routine/Profil) laufen wie bei allen Adaptern über den
  Bestätigungs-Flow im UI.

## Eigene Agenten anbinden (optional, für Fortgeschrittene)

Der MCP-Wrapper ist unter `/internal/mcp` erreichbar und verlangt ein
gültiges Token. Tokens werden derzeit nur intern pro Chat-Turn ausgestellt;
ein dauerhaftes per-User-API-Token (z.B. für Claude Desktop) ist als
Erweiterung vorgesehen, aber bewusst noch nicht aktiviert.
