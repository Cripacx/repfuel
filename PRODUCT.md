# PRODUCT.md — repfuel

## Wer

Selbsthoster und Homelab-Nutzer, die ihre Fitness- und Ernährungsdaten selbst
besitzen wollen. Technisch versiert genug für `docker compose up -d`, aber im
Alltag Nutzer einer Handy-App: Die Haupt-Nutzung ist die installierte PWA auf
dem Home-Screen — im Gym zwischen zwei Sätzen, in der Küche beim Essen-Loggen.
Mehrere Nutzer (Familie, Trainingspartner) teilen sich eine Instanz.

## Was

Workout-Tracking + Ernährungs-Tracking + optionaler KI-Coach in einer
self-hosted Open-Source-App (AGPL-3.0). Kernflüsse: Sätze loggen (mit
Vorbefüllung und Rest-Timer), Mahlzeiten loggen (Suche/Barcode/Quick-kcal),
Gewicht und Ziele verfolgen. KI ist strikt optional und die App ohne sie
vollwertig.

## Warum wir (UVP)

- **Deine Daten, deine Instanz.** Kein Abo, kein Cloud-Zwang, kein Tracking.
  Das können Hevy/MyFitnessPal nicht behaupten.
- **Training UND Ernährung in einer App** — Selfhosting-Alternativen können
  meist nur eines von beidem (wger: Verwaltung statt schnellem Logging;
  openGym: nur Training).
- **KI-Coach mit echtem Datenzugriff** über die eigene Instanz (API, Ollama
  oder Claude-CLI) — opt-in, austauschbar, nie Voraussetzung.

## Constraints (bewahren)

- Projektname immer klein: „repfuel". Keine Marken-Anleihen bei Kommerz-Apps.
- Deutsch und Englisch sind gleichwertig; alle UI-Texte über i18n.
- Übungsdaten aus der wger-DB (CC-BY-SA 4.0, Attribution bleibt).
- Lebensmitteldaten aus Open Food Facts (Attribution bleibt).
- Mobile-first: Der Logging-Flow ist für eine Hand + verschwitzte Finger
  gebaut (Touch-Targets ≥ 44px, Stepper statt Freitext wo möglich).
- Offline-Logging (ab M4) ist Kernversprechen, kein Nice-to-have.

## Worst mistakes (vermeiden)

- Einen Satz/eine Mahlzeit verlieren, weil ein Request fehlschlug.
- Der Nutzer sperrt sich aus (Passkey weg) — darum zusätzlich Passwort-Login
  und Invite-basiertes Wiederhereinkommen durch den Admin.
- KI-Schreibaktionen ohne Bestätigung des Nutzers.
