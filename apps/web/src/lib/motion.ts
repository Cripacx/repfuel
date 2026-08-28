import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

/**
 * Bewegungs-Grundwerte der App. Die Dauern folgen der Regel „Distanz und
 * Konsequenz": Rückmeldung sofort, Zustandswechsel kurz, Overlays etwas länger.
 * Ausgänge laufen schneller als Eingänge — man hat sich bereits entschieden.
 */
export const DUR_STATE = 220;
export const DUR_OVERLAY = 320;
export const DUR_EXIT = 200;

/** Selbe Kurve wie --ease-out in app.css: ruhiges Ankommen ohne Überschwingen. */
export const EASE_OUT = cubicOut;

/**
 * Reduced Motion heißt hier: keine räumliche Bewegung, aber Opazität und Farbe
 * bleiben — sonst verschwinden Zustandswechsel ganz. Wird pro Aufruf gelesen,
 * damit ein Umschalten im System sofort greift.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Ab dieser Breite ist das Modal eine zentrierte Karte statt eines Sheets. */
function isSheetLayout(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(max-width: 767px)').matches;
}

/**
 * Ein-/Ausgang für Modals. Mobil steigt das Sheet vom unteren Rand auf, wo es
 * auch sitzt; ab Tablet wächst die Karte leicht aus ihrer Mitte. Beide Wege sind
 * symmetrisch — was so hereinkommt, geht so wieder hinaus.
 */
export function sheet(_node: Element, { duration = DUR_OVERLAY } = {}): TransitionConfig {
  if (prefersReducedMotion()) {
    return { duration, easing: EASE_OUT, css: (t) => `opacity: ${t}` };
  }
  if (isSheetLayout()) {
    return {
      duration,
      easing: EASE_OUT,
      css: (t, u) => `opacity: ${t}; transform: translateY(${u * 100}%)`,
    };
  }
  return {
    duration,
    easing: EASE_OUT,
    css: (t, u) => `opacity: ${t}; transform: scale(${1 - u * 0.04})`,
  };
}

/**
 * Leiste, die von unten einfährt (Pausen-Timer). Bewusst kürzer als ein Modal:
 * sie unterbricht nicht, sie übernimmt nur.
 */
export function riseFromBottom(
  _node: Element,
  { duration = DUR_STATE } = {},
): TransitionConfig {
  if (prefersReducedMotion()) {
    return { duration, easing: EASE_OUT, css: (t) => `opacity: ${t}` };
  }
  return {
    duration,
    easing: EASE_OUT,
    css: (t, u) => `opacity: ${t}; transform: translateY(${u * 100}%)`,
  };
}

/**
 * Eintreffen einer neuen Zeile in einer Liste (geloggter Satz). Kurzer Weg von
 * oben — die Zeile kommt aus der Eingabe darüber, nicht von irgendwoher.
 */
export function arrive(_node: Element, { duration = DUR_STATE } = {}): TransitionConfig {
  if (prefersReducedMotion()) {
    return { duration, easing: EASE_OUT, css: (t) => `opacity: ${t}` };
  }
  return {
    duration,
    easing: EASE_OUT,
    css: (t, u) => `opacity: ${t}; transform: translateY(${-u * 8}px)`,
  };
}
