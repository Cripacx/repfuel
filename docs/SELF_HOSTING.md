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

## Fertige Images (CI/CD) statt lokalem Build

Zwei getrennte Workflows:

- **CI** ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)): läuft
  bei jedem Push/PR (Tests, Typecheck, Lint) — baut **keine** Images.
- **Release** ([`.github/workflows/release.yml`](../.github/workflows/release.yml)):
  **manuell** ausgelöst (GitHub → Actions → „Release" → „Run workflow",
  Versions-Sprung `patch`/`minor`/`major` wählen). Läuft dieselben Checks,
  zieht dann den nächsten SemVer-Tag (z.B. `v1.3.0`) auf Basis des letzten
  Git-Tags, baut `ghcr.io/cripacx/repfuel` und `ghcr.io/cripacx/repfuel-ai-cli`
  — genau die Namen, die `docker-compose.yml` referenziert —, taggt sie mit
  `latest` und der neuen Version, und veröffentlicht ein GitHub-Release mit
  automatisch generierten Release-Notes (aus den Commits/PRs seit dem letzten
  Tag).

Auf dem VServer muss dadurch nichts kompiliert werden:

```bash
docker compose pull          # holt das zuletzt released Image von ghcr.io
docker compose up -d         # startet/aktualisiert die Container
```

Ein Update ist damit: einen Release auslösen, dann auf dem Server `git pull`
(für Compose-/Doku-Änderungen) plus die beiden Zeilen oben. Wer stattdessen
lokal bauen will (z.B. eigene Änderungen ohne Release): `docker compose up -d
--build`.

Hinweise:

- Die GHCR-Packages einmalig auf **public** stellen (GitHub → Repo → Packages
  → Package settings → Change visibility), sonst braucht der Server ein
  `docker login ghcr.io` mit einem Personal Access Token (`read:packages`).
- Auf eine konkrete Version pinnen statt `latest` zu folgen: in `docker-compose.yml`
  bzw. per `.env`-Override den Image-Tag auf die gewünschte SemVer-Version setzen
  (z.B. `1.3.0` — ohne führendes `v`, das steht nur am Git-Tag).

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

## nginx bei mehreren Services auf demselben Server

Laufen auf dem VServer noch andere Anwendungen, ist ein zentraler nginx als
Reverse-Proxy die übliche Lösung: er nimmt Port 80/443 entgegen und leitet
anhand des `Host`-Headers an den richtigen Dienst weiter — repfuel auf
`fit.example.com`, ein anderer Service auf `other.example.com`, beide auf
demselben Server, unterschiedliche Ports dahinter.

**1. repfuels Port nur lokal binden.** Im `app`-Service der
`docker-compose.yml` `ports: ['${PORT:-8080}:8080']` auf
`127.0.0.1:${PORT:-8080}:8080` ändern (oder `PORT` in der `.env` setzen und
in Compose entsprechend binden). Damit ist der Container nur über nginx
erreichbar, nicht direkt am offenen Port — jeder andere Service bekommt
analog einen eigenen, ebenfalls nur lokal gebundenen Port.

**2. nginx installieren und ein Server-Block pro Domain.**

```bash
sudo apt install nginx
```

`/etc/nginx/sites-available/repfuel.conf`:

```nginx
server {
    listen 80;
    server_name fit.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE-Stream des KI-Chats: Buffering aus, langer Read-Timeout —
    # sonst kommt die Antwort nur in Schüben oder bricht vorzeitig ab.
    location /api/v1/chat/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Für jeden weiteren Service eine eigene Datei mit eigenem `server_name` und
eigenem `proxy_pass`-Port anlegen, z.B.
`/etc/nginx/sites-available/other.conf` mit `server_name other.example.com;`
und `proxy_pass http://127.0.0.1:9000;`. Aktivieren und prüfen:

```bash
sudo ln -s /etc/nginx/sites-available/repfuel.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/other.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**3. HTTPS mit Certbot** (holt Zertifikate automatisch und richtet den
HTTP→HTTPS-Redirect ein — für alle konfigurierten `server_name`s in einem
Rutsch):

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d fit.example.com -d other.example.com
```

`.env`: `ORIGIN=https://fit.example.com` (muss exakt dem `server_name`
inkl. `https://` entsprechen — WebAuthn prüft das strikt).

**Alternative: nginx als Container statt auf dem Host.** Läuft alles
ohnehin in Docker, spart ein gemeinsames externes Netzwerk die
Port-Bindungen ganz: `docker network create edge`, repfuels
`docker-compose.yml` bekommt beim `app`-Service `networks: [edge]` plus
`networks: { edge: { external: true } }` auf Compose-Ebene (Port-Mapping
kann dann entfallen), der nginx-Container hängt ebenfalls in `edge` und
zeigt per `proxy_pass http://app:8080;` auf den Container-Namen statt auf
`127.0.0.1:<port>`. Für automatisches Multi-Domain-TLS ohne eigene
nginx-Configs eignet sich dafür
[`nginx-proxy` + `acme-companion`](https://github.com/nginx-proxy/nginx-proxy):
jeder Service bekommt nur `VIRTUAL_HOST=fit.example.com` und
`LETSENCRYPT_HOST=fit.example.com` als Environment-Variablen, den Rest
(vhost-Config + Zertifikat) erledigt der Companion automatisch — praktisch,
wenn regelmäßig neue Services dazukommen.

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
