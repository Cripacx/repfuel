# Health-Daten-Import (Apple Health & Co.)

Eine PWA hat keinen direkten HealthKit-/Health-Connect-Zugriff. repfuel
bietet stattdessen einen generischen Ingest-Endpoint, den Export-Apps oder
eigene Skripte befüllen:

```
POST /api/v1/ingest/health
Authorization: Bearer <API-Token>
Content-Type: application/json
```

Das API-Token erzeugst du in **Einstellungen → Datenimport** (pro Gerät ein
Token; jederzeit widerrufbar). Der Endpoint ist idempotent: derselbe
Messpunkt (Metrik + Zeitpunkt + Quelle) wird überschrieben, nie dupliziert.

## Weg 1: iOS mit „Health Auto Export"

Die App [Health Auto Export](https://www.healthyapps.dev/) kann Apple-Health-
Daten periodisch per REST an eine eigene URL schicken.

Einrichtung in der App:

1. **Automation → REST API**
2. URL: `https://<deine-domain>/api/v1/ingest/health`
3. Headers: `Authorization: Bearer <dein Token>`
4. Format: **JSON**, Aggregation z.B. „Days"
5. Metriken auswählen — unterstützt werden derzeit:

| Health Auto Export | repfuel-Metrik | Einheiten |
|---|---|---|
| Steps (`step_count`) | `steps` | count |
| Resting Heart Rate | `resting_hr` | bpm |
| Active Energy | `active_kcal` | kcal (kJ wird konvertiert) |
| Sleep Analysis | `sleep_minutes` | min (hr wird konvertiert) |
| Weight / Body Mass | `weight` | kg (lb wird konvertiert) |

Nicht erkannte Metriken werden ignoriert und in der Antwort unter
`ignoredMetrics` gemeldet.

**Gewicht** wird zusätzlich in den normalen Gewichtsverlauf gespiegelt
(Quelle `apple_health`), kollidiert also nicht mit manuellen Einträgen.

## Weg 2: eigenes simples Schema

Für Skripte/andere Quellen:

```json
{
  "source": "api",
  "metrics": [
    { "metric": "steps",      "value": 8421, "measuredAt": "2026-08-27T00:00:00Z" },
    { "metric": "resting_hr", "value": 52,   "measuredAt": "2026-08-27T00:00:00Z" },
    { "metric": "weight",     "value": 81.3, "measuredAt": "2026-08-27T07:00:00Z" }
  ]
}
```

- `metric`: lowercase snake_case (frei wählbar; Dashboard/KI kennen
  `steps`, `resting_hr`, `active_kcal`, `sleep_minutes`, `weight`)
- `value`: Zahl · `measuredAt`: ISO-8601 · `source`: `api` | `manual` | `apple_health`

Antwort:

```json
{ "accepted": 3, "ignoredMetrics": [], "mirroredWeights": 1 }
```

## Abfragen

- Dashboard: Kacheln für Schritte/Ruhepuls/aktive kcal (heute)
- API: `GET /api/v1/stats/health?metric=steps&from=…&to=…` (Session-Auth)
- KI-Coach: Tool `get_health_metrics`
