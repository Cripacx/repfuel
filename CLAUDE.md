# repfuel — Arbeitsregeln für Claude Code

Lies zuerst `IMPLEMENTIERUNGSPROMPT.md` vollständig. Sie ist die einzige Quelle der
Wahrheit für Stack, Architektur, Datenmodell und Meilensteine.

## Regeln

1. **Strikt meilensteinweise arbeiten.** Nur am aktuell beauftragten Meilenstein
   arbeiten. Nichts aus späteren Meilensteinen vorbereiten oder "mitnehmen".
2. **Nicht vom Stack abweichen.** Keine zusätzlichen Frameworks, Datenbanken oder
   Libraries einführen, die nicht im Implementierungsprompt stehen. Bei echtem
   Bedarf: vorschlagen und auf Freigabe warten, nicht einfach einbauen.
3. **Service-Schicht ist heilig.** Geschäftslogik nur in `apps/server/src/services/`.
   Routen, KI-Tools und MCP-Wrapper enthalten keine Logik.
4. **user_id kommt immer aus der Session**, niemals aus Request-Body oder Query.
5. **KI ist optional.** Kein Code außerhalb des KI-Moduls darf einen konfigurierten
   Adapter voraussetzen. `AI_PROVIDER=none` muss immer voll funktionieren.
6. **Schreiboperationen der KI** an Routinen/Profil laufen über den
   Bestätigungs-Flow (Vorschlag → Nutzer bestätigt im UI). Diesen Guard nie
   "vereinfachen" oder umgehen.
7. **Nach jedem abgeschlossenen Arbeitsschritt:** Tests laufen lassen
   (`pnpm test`), Typecheck (`pnpm typecheck`), dann committen
   (Conventional Commits). Nie mit rotem Test-Stand committen.
8. **Lauffähigkeit prüfen:** Am Ende eines Meilensteins muss
   `docker compose up -d` funktionieren und die betroffenen Flows im Browser
   nutzbar sein. Wenn du das nicht selbst verifizieren kannst, sag es explizit.
9. **Keine Secrets** in Code oder Commits; alles über `.env` /
   `.env.example` (mit Kommentar) dokumentieren.
10. **TypeScript strict, keine `any`**, zod-Schemas in `packages/shared` für
    alles, was über API- oder Tool-Grenzen geht.

## UI-/Design-Arbeit (verpflichtend)

Für JEDE Arbeit an der Web-UI (neue Screens, Änderungen, Styling, Reviews) sind die
beiden Projekt-Skills in `.claude/skills/` zu verwenden:

1. **`impeccable`** (`.claude/skills/impeccable/SKILL.md`) — der führende
   Design-Workflow. Vor UI-Arbeit `node .claude/skills/impeccable/scripts/context.mjs`
   ausführen (einmal pro Session), Kontext kommt aus `PRODUCT.md` und `DESIGN.md`
   im Repo-Root. Neue Screens über den `shape`-/new-work-Flow, Verbesserungen über
   die passenden Commands (`polish`, `harden`, `audit`, …). Vor dem Editieren von
   UI-Code `reference/craft-floor.md` laden.
2. **`ui-design`** (`.claude/skills/ui-design/SKILL.md`) — Reasoning-Module und
   63 Pattern-Referenzen (Timings, Kontraste, Spacing-Skalen, State-Modelle).
   Als Nachschlagewerk für konkrete Werte und für die Checkliste vor dem
   Abschluss jedes Screens (Build checklist).
3. **`apple-design`** (`.claude/skills/apple-design/SKILL.md`) — verbindliche
   Grundlage für Interaktion, Motion und Materialität. Vendored Kopie von
   https://raw.githubusercontent.com/emilkowalski/skills/refs/heads/main/skills/apple-design/SKILL.md
   (unverändert; bei Updates neu ziehen). **Gilt immer**, auch für kleine
   Änderungen: Feedback auf pointer-down statt erst auf click, 1:1-Tracking bei
   Gesten, unterbrechbare Animationen aus dem Präsentationswert heraus, Springs
   statt fester Durations für alles Anfassbare (Default kritisch gedämpft,
   Bounce nur nach echtem Momentum), symmetrische Ein-/Ausgangspfade,
   größenabhängiges Tracking/Leading, und `prefers-reduced-motion` /
   `prefers-reduced-transparency` / `prefers-contrast` als echte Varianten.

Regeln daraus, die immer gelten: Design-Tokens statt harter Werte (Spacing-Skala,
Radius-Skala, Farbtokens aus DESIGN.md), alle sechs Screen-States (loading, empty,
partial, error, success, offline), Touch-Targets ≥ 44px, Kontrast ≥ 4.5:1,
genau eine Primäraktion pro View.

## Befehle

- Dev: `docker compose up -d db` + `pnpm dev`
- Tests: `pnpm test` | Typecheck: `pnpm typecheck` | Lint: `pnpm lint`
- Migration erzeugen: `pnpm db:generate` | anwenden: `pnpm db:migrate`
