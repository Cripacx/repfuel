# KI über Claude Code (CLI-Adapter)

Der CLI-Adapter nutzt ein bestehendes Claude-Abo über die Claude-Code-CLI statt
eines API-Keys. Er läuft als eigener Container („Sidecar") neben der App und ist
nur im internen Compose-Netz erreichbar.

```
Browser ──▶ app (Fastify) ──POST /chat──▶ ai-cli (Sidecar, Claude Code)
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
AI_PROVIDER=cli

docker compose --profile cli-adapter up -d
```

Der Status ist unter **Einstellungen → KI-Coach** sichtbar
(„Verbunden" / „Nicht angemeldet") bzw. per `GET /api/v1/ai/status`.

## Die drei Auth-Wege

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

## Verhalten

- Pro repfuel-Chat-Session hält der Sidecar eine Claude-Code-Session
  (Gesprächskontext bleibt erhalten); nach ~10 Minuten Inaktivität wird sie
  verworfen und beim nächsten Turn frisch gestartet.
- Der Coach hat **nur** die repfuel-MCP-Tools — keine Datei-, Shell- oder
  Web-Tools.
- Schreibvorschläge (Routine/Profil) laufen wie bei allen Adaptern über den
  Bestätigungs-Flow im UI.

## Eigene Agenten anbinden (optional, für Fortgeschrittene)

Der MCP-Wrapper ist unter `/internal/mcp` erreichbar und verlangt ein
gültiges Token. Tokens werden derzeit nur intern pro Chat-Turn ausgestellt;
ein dauerhaftes per-User-API-Token (z.B. für Claude Desktop) ist als
Erweiterung vorgesehen, aber bewusst noch nicht aktiviert.
