<script lang="ts">
  import { onMount } from 'svelte';
  import type {
    BodyWeightDto,
    NutritionDayDto,
    NutritionTargets,
    ProfileDto,
    RoutineDto,
    WorkoutDto,
  } from '@repfuel/shared';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { api } from '$lib/api.js';
  import DaySummaryCard from '$lib/components/DaySummaryCard.svelte';
  import FastingCard from '$lib/components/FastingCard.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import WaterCard from '$lib/components/WaterCard.svelte';
  import { getUser } from '$lib/auth.svelte.js';
  import { describeError } from '$lib/errors.js';
  import { latestMetricEntry, sumMetricValues } from '$lib/health/dashboard.js';
  import { getLocale, m } from '$lib/i18n/index.js';
  import {
    currentTzOffsetMinutes,
    localDayBoundsUtc,
    shiftDateString,
    todayDateString,
  } from '$lib/nutrition/day-range.js';
  import { upsertWorkout } from '$lib/offline/repo.js';
  import { computeVolumeKg } from '$lib/workout/volume.js';
  import { backendWeekdayIndex } from '$lib/workout/weekday.js';

  /**
   * "Heute" im vertrauten Diary-Muster (YAZIO): eine Übersichts-Karte, die den
   * Tag beantwortet, darunter der nächste Trainingsschritt (Hevy), dann die
   * Gewohnheiten. Keine Schnellzugriff-Kachelwand — die Tabs sind der Zugriff.
   */
  const user = $derived(getUser());

  let recentWorkouts = $state<WorkoutDto[]>([]);
  let routines = $state<RoutineDto[]>([]);
  let latestWeight = $state<BodyWeightDto | null>(null);
  let profile = $state<ProfileDto | null>(null);
  let waterMl = $state(0);
  let waterBusy = $state(false);
  let lastMealAt = $state<string | null>(null);
  let todayNutrition = $state<NutritionDayDto | null>(null);
  let nutritionTargets = $state<NutritionTargets | null>(null);
  let loading = $state(true);
  let startError = $state<string | null>(null);
  let starting = $state(false);

  let todaySteps = $state<number | null>(null);
  let todayActiveKcal = $state<number | null>(null);
  let latestRestingHr = $state<number | null>(null);
  /** Summe der heute manuell geloggten Aktivitäten (kcal) — Fallback für "Verbrannt". */
  let todayActivityKcal = $state<number | null>(null);

  /** Health-Daten (Uhr/Handy) schlagen die manuelle Schätzung; nie addieren —
   * eine getrackte Laufrunde wäre sonst doppelt gezählt. */
  const burnedKcal = $derived(todayActiveKcal ?? todayActivityKcal);

  /** Laufendes (nicht beendetes) Workout — "Fortsetzen" schlägt "Starten". */
  const runningWorkout = $derived(recentWorkouts.find((w) => w.finishedAt === null) ?? null);
  const lastFinished = $derived(recentWorkouts.find((w) => w.finishedAt !== null) ?? null);
  /** Die Routine, die laut Wochentag heute dran ist. */
  const todaysRoutine = $derived(
    routines.find((r) => r.weekday === backendWeekdayIndex(new Date())) ?? null,
  );

  function formatNumber(value: number): string {
    return value.toLocaleString(getLocale() === 'de' ? 'de-DE' : 'en-US');
  }

  const healthTiles = $derived(
    [
      todaySteps !== null
        ? { key: 'steps', label: m().home.stepsLabel, value: formatNumber(todaySteps), unit: '' }
        : null,
      latestRestingHr !== null
        ? {
            key: 'restingHr',
            label: m().home.restingHrLabel,
            value: formatNumber(latestRestingHr),
            unit: m().home.restingHrUnit,
          }
        : null,
      todayActiveKcal !== null
        ? {
            key: 'activeKcal',
            label: m().home.activeKcalLabel,
            value: formatNumber(todayActiveKcal),
            unit: m().nutrition.kcalUnit,
          }
        : null,
    ].filter((tile): tile is { key: string; label: string; value: string; unit: string } => tile !== null),
  );

  onMount(async () => {
    const today = todayDateString();
    try {
      const [workoutsRes, weightRes, nutritionRes, routinesRes] = await Promise.all([
        api.workouts.list({ limit: 5 }),
        api.weight.list({ limit: 1 }),
        api.stats.nutrition({ from: today, to: today, tzOffsetMinutes: currentTzOffsetMinutes() }),
        api.routines.list().catch(() => ({ routines: [] as RoutineDto[] })),
      ]);
      recentWorkouts = workoutsRes.workouts;
      latestWeight = weightRes.entries[0] ?? null;
      todayNutrition = nutritionRes.days.find((d) => d.date === today) ?? null;
      nutritionTargets = nutritionRes.targets;
      routines = routinesRes.routines;
    } catch {
      // Startseite bleibt auch ohne Daten benutzbar — kein Fehlerbanner nötig.
    } finally {
      loading = false;
    }

    // Aktivitäten von heute (best effort) — nur für die "Verbrannt"-Spalte.
    try {
      const tz = currentTzOffsetMinutes();
      const bounds = localDayBoundsUtc(today, tz);
      const { activities } = await api.activities.list({ from: bounds.from, to: bounds.to });
      const sum = activities.reduce((acc, a) => acc + (a.kcal ?? 0), 0);
      todayActivityKcal = sum > 0 ? sum : null;
    } catch {
      // Spalte zeigt dann das Ziel.
    }

    // Wasser und Fasten sind optional konfiguriert — schlägt einer der Abrufe
    // fehl, fehlt nur die jeweilige Karte.
    try {
      const tz = currentTzOffsetMinutes();
      const bounds = localDayBoundsUtc(today, tz);
      const [profileRes, waterRes, mealsRes] = await Promise.all([
        api.profile.get(),
        api.water.total({ from: bounds.from, to: bounds.to }),
        api.meals.list({ from: bounds.from, to: bounds.to, limit: 100 }),
      ]);
      profile = profileRes.profile;
      waterMl = waterRes.water.totalMl;
      lastMealAt =
        mealsRes.meals
          .map((meal) => meal.eatenAt)
          .sort()
          .at(-1) ?? null;
    } catch {
      // Karten bleiben aus.
    }

    // Health-Kacheln sind best-effort (Gesundheitsdaten sind optional) — ein
    // fehlgeschlagener Abruf blendet nur die jeweilige Kachel aus, nie die Seite.
    try {
      const tz = currentTzOffsetMinutes();
      const todayBounds = localDayBoundsUtc(today, tz);
      // Ruhepuls kommt oft nicht täglich rein — Fenster von 30 Tagen, um den
      // zeitlich letzten Wert sicher zu erfassen (`stats/health` sortiert aufsteigend).
      const recentFrom = localDayBoundsUtc(shiftDateString(today, -30), tz).from;
      const [stepsRes, kcalRes, hrRes] = await Promise.allSettled([
        api.stats.health({ metric: 'steps', from: todayBounds.from, to: todayBounds.to }),
        api.stats.health({ metric: 'active_kcal', from: todayBounds.from, to: todayBounds.to }),
        api.stats.health({ metric: 'resting_hr', from: recentFrom, to: todayBounds.to }),
      ]);
      if (stepsRes.status === 'fulfilled' && stepsRes.value.entries.length > 0) {
        todaySteps = Math.round(sumMetricValues(stepsRes.value.entries));
      }
      if (kcalRes.status === 'fulfilled' && kcalRes.value.entries.length > 0) {
        todayActiveKcal = Math.round(sumMetricValues(kcalRes.value.entries));
      }
      if (hrRes.status === 'fulfilled') {
        const latest = latestMetricEntry(hrRes.value.entries);
        if (latest) latestRestingHr = Math.round(latest.value);
      }
    } catch {
      // s.o.
    }
  });

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(getLocale() === 'de' ? 'de-DE' : 'en-US');
  }

  const todayLabel = $derived(
    new Date().toLocaleDateString(getLocale() === 'de' ? 'de-DE' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  );

  function routineExerciseLine(routine: RoutineDto): string {
    return routine.items
      .map((item) => item.exercise?.nameDe ?? item.exercise?.name)
      .filter((name): name is string => !!name)
      .join(', ');
  }

  async function startWorkout(routineId: string | null): Promise<void> {
    starting = true;
    startError = null;
    try {
      const id = crypto.randomUUID();
      await upsertWorkout(id, { startedAt: new Date().toISOString(), routineId });
      await goto(resolve('/workouts/[id]', { id }));
    } catch (err) {
      startError = describeError(err);
      starting = false;
    }
  }

  async function addWater(ml: number): Promise<void> {
    waterBusy = true;
    // Optimistisch: der Balken reagiert sofort, der Server zieht nach. Schlägt
    // das Loggen fehl, wird der Wert zurückgenommen.
    const previous = waterMl;
    waterMl += ml;
    try {
      await api.water.log({ ml });
    } catch {
      waterMl = previous;
    } finally {
      waterBusy = false;
    }
  }
</script>

{#if user}
  <h1>{m().home.todayTitle}</h1>
  <p class="page-subtitle">{todayLabel}</p>

  {#if loading}
    <div class="skeleton-list">
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
    </div>
  {:else}
    <h2 class="section-label">
      {m().home.overviewTitle}
      <a class="link-more" href={resolve('/nutrition')}>{m().home.toDiary}</a>
    </h2>
    <DaySummaryCard day={todayNutrition} targets={nutritionTargets} {burnedKcal} />

    {#if healthTiles.length > 0}
      <div class="stat-tiles">
        {#each healthTiles as tile (tile.key)}
          <div class="stat-tile">
            <span class="stat-tile-label">{tile.label}</span>
            <span class="stat-tile-value"
              >{tile.value}{#if tile.unit}<span class="stat-tile-unit">{tile.unit}</span
                >{/if}</span
            >
          </div>
        {/each}
      </div>
    {/if}

    <h2 class="section-label">{m().nav.workouts}</h2>
    {#if startError}
      <p class="error" role="alert">{startError}</p>
    {/if}
    {#if runningWorkout}
      <a class="list-card" href={resolve('/workouts/[id]', { id: runningWorkout.id })}>
        <div class="list-card-main">
          <span class="list-card-title">{m().workouts.inProgress}</span>
          <span class="list-card-meta">
            <span>{formatDate(runningWorkout.startedAt)}</span>
            <span>
              {runningWorkout.sets.length}
              {runningWorkout.sets.length === 1 ? m().workouts.setsOne : m().workouts.setsOther}
            </span>
          </span>
        </div>
        <span class="exercise-row-chevron"><Icon name="chevron-right" size={18} /></span>
      </a>
    {:else if todaysRoutine}
      <div class="card routine-card">
        <div class="routine-card-head">
          <strong class="routine-card-name">{todaysRoutine.name}</strong>
          <span class="weekday-badge">{m().home.todayBadge}</span>
        </div>
        {#if routineExerciseLine(todaysRoutine)}
          <p class="routine-card-exercises">{routineExerciseLine(todaysRoutine)}</p>
        {/if}
        <button
          type="button"
          class="primary routine-card-start"
          disabled={starting}
          onclick={() => startWorkout(todaysRoutine.id)}
        >
          {m().workouts.startButton}
        </button>
      </div>
    {:else}
      <a class="list-card" href={resolve('/workouts')}>
        <div class="list-card-main">
          <span class="list-card-title">{m().workouts.startButton}</span>
          {#if lastFinished}
            <span class="list-card-meta">
              <span>{m().home.lastWorkoutLabel} {formatDate(lastFinished.startedAt)}</span>
              <span>{computeVolumeKg(lastFinished.sets)} {m().common.kg}</span>
            </span>
          {/if}
        </div>
        <span class="exercise-row-chevron"><Icon name="chevron-right" size={18} /></span>
      </a>
    {/if}

    {#if profile?.waterTargetMl != null || profile?.fastingWindowH != null}
      <h2 class="section-label">{m().home.habitsTitle}</h2>
      {#if profile?.waterTargetMl != null}
        <WaterCard
          totalMl={waterMl}
          targetMl={profile.waterTargetMl}
          busy={waterBusy}
          onAdd={addWater}
        />
      {/if}
      <FastingCard {lastMealAt} windowH={profile?.fastingWindowH ?? null} />
    {:else}
      <FastingCard {lastMealAt} windowH={null} />
    {/if}

    <h2 class="section-label">
      {m().home.latestWeightTitle}
      <a class="link-more" href={resolve('/weight')}>{m().home.viewAll}</a>
    </h2>
    <div class="card">
      {#if latestWeight}
        <p class="latest-weight">
          {latestWeight.weightKg} {m().common.kg}
          <span class="muted">— {formatDate(latestWeight.measuredAt)}</span>
        </p>
      {:else}
        <p class="empty-state">{m().home.noWeightYet}</p>
      {/if}
    </div>
  {/if}
{/if}
