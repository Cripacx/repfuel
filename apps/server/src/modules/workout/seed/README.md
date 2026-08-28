# Übungsbibliothek-Seed (exercises-dataset)

## Quelle

`gymvisual-exercises.json` ist ein Snapshot der **Datenschicht** von
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
— demselben Datensatz, den auch [openGym](https://github.com/alexpcosta/opengym)
verwendet (dort via `scripts/fetch-media.sh` bzw. den `media`-Service in
`docker-compose.yml`).

- **Snapshot-Datum:** 2026-08-28
- **Anzahl Übungen:** 1324 (alle Einträge des Datensatzes)
- **Sprachen:** der Datensatz führt Anleitungen in en/es/it/tr/ru/zh/hi/pl/ko/fr
  — **kein Deutsch**. `nameDe` bleibt für diese Übungen daher `null`.
- **Anleitungen:** `instructions` enthält die englischen Schritt-Anleitungen
  (`instruction_steps.en` des Datensatzes). Sie gehören zur MIT-Datenschicht
  und werden beim Seed per Upsert auch in Bestandsinstallationen nachgezogen.

## Lizenz — zwei getrennte Ebenen

Der Datensatz trennt Daten und Medien strikt. Das ist hier wichtig, weil
repfuel öffentlich und unter AGPL-3.0 liegt.

### 1. Daten — MIT, unbedenklich

Namen, Muskelgruppen, Equipment, Body-Part und Anleitungen stehen unter der
**MIT-Lizenz** (© 2026 Hasan Emir Yıldırım). Nur diese Ebene ist in
`gymvisual-exercises.json` enthalten und wird mit diesem Repo ausgeliefert.

### 2. Medien — © Gym visual, NICHT MIT

Die Thumbnails (`images/`) und Animationen (`videos/`) sind **Eigentum von
[Gym visual](https://gymvisual.com/)** und im Quell-Repo nur aufgrund einer
gesonderten schriftlichen Genehmigung des Rechteinhabers enthalten. Die
LICENSE dort sagt ausdrücklich:

> Cloning this repository does not grant you any license to the media; obtain
> your own from Gym visual.

Daraus folgt für repfuel:

- **Die Medien liegen nicht in diesem Repo und nicht im Docker-Image.** Der
  Snapshot referenziert nur Dateinamen (`0001-2gPfomN.jpg`).
- Den Download macht der **Self-Hoster auf der eigenen Maschine**: der
  einmalige Compose-Service `exercise-media` klont den Datensatz in das Volume
  `media-data`. Der Server liefert es aus `MEDIA_DIR` unter `/media` aus.
- **Auflösung 180×180 bleibt unverändert**, es wird nicht hochskaliert.
- **Die Attribution `© Gym visual — https://gymvisual.com/` muss bei jeder
  Anzeige sichtbar bleiben.** Sie liegt als `EXERCISE_MEDIA_ATTRIBUTION` in
  `packages/shared` und wird in der Übungsauswahl angezeigt. Diesen Hinweis
  nicht entfernen.

Wer die Medien in einem eigenen Projekt nutzen will, prüft die
[Terms & Conditions von Gym visual](https://gymvisual.com/content/3-terms-and-conditions-of-use)
und holt bei Bedarf eine eigene Lizenz ein.

## Datenformat

```json
{
  "datasetId": "0001",
  "name": "3/4 Sit-Up",
  "muscleGroups": ["Abs", "Hip Flexors", "Lower Back"],
  "equipment": "Body Weight",
  "image": "0001-2gPfomN.jpg",
  "gif": "0001-2gPfomN.gif"
}
```

- `datasetId` ist die vierstellige ID des Datensatzes und der Konfliktschlüssel
  für den idempotenten Seed (`exercises.dataset_id`).
- `muscleGroups` = `target` (primär, immer an Position 0) gefolgt von
  `secondary_muscles`, dedupliziert und in Title Case.
- `image`/`gif` sind reine Dateinamen; die öffentlichen URLs entstehen im Seed
  als `/media/img/<image>` bzw. `/media/gif/<gif>`.
- Sortiert nach `datasetId` (die API sortiert für die Anzeige nach `name`).

## Verwendung

`seed-exercises.ts` exportiert `seedExercises(db: Database): Promise<number>`.
Sie liest die JSON zur Laufzeit relativ zur eigenen Modul-URL
(`new URL('./gymvisual-exercises.json', import.meta.url)`) und fügt die
Übungen idempotent ein (`onConflictDoNothing` auf `exercises.dataset_id`,
`source='gymvisual'`, `userId=null`). Der Rückgabewert ist die Anzahl der
Übungen im Snapshot, nicht die Anzahl tatsächlich neu eingefügter Zeilen.

**Build:** `tsc` kopiert keine `.json`-Dateien nach `dist/`. Das build-Script
in `apps/server/package.json` kopiert `gymvisual-exercises.json` deshalb
explizit mit.

## wger-Altbestand

Bis M7 kam die Bibliothek aus der wger-Datenbank (862 Übungen, CC-BY-SA 4.0,
nur 273 davon mit Bild). Migration `0006` entfernt die globalen wger-Übungen
wieder — aber **nur solche, auf die keine Routinen oder Sätze zeigen**.
Referenzierte Zeilen bleiben mit `source='wger'` erhalten, damit keine
Nutzerdaten verloren gehen (`routine_items` hängt per `ON DELETE CASCADE` an
`exercises`). Für diesen Altbestand gilt weiterhin die
CC-BY-SA-4.0-Attribution des [wger-Projekts](https://wger.de).

## Snapshot neu generieren

`gen-seed.mjs` in diesem Ordner erzeugt die JSON aus dem Rohdatensatz:

```bash
curl -sL -o exercises.json \
  https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json
node gen-seed.mjs
```

Das Skript liest `exercises.json` (~17 MB, enthält zusätzlich die Anleitungen
in 10 Sprachen) aus dem aktuellen Verzeichnis und schreibt
`exercises.seed.json`. Ergebnis nach `gymvisual-exercises.json` kopieren und
Snapshot-Datum/Anzahl oben aktualisieren. Die Rohdatei selbst gehört nicht ins
Repo.
