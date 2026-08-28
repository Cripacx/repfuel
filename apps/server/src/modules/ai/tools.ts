import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ProposalDto, ProposalKind, ToolDefinition, ToolSet } from '@repfuel/shared';
import {
  MEMORY_CATEGORIES,
  createRoutineRequestSchema,
  suggestActionsInputSchema,
  updateProfileRequestSchema,
  updateRoutineRequestSchema,
} from '@repfuel/shared';
import type { MemoryService } from './services/memory-service.js';
import type { ProfileService } from '../auth/index.js';
import type { IngestService, WeightService } from '../health/index.js';
import type { FoodService, MealService } from '../nutrition/index.js';
import type { ExerciseService, RoutineService, WorkoutService } from '../workout/index.js';

/**
 * KI-Tools = dünne Wrapper um dieselben Service-Funktionen wie die REST-API.
 * Reine Lese-Tools und einfache Log-Tools werden direkt ausgeführt;
 * update_routine/update_profile erzeugen NUR einen Vorschlag (Bestätigungs-Flow).
 */
export interface ToolDeps {
  userId: string;
  sessionId: string;
  tzOffsetMinutes: number;
  mealService: MealService;
  foodService: FoodService;
  workoutService: WorkoutService;
  routineService: RoutineService;
  exerciseService: ExerciseService;
  weightService: WeightService;
  ingestService: IngestService;
  profileService: ProfileService;
  memoryService: MemoryService;
  createProposal: (input: {
    kind: ProposalKind;
    summary: string;
    payload: unknown;
  }) => Promise<ProposalDto>;
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected');
const isoDateTime = z.string().datetime({ offset: true });

function tool<T>(def: ToolDefinition<T>): ToolDefinition<T> {
  return def;
}

export function buildToolSet(deps: ToolDeps): ToolSet {
  const { userId } = deps;

  /** id → Anzeigename; wandert mit in Vorschlags-Payloads, damit die
   *  Bestätigungskarte Übungsnamen statt UUIDs zeigen kann. */
  const exerciseNameMap = async (ids: string[]): Promise<Record<string, string>> => {
    const exercises = await deps.exerciseService.byIds(userId, ids);
    return Object.fromEntries(exercises.map((e) => [e.id, e.nameDe ?? e.name]));
  };

  const dayBounds = (from: string, to: string) => ({
    from: new Date(Date.parse(`${from}T00:00:00Z`) - deps.tzOffsetMinutes * 60_000).toISOString(),
    to: new Date(
      Date.parse(`${to}T00:00:00Z`) - deps.tzOffsetMinutes * 60_000 + 24 * 60 * 60 * 1000,
    ).toISOString(),
  });

  const tools = {
    get_meals: tool({
      description:
        'Geloggte Mahlzeiten in einem Datumsbereich (lokale Kalendertage, YYYY-MM-DD) abrufen.',
      inputSchema: z.object({ from: isoDate, to: isoDate }),
      execute: async ({ from, to }) => {
        const bounds = dayBounds(from, to);
        return deps.mealService.list(userId, { from: bounds.from, to: bounds.to, limit: 300 });
      },
    }),

    get_nutrition_summary: tool({
      description:
        'Tageswerte (kcal, Protein, Kohlenhydrate, Fett) pro Tag inkl. Vergleich mit den Zielen des Nutzers.',
      inputSchema: z.object({ from: isoDate, to: isoDate }),
      execute: async ({ from, to }) =>
        deps.mealService.stats(userId, { from, to, tzOffsetMinutes: deps.tzOffsetMinutes }),
    }),

    get_workouts: tool({
      description: 'Workouts in einem Datumsbereich abrufen (inkl. Sätze).',
      inputSchema: z.object({ from: isoDate, to: isoDate }),
      execute: async ({ from, to }) => {
        const bounds = dayBounds(from, to);
        return deps.workoutService.list(userId, { from: bounds.from, to: bounds.to, limit: 50 });
      },
    }),

    get_exercise_history: tool({
      description:
        'Letzte Sätze zu einer Übung (Verlauf/PR-Kontext). exercise_id stammt aus get_workouts oder den Routinen.',
      inputSchema: z.object({
        exercise_id: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      execute: async ({ exercise_id }) => deps.workoutService.lastSets(userId, [exercise_id]),
    }),

    get_weight_history: tool({
      description: 'Körpergewichts-Verlauf in einem Datumsbereich.',
      inputSchema: z.object({ from: isoDate, to: isoDate }),
      execute: async ({ from, to }) => {
        const bounds = dayBounds(from, to);
        return deps.weightService.list(userId, { from: bounds.from, to: bounds.to, limit: 500 });
      },
    }),

    get_health_metrics: tool({
      description:
        'Health-Metriken aus dem Import abrufen (z.B. steps, resting_hr, active_kcal, sleep_minutes).',
      inputSchema: z.object({
        metric: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[a-z][a-z0-9_]*$/),
        from: isoDate,
        to: isoDate,
      }),
      execute: async ({ metric, from, to }) => {
        const bounds = dayBounds(from, to);
        return deps.ingestService.stats(userId, {
          metric,
          from: bounds.from,
          to: bounds.to,
          limit: 2000,
        });
      },
    }),

    get_profile: tool({
      description: 'Profil des Nutzers (Größe, Ziele, kcal-/Makro-Targets).',
      inputSchema: z.object({}),
      execute: async () => deps.profileService.get(userId),
    }),

    get_routines: tool({
      description: 'Alle Trainingsroutinen des Nutzers (mit Übungen und Zielvorgaben).',
      inputSchema: z.object({}),
      execute: async () => deps.routineService.list(userId),
    }),

    search_exercises: tool({
      description:
        'Übungskatalog durchsuchen. BEVORZUGT über muscle suchen (Muskelgruppen-Facette, z.B. Pectorals, Delts, Biceps, Triceps, Lats, Upper Back, Traps, Quads, Hamstrings, Glutes, Calves, Abs, Forearms) — Namenssuche (query) nur für konkrete Übungsnamen. Groß-/Kleinschreibung egal; bei unbekanntem muscle-Wert kommt die gültige Liste zurück. Liefert exercise_ids für create_routine/update_routine und get_exercise_history. Findet sich nichts Passendes: create_exercise.',
      inputSchema: z.object({
        query: z.string().min(2).max(100).optional(),
        muscle: z.string().min(2).max(50).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({ query, muscle, limit }) => {
        // Facetten-Werte sind exakt ("Pectorals") — Eingaben case-insensitiv
        // auflösen, statt die KI raten zu lassen.
        let resolvedMuscle = muscle;
        if (muscle) {
          const { muscles } = await deps.exerciseService.facets(userId);
          resolvedMuscle = muscles.find((m) => m.toLowerCase() === muscle.toLowerCase());
          if (!resolvedMuscle) {
            return { error: `Unbekannte Muskelgruppe "${muscle}"`, availableMuscles: muscles };
          }
        }
        const rows = await deps.exerciseService.list(userId, {
          q: query,
          muscle: resolvedMuscle,
          limit: limit ?? 15,
          offset: 0,
        });
        if (rows.length === 0) {
          const { muscles } = await deps.exerciseService.facets(userId);
          return {
            results: [],
            hint: 'Nichts gefunden — über muscle suchen oder mit create_exercise eine eigene Übung anlegen.',
            availableMuscles: muscles,
          };
        }
        // Kompakte Projektion: die KI braucht IDs + Namen, keine Medien-URLs.
        return rows.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          nameDe: exercise.nameDe,
          muscleGroups: exercise.muscleGroups,
          equipment: exercise.equipment,
        }));
      },
    }),

    create_exercise: tool({
      description:
        'Eigene (Custom-)Übung des Nutzers anlegen, wenn search_exercises nichts Passendes findet. Existiert bereits eine sichtbare Übung mit exakt diesem Namen, wird die zurückgegeben statt ein Duplikat anzulegen. Liefert die exercise_id für create_routine/update_routine.',
      inputSchema: z.object({
        name: z.string().min(2).max(200),
        muscle_groups: z.array(z.string().min(2).max(50)).min(1).max(10),
        equipment: z.string().min(1).max(100).optional(),
      }),
      execute: async ({ name, muscle_groups, equipment }) => {
        const existing = (
          await deps.exerciseService.list(userId, { q: name, limit: 10, offset: 0 })
        ).find(
          (exercise) =>
            exercise.name.toLowerCase() === name.toLowerCase() ||
            exercise.nameDe?.toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
          return {
            id: existing.id,
            name: existing.name,
            muscleGroups: existing.muscleGroups,
            note: 'Übung existierte bereits — keine neue angelegt.',
          };
        }
        const created = await deps.exerciseService.createCustom(userId, {
          name,
          muscleGroups: muscle_groups,
          equipment: equipment ?? null,
        });
        return { id: created.id, name: created.name, muscleGroups: created.muscleGroups };
      },
    }),

    search_food: tool({
      description: 'Lebensmittel suchen (erst lokale Datenbank, dann Open Food Facts).',
      inputSchema: z.object({ query: z.string().min(2).max(100) }),
      execute: async ({ query }) => deps.foodService.search(userId, query, 10),
    }),

    log_meal: tool({
      description:
        'Mahlzeit loggen. Entweder food_query (Suchbegriff, bestes Ergebnis wird verwendet) oder barcode zusammen mit amount_g — oder quick_kcal für einen Schnelleintrag.',
      inputSchema: z
        .object({
          food_query: z.string().min(2).max(100).optional(),
          barcode: z.string().regex(/^\d{6,14}$/).optional(),
          quick_kcal: z.number().min(1).max(10000).optional(),
          amount_g: z.number().min(1).max(5000).optional(),
          meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
          eaten_at: isoDateTime.optional(),
        })
        .refine(
          (v) =>
            (v.quick_kcal != null && !v.food_query && !v.barcode) ||
            ((v.food_query != null) !== (v.barcode != null) && v.amount_g != null),
          { message: 'either food_query|barcode with amount_g, or quick_kcal alone' },
        ),
      execute: async (input) => {
        const eatenAt = input.eaten_at ?? new Date().toISOString();
        if (input.quick_kcal != null) {
          return deps.mealService.upsert(userId, randomUUID(), {
            eatenAt,
            mealType: input.meal_type,
            quickKcal: input.quick_kcal,
          });
        }
        const food = input.barcode
          ? await deps.foodService.byBarcode(input.barcode)
          : (await deps.foodService.search(userId, input.food_query!, 1))[0];
        if (!food) return { error: 'no matching food found — try search_food first' };
        return deps.mealService.upsert(userId, randomUUID(), {
          eatenAt,
          mealType: input.meal_type,
          foodId: food.id,
          amountG: input.amount_g!,
        });
      },
    }),

    log_weight: tool({
      description: 'Körpergewicht loggen (kg).',
      inputSchema: z.object({
        weight_kg: z.number().min(20).max(400),
        measured_at: isoDateTime.optional(),
      }),
      execute: async ({ weight_kg, measured_at }) =>
        deps.weightService.upsert(userId, randomUUID(), {
          weightKg: weight_kg,
          measuredAt: measured_at ?? new Date().toISOString(),
        }),
    }),

    remember: tool({
      description:
        'NEUEN Eintrag im Coach-Gedächtnis anlegen: Vorhaben/Ziele, Vorlieben & Abneigungen, Einschränkungen (Unverträglichkeiten, Verletzungen, Zeitbudget). WICHTIG: EIN Eintrag pro THEMA — bündele Zusammengehöriges in einem Eintrag ("Mag nicht: Spiegelei, Rührei, Gurken, Tomaten"). Existiert zum Thema bereits ein Eintrag (siehe Gedächtnis im System-Prompt), nutze update_memory statt remember. KEINE Tagesdaten (Mahlzeiten/Sätze/Gewicht) — die stehen in den anderen Tools. Der Nutzer sieht und löscht Einträge im Coach-Tab.',
      inputSchema: z.object({
        category: z.enum(MEMORY_CATEGORIES),
        content: z.string().min(2).max(1000),
      }),
      execute: async ({ category, content }) => deps.memoryService.add(userId, category, content),
    }),

    update_memory: tool({
      description:
        'Bestehenden Gedächtnis-Eintrag fortschreiben (memory_id aus dem System-Prompt): den kompletten neuen Text des Eintrags übergeben — z.B. eine weitere Abneigung an die bestehende Liste anfügen. Ersetzt den alten Text vollständig.',
      inputSchema: z.object({
        memory_id: z.string().uuid(),
        content: z.string().min(2).max(1000),
      }),
      execute: async ({ memory_id, content }) =>
        deps.memoryService.update(userId, memory_id, content),
    }),

    forget_memory: tool({
      description:
        'Einen Eintrag aus dem Coach-Gedächtnis löschen (memory_id aus dem System-Prompt), z.B. wenn der Nutzer sagt, dass etwas nicht mehr gilt.',
      inputSchema: z.object({ memory_id: z.string().uuid() }),
      execute: async ({ memory_id }) => {
        await deps.memoryService.remove(userId, memory_id);
        return { status: 'deleted' };
      },
    }),

    create_routine: tool({
      description:
        'NEUE Trainingsroutine VORSCHLAGEN (Name, optional Wochentag, Übungen mit Sätzen/Wiederholungen). exercise_ids vorher über search_exercises ermitteln. Wird NICHT direkt angelegt — der Nutzer bestätigt den Vorschlag im UI. summary: 1–2 Sätze, was und warum. Pro Trainingstag eine eigene Routine anlegen (z.B. "Ganzkörper A" und "Ganzkörper B").',
      inputSchema: z.object({
        summary: z.string().min(5).max(500),
        routine: createRoutineRequestSchema,
      }),
      execute: async ({ summary, routine }) => {
        const exerciseIds = (routine.items ?? []).map((item) => item.exerciseId);
        // Übungen jetzt prüfen, damit kein Vorschlag mit erfundenen IDs entsteht.
        await deps.exerciseService.assertVisible(userId, exerciseIds);
        const proposal = await deps.createProposal({
          kind: 'create_routine',
          summary,
          payload: {
            routine,
            exerciseNames: await exerciseNameMap(exerciseIds),
          },
        });
        return {
          status: 'proposal_created',
          proposalId: proposal.id,
          note: 'Der Nutzer muss den Vorschlag im UI bestätigen, bevor die Routine angelegt wird.',
        };
      },
    }),

    suggest_actions: tool({
      description:
        'Bis zu 3 Schnellantwort-Buttons an die AKTUELLE Antwort hängen (label: kurzer Button-Text; prompt: die Nachricht, die ein Klick sendet — in der Sprache des Nutzers). Als LETZTEN Tool-Aufruf des Turns verwenden, wenn es naheliegende nächste Schritte gibt (z.B. "Leg den Plan an", "Zeig Alternativen").',
      inputSchema: suggestActionsInputSchema,
      execute: async ({ actions }) => ({ status: 'ok', count: actions.length }),
    }),

    update_routine: tool({
      description:
        'Änderung einer Routine VORSCHLAGEN (Name/Übungen/Sätze). Wird NICHT direkt ausgeführt — der Nutzer bestätigt den Vorschlag im UI. summary: 1–2 Sätze, was und warum.',
      inputSchema: z.object({
        routine_id: z.string().uuid(),
        summary: z.string().min(5).max(500),
        changes: updateRoutineRequestSchema,
      }),
      execute: async ({ routine_id, summary, changes }) => {
        // Existenz/Ownership prüfen, damit keine Vorschläge für fremde Routinen entstehen.
        await deps.routineService.get(userId, routine_id);
        const proposal = await deps.createProposal({
          kind: 'update_routine',
          summary,
          payload: {
            routineId: routine_id,
            changes,
            ...(changes.items
              ? { exerciseNames: await exerciseNameMap(changes.items.map((i) => i.exerciseId)) }
              : {}),
          },
        });
        return {
          status: 'proposal_created',
          proposalId: proposal.id,
          note: 'Der Nutzer muss den Vorschlag im UI bestätigen, bevor er angewendet wird.',
        };
      },
    }),

    update_profile: tool({
      description:
        'Änderung des Profils/der Ziele VORSCHLAGEN (kcal-/Makro-Targets, Ziel, Aktivitätslevel …). Wird NICHT direkt ausgeführt — der Nutzer bestätigt im UI. summary: 1–2 Sätze, was und warum.',
      inputSchema: z.object({
        summary: z.string().min(5).max(500),
        changes: updateProfileRequestSchema,
      }),
      execute: async ({ summary, changes }) => {
        const proposal = await deps.createProposal({
          kind: 'update_profile',
          summary,
          payload: { changes },
        });
        return {
          status: 'proposal_created',
          proposalId: proposal.id,
          note: 'Der Nutzer muss den Vorschlag im UI bestätigen, bevor er angewendet wird.',
        };
      },
    }),
  };

  return tools as unknown as ToolSet;
}
