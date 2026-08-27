# Implementierungsprompt: **repfuel** — Self-hosted Fitness- & Ernährungs-App mit KI-Chat

> Projektname: **repfuel** (immer kleingeschrieben: Repo `repfuel`, Package-Scope `@repfuel/*`,
> Docker-Image `ghcr.io/<owner>/repfuel`, PWA-Manifest-Name "repfuel").
> Diesen Prompt als Ausgangspunkt an Claude Code (oder einen anderen Coding-Agenten) geben.
> Empfohlen: Inhalt zusätzlich als `CLAUDE.md` ins Repo legen, damit die Konventionen
> in jeder Session gelten. Nicht alles auf einmal bauen lassen — siehe Meilensteine unten.

---

## Projektziel

Baue eine self-hostbare Open-Source-Webanwendung (AGPL-3.0), die Workout-Tracking und
Ernährungs-Tracking kombiniert und einen KI-Chat integriert, der per Tool-Calling
Zugriff auf die Daten des Nutzers hat (Mahlzeiten, Workouts, Gewicht, Ziele).

Zielgruppe: Homelab-/Selfhosting-Nutzer. Deployment-Versprechen: `docker compose up -d`
und die App läuft. Die App ist eine installierbare PWA (Home-Screen auf dem Handy)
und gleichzeitig normal im Browser nutzbar.

Referenzprojekte (nicht kopieren, aber als Vorbild für Patterns):
- **openGym** (gitlab.com/DuarteSantos8/opengym): PWA-Aufbau, Passkey-Auth, Offline-Sync, Docker-Setup
- **alexpcosta/opengym** (Fork): Opt-in-Design eines KI-Coach mit CLI-Anbindung (Claude Code / Codex)
- **wger** (github.com/wger-project/wger): Datenmodellierung für Trainingspläne und Ernährungstagebuch

## Tech Stack (feste Entscheidungen — nicht abweichen)

| Bereich | Entscheidung |
|---|---|
| Frontend | SvelteKit + TypeScript, **SPA-Modus** (`ssr = false`, `adapter-static`), `@vite-pwa/sveltekit` |
| Offline-Daten | IndexedDB via Dexie.js, Sync-Queue zum Server |
| Backend | Node.js + TypeScript, Fastify; liefert auch die statischen Frontend-Dateien aus |
| Datenbank | PostgreSQL, Drizzle ORM (Schema + Migrations) |
| Cache/Queue | Redis: Sessions, Rate-Limiting, SSE-Pub/Sub, Background-Jobs (BullMQ, z.B. Health-Ingest-Verarbeitung, OFF-Cache-Refresh) |
| i18n | Deutsch + Englisch von Anfang an; typsichere Message-Keys (z.B. typesafe-i18n oder Paraglide), Sprache aus Browser-Locale mit Override im Profil. Auch KI-Antworten in der Nutzersprache (Sprachhinweis im System-Prompt). |
| Auth | Passkeys (WebAuthn) via SimpleWebAuthn, Session-Cookies |
| KI | Adapter-Interface mit 3 Implementierungen: API (Vercel AI SDK), Ollama, CLI-Sidecar |
| Externe Daten | Open Food Facts API (Lebensmittel + Barcode), wger-Exercise-DB als einmaliger Seed |
| Charts | uPlot oder Chart.js |
| Deployment | Docker Compose: `app`, `db`, optional `ollama`, optional `ai-cli` (Compose-Profile) |
| Lizenz | AGPL-3.0 |
| Monorepo | pnpm workspaces: `apps/web`, `apps/server`, `apps/ai-cli-sidecar`, `packages/shared` (Scope `@repfuel/*`) |

## Architekturprinzipien

1. **Eine Service-Schicht, mehrere Clients.** Alle Geschäftslogik liegt in den
   Service-Schichten der Module (`apps/server/src/modules/<modul>/services/`).
   Die REST-API, die KI-Tools und der MCP-Server sind nur dünne Wrapper um dieselben
   Service-Funktionen. Keine Logik in Routen oder Tool-Definitionen.
2. **KI ist ein zweiter Client, kein Sonderfall.** Der Chat darf nichts können, was
   die REST-API nicht kann. Jede Schreiboperation der KI läuft durch dieselbe
   Validierung (zod-Schemas in `packages/shared`).
3. **Offline-first fürs Logging.** Workout-Sätze und Mahlzeiten werden immer zuerst
   in IndexedDB geschrieben (mit client-generierter UUID + Timestamp), dann über eine
   Sync-Queue an den Server gepusht. Konfliktstrategie: Last-Write-Wins pro Datensatz,
   Client-UUIDs verhindern Duplikate (Upsert per UUID).
4. **Der KI-Adapter ist austauschbar.** Backend-Code gegen das Interface programmieren,
   nie gegen einen konkreten Provider.
5. **KI ist strikt optional.** `AI_PROVIDER=none` ist der Default. Ohne konfigurierten
   Adapter ist die App voll funktionsfähig; Chat-Tab und alle KI-UI-Elemente werden
   ausgeblendet (Feature-Flag vom `GET /ai/status`-Endpoint). Kein Code-Pfad außerhalb
   des KI-Moduls darf einen Adapter voraussetzen.
6. **Multi-User ist Grundannahme.** Jede Query ist user-scoped (user_id aus der Session,
   nie aus dem Request-Body). Mehrere Nutzer teilen sich eine Instanz mit strikt
   getrennten Daten; es gibt eine Admin-Rolle (erster registrierter Nutzer wird Admin).
7. **Modular Monolith.** Der Server ist in klar geschnittene Module gegliedert
   (`modules/auth`, `modules/workout`, `modules/nutrition`, `modules/health`,
   `modules/ai`, `modules/admin`), jedes mit eigenem Ordner für routes/services/
   repositories/schema. Module kommunizieren **nur** über exportierte
   Service-Interfaces (öffentliche `index.ts` pro Modul), nie über Direktimporte
   in fremde Interna — per ESLint-Regel (import-Boundaries) erzwingen.
   Jedes Modul besitzt seine eigenen Drizzle-Tabellen; modulübergreifende Joins
   nur innerhalb eines dedizierten `modules/stats` (Read-Model). Ereignisse
   zwischen Modulen über einen internen Event-Bus (in-process, Redis-Pub/Sub-
   kompatible Abstraktion), damit eine spätere Extraktion einzelner Module zu
   Services ohne Umbau der Aufrufer möglich ist. Ein Deployment, ein Prozess —
   die Grenzen sind logisch, nicht physisch.

## Datenmodell (Drizzle-Schema, Kernfelder)

```
users            id, username, role ('admin'|'user'), created_at
invites          id, token, created_by, expires_at, used_by nullable, used_at nullable
health_metrics   id (client-uuid), user_id, metric ('steps'|'resting_hr'|'active_kcal'|
                 'sleep_minutes'|...), value numeric, measured_at, source ('apple_health'|
                 'manual'|'api'), unique(user_id, metric, measured_at, source)
credentials      id, user_id, webauthn public key data, counter
profiles         user_id, height_cm, birth_year, sex, activity_level,
                 goal (cut/maintain/bulk), kcal_target, protein_target_g,
                 carbs_target_g, fat_target_g
exercises        id, name, muscle_groups[], equipment, media_url, source ('wger'|'custom'), user_id nullable
routines         id, user_id, name, weekday nullable
routine_items    id, routine_id, exercise_id, position, superset_group nullable,
                 target_sets, target_reps, target_weight nullable
workouts         id (client-uuid), user_id, started_at, finished_at, routine_id nullable, notes
sets             id (client-uuid), workout_id, exercise_id, position, reps, weight_kg,
                 is_warmup, rpe nullable
foods            id, source ('off'|'custom'), off_barcode nullable, name, brand nullable,
                 kcal_per_100, protein_per_100, carbs_per_100, fat_per_100, user_id nullable
meals            id (client-uuid), user_id, eaten_at, meal_type (breakfast/lunch/dinner/snack),
                 food_id, amount_g   -- alternativ quick_kcal für Schnelleinträge
body_weight      id (client-uuid), user_id, measured_at, weight_kg
chat_sessions    id, user_id, adapter, created_at
chat_messages    id, session_id, role, content, tool_calls jsonb nullable, created_at
```

Regeln: Alle vom Client erzeugbaren Datensätze (workouts, sets, meals, body_weight)
haben client-generierte UUIDs. Alle Tabellen mit user_id bekommen einen Index darauf.
Löschungen sind Soft-Deletes (deleted_at) für sauberen Sync.

## KI-Schicht

### Adapter-Interface (`packages/shared`)

```ts
interface AIAdapter {
  chat(input: {
    sessionId: string;
    messages: ChatMessage[];
    tools: ToolSet;          // beim CLI-Adapter ignoriert, dort läuft es über MCP
    userContext: UserContextSnapshot; // kompakter Profil-Snapshot für den System-Prompt
  }): AsyncIterable<ChatChunk>;      // ChatChunk: text-delta | tool-call | tool-result | done | error
  healthCheck(): Promise<AdapterStatus>;
}
```

### Tools (identisch für alle Adapter, Implementierung = Service-Aufrufe)

- `get_meals({ from, to })`, `get_nutrition_summary({ from, to })` (Tageswerte + Ziel-Vergleich)
- `get_workouts({ from, to })`, `get_exercise_history({ exercise_id, limit })` (inkl. PRs)
- `get_weight_history({ from, to })`
- `get_profile()`
- `log_meal({ food_query | barcode | quick_kcal, amount_g, meal_type, eaten_at? })`
- `log_weight({ weight_kg, measured_at? })`
- `search_food({ query })` (erst lokale foods, dann Open Food Facts)
- `update_routine({ ... })`, `update_profile({ ... })` — **nur als Vorschlag**: Die KI
  erzeugt einen Änderungsentwurf, der Nutzer bestätigt im UI, bevor geschrieben wird.
  Reine Lese-Tools und einfache Log-Tools dürfen direkt ausgeführt werden.

### Klarstellung Tools vs. MCP

Die Tools sind **kein** MCP-Server per se. Die Wahrheit liegt in der Service-Schicht;
darüber gibt es zwei dünne Anbindungen: (a) AI-SDK-Tool-Definitionen für die Adapter
API/Ollama, (b) ein MCP-Server-Wrapper (nur für den CLI-Sidecar, intern erreichbar).
Beide rufen exakt dieselben Service-Funktionen auf. Optional (Config-Flag, default aus)
kann der MCP-Server auch extern exponiert werden, damit Nutzer eigene Agenten
(z.B. Claude Desktop) an ihre Instanz hängen — dann mit per-User-API-Token.

### Ziele (Feature, kein Chat-Command)

Ziel-Setzung ist ein normaler Screen: Formular für Zielgewicht/Zieldatum bzw.
Cut/Maintain/Bulk, daraus berechnete kcal-/Makro-Targets (Mifflin-St Jeor +
Aktivitätslevel). Die Berechnungslogik liegt als gemeinsame Funktion in
`packages/shared`. Der KI-Coach kann im normalen Gespräch dieselben Ziele
vorschlagen — über ein `update_profile`-Tool, das wie `update_routine` nur einen
Vorschlag erzeugt, den der Nutzer im UI bestätigt.

### System-Prompt des Coaches

Kompakt halten: aktuelles Datum + Zeitzone, Profil-Snapshot (Ziele, Targets),
Ein-Zeilen-Zusammenfassung verfügbarer Datenbereiche. Keine Rohdaten in den
System-Prompt kippen — die KI holt sich Daten per Tool. Regel im Prompt verankern:
Fehlende Mahlzeiten-Logs nie als Fasten oder Defizit interpretieren.

### Modell-Konfiguration (provider-neutral, keine Empfehlungen verdrahten)

Zwei Modell-Slots in der Config: `AI_MODEL` (Coach) und optional `AI_MODEL_LIGHT`
(Fallback = AI_MODEL) für billige Hilfsaufgaben: Chat-Titel generieren,
Freitext-Mahlzeit in einen strukturierten Log-Vorschlag parsen („2 Eier und eine
Scheibe Vollkornbrot" → food_query + amount_g) und Zusammenfassen alter
Chat-Verläufe für das Session-Memory. Keine Modellnamen im Code hart verdrahten;
Beispiele nur in der Doku. Foto-basiertes Mahlzeiten-Logging (Vision) ist V1.5
hinter einem Feature-Flag, nicht V1.

### Adapter 1: API (Vercel AI SDK)

Provider per env: `AI_PROVIDER=anthropic|openai|openrouter`, `AI_API_KEY`, `AI_MODEL`.
Streaming über die AI-SDK-Streams, Tool-Calling nativ. Antworten per SSE ans Frontend.

### Adapter 2: Ollama

Gleicher Codepfad wie Adapter 1 über die OpenAI-kompatible Ollama-API
(`AI_PROVIDER=ollama`, `AI_BASE_URL=http://ollama:11434/v1`). Im Compose als
optionales Profil `ollama`. Capability-Check einbauen: Wenn das konfigurierte
Modell kein Tool-Calling beherrscht, klare Fehlermeldung in `/ai/status`
statt stiller Degradation.

### Adapter 3: CLI-Sidecar (Claude Code / Codex)

- Eigenes Image `apps/ai-cli-sidecar`: Node + Claude Code CLI (und optional Codex CLI).
- Compose-Profil `cli-adapter`; Volume-Mounts `~/.claude` bzw. `~/.codex` für Host-Logins.
- Sidecar exponiert intern (nur im Compose-Netz) eine kleine HTTP-API:
  `POST /chat` (SSE-Stream), `GET /health` (prüft Auth-Status per Test-Aufruf).
- Implementierung über das Claude Agent SDK (TypeScript); Sessions pro Chat halten
  (resume/Session-ID), Idle-Timeout ~10 min, dann Prozess beenden.
- Tools: Das Backend exponiert die o.g. Tools zusätzlich als **MCP-Server**
  (nur intern erreichbar, mit pro Chat-Session ausgestelltem, kurzlebigem Token,
  das den user-Kontext trägt). Der Sidecar bindet diesen MCP-Server beim
  Agenten-Start ein. So gibt es keine zweite Tool-Implementierung.
- Auth-Wege dokumentieren: (a) Host-Login gemountet, (b) einmalig
  `docker compose exec ai-cli claude login`, (c) `claude setup-token` →
  `CLAUDE_CODE_OAUTH_TOKEN` in `.env` (empfohlener Weg für Headless-Server).
- Settings-UI zeigt Adapter-Status über `healthCheck()` an
  („Verbunden" / „Nicht angemeldet" + Link zur Anleitung).

## PWA-Anforderungen

- Manifest (Name, Icons inkl. maskable, Theme-Color), Installierbarkeit auf Android + iOS.
- Service Worker: App-Shell precachen; Navigation offline aus Cache; API-Requests
  network-first mit Fallback auf IndexedDB-Daten.
- Die Logging-Flows (Satz eintragen, Mahlzeit eintragen, Gewicht eintragen) müssen
  komplett offline funktionieren. Chat und Food-Suche dürfen online-only sein
  (offline sauber deaktiviert mit Hinweis).
- Mobile-first UI: Workout-Logging-Screen für Bedienung zwischen zwei Sätzen
  optimieren (große Touch-Targets, letzte Gewichte vorausgefüllt, Rest-Timer).

## Registrierung & Admin-Panel (schmal halten)

Registrierungsmodus per Config (`REGISTRATION_MODE=open|invite`, in DB
überschreibbar durch Admin):

- `open` — jeder kann sich registrieren (Default für den Erstlauf, bis ein Admin existiert).
- `invite` — Registrierung nur mit gültigem Invite-Link (`/register?invite=<token>`).
  Deckt auch den "Admin legt Nutzer an"-Fall ab: Der Admin erzeugt im Panel einen
  Invite (optional mit vorgegebenem Username), über den der Nutzer seinen Passkey
  selbst registriert — der Admin sieht nie Credentials.

Admin-Panel als einzelne Route `/admin` (nur role=admin): Nutzerliste (anlegen,
deaktivieren, löschen), Invite-Links erzeugen/widerrufen (mit Ablaufdatum),
Registrierungsmodus umschalten, Instanz-Status (Version, KI-Adapter-Status).
Bootstrap-Regel: Der erste registrierte Nutzer wird automatisch Admin, danach
springt der Modus auf den konfigurierten Wert.

## Health-Daten-Import (Apple Health & Co.)

Eine PWA hat keinen direkten HealthKit-/Health-Connect-Zugriff. Stattdessen:
generischer Ingest-Endpoint `POST /api/v1/ingest/health` (Auth per pro-User
generiertem API-Token, nicht Session-Cookie), der Batches von Metriken entgegennimmt
und idempotent in `health_metrics` upsertet. Dokumentierter Weg für iOS: die App
„Health Auto Export" (JSON-REST-Export an eigene URL, konfigurierbares Intervall);
Payload-Format dieser App als erstes unterstütztes Schema parsen, zusätzlich ein
eigenes simples Schema dokumentieren. Gewicht aus Apple Health wird zusätzlich in
`body_weight` gespiegelt (source-Feld verhindert Duplikate mit manuellen Einträgen).
Schritte/Ruhepuls/aktive kcal erscheinen im Dashboard und stehen der KI über ein
Tool `get_health_metrics({ metric, from, to })` zur Verfügung.

## API-Design (Auszug)

REST unter `/api/v1`, Auth per Session-Cookie, zod-Validierung aus `packages/shared`:

```
POST /auth/register-options | /auth/register | /auth/login-options | /auth/login | /auth/logout
GET/POST/PATCH /routines, /routines/:id/items
POST /sync/batch            -- Upsert-Batch für offline erzeugte workouts/sets/meals/body_weight
GET  /stats/nutrition?from&to
GET  /stats/strength?exercise_id
GET  /foods/search?q= | GET /foods/barcode/:code
POST /chat/sessions | POST /chat/sessions/:id/messages (SSE-Response)
GET  /ai/status
GET/POST /admin/users | POST /admin/invites | PATCH /admin/settings
POST /ingest/health   -- API-Token-Auth, Batch-Upsert
GET  /stats/health?metric&from&to
```

## Docker & Konfiguration

- Multi-stage Dockerfile für `app` (Frontend-Build → statisch ins Server-Image).
- Image-Namen: `ghcr.io/<owner>/repfuel` (App) und `ghcr.io/<owner>/repfuel-ai-cli` (Sidecar).
- PWA-Manifest: name "repfuel", short_name "repfuel", eigenes Icon (Platzhalter ok,
  maskable-Variante nicht vergessen).
- `docker-compose.yml`: `app` + `db` + `redis` (Standard), `ollama` und `ai-cli` als Profile.
- `.env.example` mit allen Variablen und Kommentaren: `DATABASE_URL`, `ORIGIN`
  (für WebAuthn zwingend), `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`,
  `CLAUDE_CODE_OAUTH_TOKEN`.
- Migrations laufen automatisch beim App-Start (drizzle-kit migrate).
- Seed-Script für die Übungsbibliothek (wger-Export einmalig importieren,
  Lizenzhinweis in den Docs).
- Doku: `docs/SELF_HOSTING.md` mit Caddy-Reverse-Proxy-Beispiel (HTTPS ist
  Voraussetzung für Passkeys + PWA-Install).

## Meilensteine (in dieser Reihenfolge bauen, nach jedem Meilenstein: lauffähig + committen)

1. **M1 Fundament:** Monorepo, Modulstruktur + ESLint-Import-Boundaries,
   Fastify + Drizzle + Postgres + Redis im Compose (Redis-Sessions), Health-Endpoint,
   SvelteKit-SPA wird vom Server ausgeliefert, i18n-Grundgerüst (de/en, typsichere Keys,
   Sprachumschalter). Passkey-Registrierung + Login,
   Admin-Bootstrap, Registrierungsmodi + Invite-Links, minimales /admin-Panel.
2. **M2 Workout-Kern:** Übungs-Seed, Routinen-CRUD, Workout-Logging-Flow (online),
   Gewichts-Tracking mit Chart.
3. **M3 Ernährungs-Kern:** Food-Suche (Open Food Facts + Cache in `foods`),
   Barcode-Scan (BarcodeDetector, Fallback zxing-js), Mahlzeiten-Logging,
   Ziele-Screen (Formular + Berechnungslogik in `packages/shared`),
   Tages-Dashboard kcal/Makros vs. Ziele.
4. **M4 Offline/PWA:** Dexie-Layer, Sync-Queue + `/sync/batch`, Service Worker,
   Manifest, Install-Test auf Android und iOS.
5. **M5 KI API-Adapter:** Adapter-Interface, Tools, Chat-UI mit SSE-Streaming,
   Bestätigungs-Flow für Schreib-Vorschläge (update_routine/update_profile),
   Ollama-Support.
6. **M6 CLI-Sidecar:** Sidecar-Image, MCP-Server im Backend, Claude-Code-Anbindung,
   Auth-Statusanzeige, Doku der drei Auth-Wege.
7. **M7 Health-Ingest + Polish:** `/ingest/health` mit API-Tokens, Health-Auto-Export-
   Schema, Dashboard-Kacheln für Schritte/Ruhepuls, `get_health_metrics`-Tool.
   Statistiken (PRs, Wochentrends), Datenexport (JSON), Soft-Delete-Sync,
   README + Self-Hosting-Doku, Screenshots.

## Nicht-Ziele für V1 (nicht bauen, auch nicht vorbereiten)

Kein Sleep-/Mood-Tracking, keine Wearable-Integrationen (außer Health-Ingest-Endpoint),
keine Familien-/Coach-Freigaben, keine native App, keine Microservices (Modular
Monolith, ein Prozess), keine weiteren Sprachen außer Deutsch und Englisch.

## Konventionen

- TypeScript strict, ESLint + Prettier, keine `any`.
- Jede Service-Funktion mit Unit-Test (Vitest); API-Flows mit wenigen Integration-Tests
  gegen eine Test-DB (testcontainers oder Compose-Test-DB).
- Conventional Commits. Kleine PR-große Schritte, nach jedem Meilenstein lauffähig.
- Keine Secrets im Repo; alles über `.env`.
