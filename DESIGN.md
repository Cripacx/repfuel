# DESIGN.md — repfuel

Visueller Charakter: **Kohle & Volt.** Ruhige, tiefdunkle Kohle-Flächen, klare
Hierarchie, genau eine energetische Akzentfarbe (Volt — ein sportliches
Gelbgrün). Die App soll sich im Studio anfühlen wie ein präzises Werkzeug mit
Trainingsenergie — nicht wie ein Dashboard-Spielzeug. Brand lebt in präzisen
Details (Zahlen, Fortschritt, Mikro-Interaktionen), nicht in Dekoration.
Modus (impeccable): **Operate**.

## Farben (Tokens)

Alle Farben ausschließlich über CSS-Custom-Properties. Kein Hex im Komponenten-Code.

```css
:root {
  /* Flächen (Kohle: dark-first, base nie reines Schwarz) */
  --bg: #0e0f10;            /* App-Hintergrund */
  --surface: #16181a;       /* Karten, Sheets */
  --surface-2: #1e2124;     /* erhabene Elemente, Inputs */
  --border: #2a2e33;        /* Hairlines, 1px */
  --border-strong: #3c4249;

  /* Text (off-white, leicht kühl-grünlich, nie #fff) */
  --text: #f0f2ee;          /* primär, Kontrast ≥ 17:1 auf --bg */
  --text-muted: #a6aeab;    /* sekundär, Kontrast ≥ 7:1 */
  --text-faint: #6f7773;    /* tertiär/Platzhalter, nur für Nicht-Kerninfo */

  /* Akzent: Volt — genau EINE Primäraktion pro View */
  --accent: #c8f542;
  --accent-hover: #d9fa6e;
  --accent-pressed: #a3cf25;
  --on-accent: #141a02;     /* Text/Icon auf Akzentfläche (Kontrast 14:1) */
  --accent-subtle: rgb(200 245 66 / .13);  /* Hintergrund für Badges/aktive Tabs */

  /* Semantik (desaturiert für Dark Mode, nie Bedeutung nur über Farbe).
     Success ist Mintgrün und klar vom gelbgrünen Volt getrennt. */
  --success: #3fd68f;
  --danger: #ee5a52;
  --danger-subtle: rgb(238 90 82 / .12);
  --warning: #e8b93b;

  /* Makro-Farben (Charts, Fortschrittsbalken) */
  --macro-protein: #3fd68f;
  --macro-carbs: #61a3f2;
  --macro-fat: #e8b93b;
  --macro-kcal: var(--accent);
}
```

## Typografie

- System-Stack: `-apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`
  (keine Webfonts — PWA/Offline, Ladezeit).
- Skala: 12 / 14 / 16 / 20 / 26 / 34 px (`--text-xs` … `--text-2xl`).
- Gewichte: 400 (Body), 500 (Labels/Buttons), 700 (Headings, Kennzahlen).
- **Zahlen sind der Star:** Kennzahlen (Gewicht, kcal, Timer) in 700,
  `font-variant-numeric: tabular-nums`, eine Stufe größer als ihr Kontext.
- Zeilenlänge nie über ~70 Zeichen; `line-height` 1.5 für Body, 1.2 für Headings.

## Space & Form

- 4px-Skala: 4, 8, 12, 16, 24, 32, 48, 64 (`--space-1` … `--space-16`).
- Radius: 10px Inputs/Buttons, 14px Karten, 20px Sheets/Modals; nested:
  `inner = outer − padding`.
- Abstand innerhalb einer Gruppe (~12px) sichtbar kleiner als zwischen
  Gruppen (~32px).
- Touch-Targets ≥ 44px; Stepper-Buttons 48px.
- Schatten sparsam (dark UI lebt von Flächenabstufung, nicht von Schatten):
  nur Sheets/Modals bekommen `--shadow-lg`.

## Motion

- `--dur-fast: 150ms` (Hover/Tap), `--dur-base: 250ms` (Sheets, Toggles),
  ease-out `cubic-bezier(0.16, 1, 0.3, 1)`; Exits ~40% schneller.
- Tap-Feedback < 100ms (aktiver Zustand: Fläche eine Stufe heller).
- Rest-Timer-Countdown: ruhige 1s-Ticks, kein Pulsieren; Ende: kurzer
  Akzent-Flash + Ton/Vibration.
- `prefers-reduced-motion` respektieren: Transitions auf 0 reduzieren.

## Komponenten

- **Buttons:** `.primary` = Volt-Fläche, `--on-accent`-Text, genau einer pro
  View. `.secondary` = `--surface-2` + Border. `.danger` nur für destruktive
  Aktionen, immer mit Guard (Undo bevorzugt, sonst confirm). Disabled: 45%
  Opacity, kein Cursor-Wechsel-Trick.
- **Karten:** `--surface`, 14px Radius, 16px Padding, 1px `--border`.
- **Inputs:** `--surface-2`, 10px Radius, 44px Höhe, Fokus: 2px Akzent-Ring
  (Kontrast ≥ 3:1), Validierung on blur, danach live.
- **Navigation:** Bottom-Tab-Bar auf Mobile (Training / Ernährung / Gewicht /
  mehr), aktiver Tab in Akzent + `--accent-subtle`-Fläche; Top-Bar nur mit
  Wortmarke + Kontext-Aktionen.
- **Listen-Zeilen** (Übungen, Foods): 56–64px, Thumbnail links (44px, 8px
  Radius, Lazy, Icon-Fallback), Name primär, Metadaten `--text-muted`,
  Aktion rechts.
- **Fortschrittsbalken** (kcal/Makros): 8px Höhe, Track `--surface-2`,
  Füllung Makro-Farbe; > 100%: Füllung wechselt auf `--warning`, Label nennt
  die Überschreitung in Zahlen.
- **Empty States:** ein Satz was fehlt + genau eine Aktion, die es behebt.
  Kein Illustrations-Kitsch.
- **Sechs Screen-States** (loading/empty/partial/error/success/offline) für
  jeden Screen; Fehler inline mit Icon + nächstem Schritt, nie nur rot.

## Sprache/Copy

- Kurz, konkret, verbfrei wo möglich („3 Sätze · 24 kg" statt Sätze-Prosa).
- Fehler: was kaputt ist + was zu tun ist. Keine Schuldzuweisung, kein „Oops".
- Deutsch per Du, Englisch neutral.
