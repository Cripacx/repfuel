# Übungsbibliothek-Seed (wger Exercise Database)

## Quelle

Die Datei `wger-exercises.json` ist ein Snapshot der öffentlichen
[wger](https://wger.de) Exercise Database, abgefragt über die öffentliche
API `GET https://wger.de/api/v2/exerciseinfo/` (kein API-Key nötig).

- **Snapshot-Datum:** 2026-08-27
- **Anzahl Übungen:** 862 (alle zum Zeitpunkt des Abrufs verfügbaren
  Übungen mit einem englischsprachigen Namen; `count` laut wger-API zum
  Snapshot-Zeitpunkt: 862)

## Lizenz / Attribution

Die Übungsdaten (Namen, Muskelgruppen, Equipment, Bilder) stehen unter der
**Creative Commons Attribution-ShareAlike 4.0 International License
(CC-BY-SA 4.0)**: https://creativecommons.org/licenses/by-sa/4.0/

Quelle und Autoren: **wger Project** (https://wger.de,
https://github.com/wger-project/wger), einzelne Übungen tragen zusätzlich
individuelle Autor:innen-Angaben (`license_author` im API-Response), die im
Snapshot hier nicht mitgeführt werden. Bei Weiterverbreitung/Anzeige der
Daten ist auf das wger-Projekt und die CC-BY-SA-4.0-Lizenz zu verweisen.

## Datenformat

`wger-exercises.json` ist ein kompaktes JSON-Array. Jeder Eintrag:

```json
{
  "wgerId": 123,
  "name": "Bench Press",
  "nameDe": "Bankdrücken",
  "muscleGroups": ["Chest", "Triceps"],
  "equipment": "Barbell",
  "mediaUrl": "https://wger.de/media/exercise-images/.../....png"
}
```

- `nameDe`, `equipment`, `mediaUrl` können `null` sein, wenn wger dafür
  keine Angabe hat.
- `muscleGroups` enthält die englischen Muskelnamen (`name_en` der
  wger-Muskel-Objekte, primäre + sekundäre Muskeln, dedupliziert; kann
  leer sein).
- `equipment` ist der Name des ersten Equipment-Eintrags (falls vorhanden).
- Nur Übungen mit einer englischen Übersetzung (wger-Sprache `id=2`) sind
  enthalten; Einträge sind nach `wgerId` dedupliziert und nach `name`
  sortiert.

**Bekannte Datenqualität:** Die wger-Datenbank ist crowd-gepflegt. In
seltenen Fällen (< 1 % im Snapshot) ist eine nicht-englische Übersetzung
fälschlich als Sprache `id=2` (Englisch) getaggt — das übernimmt der
Snapshot unverändert, da hier keine zusätzliche Heuristik über die
API-Daten hinaus angewendet wird.

## Verwendung

`seed-exercises.ts` exportiert `seedExercises(db: Database): Promise<number>`.
Sie liest `wger-exercises.json` zur Laufzeit relativ zu ihrer eigenen
Modul-URL (`new URL('./wger-exercises.json', import.meta.url)`) und fügt
die Übungen idempotent ein (`onConflictDoNothing` auf `exercises.wger_id`,
`source='wger'`, `userId=null`). Der Rückgabewert ist die Anzahl der
Übungen im Snapshot, nicht die Anzahl tatsächlich neu eingefügter Zeilen.

**Wichtig für den Build:** `tsc` kopiert keine `.json`-Dateien nach
`dist/`. Damit `seedExercises()` im gebauten Server (`dist/`) funktioniert,
muss der Build-Prozess (Dockerfile bzw. `apps/server`-Buildscript)
`src/modules/workout/seed/wger-exercises.json` zusätzlich nach
`dist/modules/workout/seed/wger-exercises.json` kopieren. Das ist bewusst
nicht Teil dieser Änderung.

## Snapshot neu generieren

1. Kurzes Node-Einmalskript (nicht im Repo) schreiben, das paginiert gegen
   `https://wger.de/api/v2/exerciseinfo/?limit=100&offset=<n>` fragt (mit
   `User-Agent`-Header), bis `next` leer ist.
2. Pro Übung extrahieren:
   - `wgerId` = `id`
   - `name` = `translations[].name` mit `language === 2` (Englisch)
   - `nameDe` = `translations[].name` mit `language === 1` (Deutsch),
     sonst `null`
   - `muscleGroups` = `name_en` (Fallback `name`) aus `muscles` +
     `muscles_secondary`, dedupliziert
   - `equipment` = `equipment[0].name`, sonst `null`
   - `mediaUrl` = `images[0].image`, sonst `null`
3. Nur Übungen mit gültigem `name` behalten, nach `wgerId` dedupliziert,
   nach `name` sortiert.
4. Als kompaktes JSON-Array nach
   `apps/server/src/modules/workout/seed/wger-exercises.json` schreiben und
   dieses README (Snapshot-Datum, Anzahl) aktualisieren.
