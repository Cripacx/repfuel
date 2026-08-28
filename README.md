# repfuel

**Self-hosted Fitness- & Ernährungs-Tracking mit optionalem KI-Coach.**
Deine Daten, dein Server. AGPL-3.0.

repfuel kombiniert Workout-Tracking (Routinen, Sätze, Rest-Timer, PRs) und
Ernährungs-Tracking (Open Food Facts, Barcode-Scan, kcal-/Makro-Ziele) in einer
installierbaren PWA — offline-first fürs Logging, Multi-User mit strikt
getrennten Daten, und einem KI-Coach, der per Tool-Calling auf deine eigenen
Daten zugreift (API, Ollama oder dein Claude-Abo via CLI — strikt optional).

| | | |
|---|---|---|
| ![Workout-Logging](docs/screenshots/shot-logging.png) | ![Ernährung](docs/screenshots/shot-nutrition.png) | ![KI-Coach](docs/screenshots/shot-chat.png) |
| ![Login](docs/screenshots/shot-login.png) | ![Gewicht](docs/screenshots/shot-weight.png) | |

## Features

- **Workouts:** Routinen mit Supersets & Zielvorgaben, 862 Übungen aus der
  wger-Datenbank (mit Bildern), Logging-Screen für die Bedienung zwischen zwei
  Sätzen (Stepper, letzte Gewichte vorausgefüllt, Rest-Timer), PRs & Wochentrends.
- **Ernährung:** Lebensmittelsuche (Open Food Facts + lokaler Cache),
  Barcode-Scan (Kamera, mit manueller Eingabe als Fallback), Quick-kcal,
  Tages-Dashboard kcal/Protein/Carbs/Fett vs. Ziele, Zielberechnung
  (Mifflin-St Jeor).
- **Gewicht & Health:** Gewichtsverlauf mit Chart, Apple-Health-Import über
  die App „Health Auto Export" (Schritte, Ruhepuls, aktive kcal, Schlaf, Gewicht).
- **Offline-first PWA:** Sätze, Mahlzeiten und Gewicht landen zuerst in
  IndexedDB und syncen automatisch; installierbar auf Android & iOS.
- **KI-Coach (opt-in):** Chat mit Streaming und echten Daten-Tools.
  Provider frei wählbar: Anthropic/OpenAI/OpenRouter per API-Key, lokales
  Ollama, oder dein Claude-Abo über die Claude-Code-CLI. Schreibaktionen
  (Routine/Ziele ändern) immer nur als Vorschlag mit Bestätigung im UI.
- **Multi-User:** Passkeys (empfohlen) + Passwort-Login, Invite-Links,
  Admin-Panel, erster Nutzer wird automatisch Admin.
- **Deine Daten:** kompletter JSON-Export mit einem Klick.

## Quickstart

Voraussetzungen: Docker + Docker Compose.

```bash
git clone https://github.com/Cripacx/repfuel.git
cd repfuel
cp .env.example .env
docker compose up -d
```

Dann http://localhost:8080 öffnen und den ersten Nutzer registrieren
(wird automatisch Admin). Migrationen und der Übungs-Seed laufen beim
Start automatisch.

> **Wichtig:** Für den Betrieb unter eigener Domain `ORIGIN` in der `.env`
> exakt auf die öffentliche URL setzen — Passkeys (WebAuthn) und die
> PWA-Installation brauchen HTTPS (außer auf `localhost`).
> Reverse-Proxy-Beispiel: [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## KI-Coach aktivieren (optional)

Ohne Konfiguration ist die KI komplett deaktiviert (`AI_PROVIDER=none`) und
die App voll funktionsfähig. Drei Wege:

```bash
# 1. API-Provider (Anthropic/OpenAI/OpenRouter)
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-…
AI_MODEL=claude-opus-5          # Beispiel — beliebige Modell-ID des Providers

# 2. Lokales Ollama (Modell muss Tool-Calling können)
AI_PROVIDER=ollama
AI_BASE_URL=http://ollama:11434/v1
AI_MODEL=qwen3
# → docker compose --profile ollama up -d

# 3. Claude-Abo über die Claude-Code-CLI (kein API-Key nötig)
AI_PROVIDER=cli
CLAUDE_CODE_OAUTH_TOKEN=…       # von `claude setup-token`
# → docker compose --profile cli-adapter up -d
```

Details zum CLI-Adapter und den Auth-Wegen: [docs/AI_CLI.md](docs/AI_CLI.md).

## Apple-Health-Import

In den Einstellungen ein API-Token erzeugen und in der iOS-App
[Health Auto Export](https://www.healthyapps.dev/) einen REST-Export
einrichten: URL `https://<host>/api/v1/ingest/health`, Header
`Authorization: Bearer <token>`, Format JSON. Schritte, Ruhepuls, aktive
kcal und Schlaf erscheinen im Dashboard; Gewicht fließt zusätzlich in den
Gewichtsverlauf. Details: [docs/HEALTH_IMPORT.md](docs/HEALTH_IMPORT.md).

## Entwicklung

Voraussetzungen: Node ≥ 22, pnpm ≥ 10, Postgres + Redis (lokal oder per Docker).

```bash
pnpm install
pnpm --filter @repfuel/shared build
pnpm db:migrate          # DATABASE_URL zeigt auf deine Postgres
pnpm dev                 # Server :8080 + Vite-Dev-Server mit /api-Proxy
pnpm test                # Vitest (shared + server + web)
pnpm typecheck && pnpm lint
```

Monorepo-Struktur: `apps/server` (Fastify, Modular Monolith),
`apps/web` (SvelteKit-SPA/PWA), `apps/ai-cli-sidecar` (Claude-Code-Sidecar),
`packages/shared` (zod-Contracts, Zielberechnung). Architektur-Leitplanken
stehen in [CLAUDE.md](CLAUDE.md) und [IMPLEMENTIERUNGSPROMPT.md](IMPLEMENTIERUNGSPROMPT.md).

## Danksagungen & Datenquellen

- Übungsbibliothek: [wger](https://github.com/wger-project/wger)-Exercise-DB,
  Lizenz [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) —
  Übungsdaten © wger-Community.
- Lebensmitteldaten: [Open Food Facts](https://openfoodfacts.org),
  [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).
- Inspiration: [openGym](https://github.com/arvids-unavailable/openGym), wger.

## Lizenz

[AGPL-3.0](LICENSE)
