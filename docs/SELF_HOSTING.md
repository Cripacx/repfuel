# Self-Hosting

repfuel ist für den Betrieb hinter einem Reverse-Proxy mit HTTPS gedacht.
**HTTPS ist Voraussetzung** für Passkeys (WebAuthn) und die PWA-Installation —
nur `http://localhost` funktioniert ohne.

## Compose-Basis

```bash
git clone https://github.com/Cripacx/repfuel.git
cd repfuel
cp .env.example .env
# .env anpassen (mindestens ORIGIN und POSTGRES_PASSWORD!)
docker compose up -d
```

Services: `app` (Fastify + SPA, Port 8080), `db` (Postgres 17), `redis`
(Sessions/Cache). Optional per Profil: `ollama` (lokales LLM) und
`ai-cli` (Claude-Code-Sidecar, siehe [AI_CLI.md](AI_CLI.md)).
Postgres und Redis sind bewusst **nicht** auf dem Host exponiert.

Wichtige `.env`-Werte:

| Variable | Bedeutung |
|---|---|
| `ORIGIN` | Öffentliche URL, z.B. `https://fit.example.com` — muss exakt stimmen (WebAuthn) |
| `POSTGRES_PASSWORD` | DB-Passwort (muss zur `DATABASE_URL` passen) |
| `REGISTRATION_MODE` | `open` oder `invite` (im Admin-Panel umschaltbar) |
| `AI_PROVIDER` | `none` (Default) — KI komplett aus |

## Caddy als Reverse-Proxy (empfohlen)

Caddy besorgt und erneuert TLS-Zertifikate automatisch. `Caddyfile`:

```caddyfile
fit.example.com {
    reverse_proxy localhost:8080
}
```

Als Container im selben Compose (Auszug):

```yaml
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config

volumes:
  caddy-data:
  caddy-config:
```

`Caddyfile` zeigt dann auf den App-Service:

```caddyfile
fit.example.com {
    reverse_proxy app:8080
}
```

In der `.env`: `ORIGIN=https://fit.example.com`. Das Port-Mapping
`8080:8080` des `app`-Service kann entfallen, wenn nur Caddy von außen
erreichbar sein soll.

SSE (KI-Chat) funktioniert mit Caddy out of the box; bei nginx
`proxy_buffering off;` für `/api/v1/chat/` setzen.

## Erstlauf & Nutzerverwaltung

1. `https://fit.example.com` öffnen → registrieren (Passkey empfohlen,
   Passwort möglich). Der **erste Nutzer wird Admin**.
2. Danach im Admin-Panel (`/admin`): Registrierungsmodus auf `invite`
   stellen, Invite-Links mit Ablaufdatum erzeugen, Nutzer verwalten.
3. PWA installieren: „Zum Home-Bildschirm hinzufügen" (iOS Safari) bzw.
   Installations-Prompt (Android Chrome).

## Updates & Backups

```bash
git pull
docker compose build app
docker compose up -d          # Migrationen laufen beim Start automatisch
```

Backup: das Volume `db-data` (Postgres) sichern, z.B.

```bash
docker compose exec db pg_dump -U repfuel repfuel > backup.sql
```

Zusätzlich kann jeder Nutzer seine Daten im UI als JSON exportieren
(Einstellungen → Datenexport).
