import type { AiStatusResponse } from '@repfuel/shared';
import { api } from '$lib/api.js';

/**
 * Feature-Flag der KI-Schicht. `GET /ai/status` wird beim App-Start **einmal**
 * im Layout-Load geholt (siehe `src/routes/+layout.ts`) und hier gecacht —
 * jeder KI-UI-Baustein (Coach-Tab, /chat, Vorschlagskarten) hängt daran.
 *
 * Architekturprinzip „KI ist strikt optional": Solange `enabled` nicht `true`
 * ist, darf kein KI-Element sichtbar sein.
 */

let status = $state<AiStatusResponse | null>(null);
let loaded = $state(false);
let inFlight: Promise<void> | null = null;

export function getAiStatus(): AiStatusResponse | null {
  return status;
}

/** `true`, sobald der Status-Abruf abgeschlossen ist (auch bei Fehlschlag). */
export function isAiStatusLoaded(): boolean {
  return loaded;
}

export function isAiEnabled(): boolean {
  return status?.enabled === true;
}

/**
 * Lädt den Status genau einmal pro App-Start. Fehlschläge (Server nicht
 * erreichbar, 401) werden bewusst geschluckt: die App bleibt ohne KI voll
 * funktionsfähig, der Coach-Tab bleibt dann einfach aus.
 */
export function loadAiStatus(): Promise<void> {
  if (loaded) return Promise.resolve();
  inFlight ??= api.ai
    .status()
    .then((next) => {
      status = next;
    })
    .catch(() => {
      status = null;
    })
    .finally(() => {
      loaded = true;
      inFlight = null;
    });
  return inFlight;
}

/** Nur für Tests/Logout: Cache leeren, damit der nächste Start neu lädt. */
export function resetAiStatus(): void {
  status = null;
  loaded = false;
  inFlight = null;
}
