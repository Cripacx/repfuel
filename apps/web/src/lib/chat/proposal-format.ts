/**
 * Formatiert den Payload eines KI-Vorschlags (`ProposalDto.payload`) in eine
 * flache, anzeigbare Feldliste — statt einer rohen JSON-Wand im Bestätigungs-Dialog.
 *
 * Rein und ohne i18n-Abhängigkeit: die Übersetzung der Feldnamen passiert in der
 * Komponente (`ProposalCard.svelte`) über `key`, damit dieses Modul testbar bleibt.
 */

export type ProposalValue =
  | { kind: 'text'; text: string }
  | { kind: 'number'; text: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'empty' };

export interface ProposalField {
  /** Vollständiger Pfad ab Payload-Wurzel — eindeutiger Key fürs `{#each}`. */
  path: string[];
  /** Letztes Pfadsegment; Grundlage für die Label-Auflösung. */
  key: string;
  /** Verschachtelungstiefe (0 = oberste Ebene) für die Einrückung. */
  depth: number;
  /** `null` ⇒ Gruppenüberschrift (Objekt oder Liste) statt Wert. */
  value: ProposalValue | null;
  /** 1-basierte Position, wenn das Feld ein Listeneintrag ist, sonst `null`. */
  index: number | null;
}

/** Ab dieser Tiefe wird nicht weiter aufgeklappt, sondern kompakt serialisiert. */
const MAX_DEPTH = 5;
const MAX_INLINE_LENGTH = 160;

function formatNumber(value: number): ProposalValue {
  if (!Number.isFinite(value)) return { kind: 'empty' };
  // Ganzzahlen ohne Nachkommastellen, sonst auf 2 Stellen gekürzt (82.50 → 82.5).
  const rounded = Math.round(value * 100) / 100;
  return { kind: 'number', text: String(rounded) };
}

function formatPrimitive(value: unknown): ProposalValue {
  if (value === null || value === undefined) return { kind: 'empty' };
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return { kind: 'boolean', value };
  if (typeof value === 'string') {
    const text = value.trim();
    return text === '' ? { kind: 'empty' } : { kind: 'text', text };
  }
  const serialized = JSON.stringify(value) ?? String(value);
  return {
    kind: 'text',
    text:
      serialized.length > MAX_INLINE_LENGTH
        ? `${serialized.slice(0, MAX_INLINE_LENGTH - 1)}…`
        : serialized,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function walk(
  value: unknown,
  path: string[],
  key: string,
  depth: number,
  index: number | null,
  out: ProposalField[],
): void {
  const base = { path, key, depth, index };

  if (depth >= MAX_DEPTH || (!isPlainObject(value) && !Array.isArray(value))) {
    out.push({ ...base, value: formatPrimitive(value) });
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push({ ...base, value: { kind: 'empty' } });
      return;
    }
    out.push({ ...base, value: null });
    value.forEach((item, i) => {
      walk(item, [...path, String(i)], key, depth + 1, i + 1, out);
    });
    return;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    out.push({ ...base, value: { kind: 'empty' } });
    return;
  }
  // Die Wurzel selbst bekommt keine Überschrift — sie ist der Vorschlag.
  if (path.length > 0) out.push({ ...base, value: null });
  for (const [childKey, childValue] of entries) {
    walk(childValue, [...path, childKey], childKey, path.length === 0 ? 0 : depth + 1, null, out);
  }
}

/**
 * Wandelt einen Vorschlags-Payload in eine flache Feldliste um. Objekte und
 * Listen erzeugen eine Überschrift (`value: null`) plus eingerückte Kinder;
 * leere Werte werden explizit als „leer" markiert statt weggelassen.
 */
/**
 * Fallback-Label für Feldnamen ohne Übersetzung: `targetWeight` → `Target weight`.
 * Besser als der rohe Key, ohne für jedes künftige Payload-Feld eine
 * Übersetzung zu erzwingen.
 */
export function humanizeKey(key: string): string {
  const words = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  if (words === '') return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatProposalPayload(payload: unknown): ProposalField[] {
  const fields: ProposalField[] = [];
  if (payload === null || payload === undefined) return fields;
  walk(payload, [], '', 0, null, fields);
  return fields;
}

// ---------- Routinen-Vorschläge: Übungsliste statt UUID-Wand ----------

export interface RoutineItemPreview {
  /** Anzeigename aus payload.exerciseNames; Fallback: die ID. */
  name: string;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Zieht aus einem `create_routine`-/`update_routine`-Payload die Übungsliste
 * (Name + Sätze×Wiederholungen) für die kompakte Anzeige in der Karte.
 * Der Server legt dafür `exerciseNames` (id → Name) in den Payload.
 */
export function extractRoutineItems(payload: unknown): RoutineItemPreview[] {
  if (!isPlainObject(payload)) return [];
  const names = isPlainObject(payload.exerciseNames) ? payload.exerciseNames : {};
  const container = isPlainObject(payload.routine)
    ? payload.routine
    : isPlainObject(payload.changes)
      ? payload.changes
      : null;
  if (!container || !Array.isArray(container.items)) return [];
  return container.items.filter(isPlainObject).map((item) => {
    const id = typeof item.exerciseId === 'string' ? item.exerciseId : '';
    const mapped = names[id];
    return {
      name: typeof mapped === 'string' && mapped.length > 0 ? mapped : id,
      targetSets: numberOrNull(item.targetSets),
      targetReps: numberOrNull(item.targetReps),
      targetWeightKg: numberOrNull(item.targetWeightKg),
    };
  });
}

/** Entfernt reine Anzeigehilfen (exerciseNames) aus der Detail-Feldliste. */
export function stripDisplayHelpers(payload: unknown): unknown {
  if (!isPlainObject(payload)) return payload;
  const rest = { ...payload };
  delete rest.exerciseNames;
  return rest;
}
