<script lang="ts">
  import { onMount } from 'svelte';
  import type { RoutineDto, WorkoutDto } from '@repfuel/shared';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { api } from '$lib/api.js';
  import Icon from '$lib/components/Icon.svelte';
  import { describeError } from '$lib/errors.js';
  import { getLocale, m } from '$lib/i18n/index.js';
  import { hydrateWorkouts, listWorkoutsLocal, upsertWorkout } from '$lib/offline/repo.js';
  import { computeDurationMinutes, computeVolumeKg } from '$lib/workout/volume.js';
  import { backendWeekdayIndex, weekdayKey } from '$lib/workout/weekday.js';

  /**
   * Training-Tab im vertrauten Hevy-Muster: Schnellstart oben, dann die
   * Routinen als Karten mit eigenem Start, darunter der Verlauf als Feed.
   * Starten passiert inline — kein Auf- und Zuklappen einer Optionen-Karte.
   */
  let workouts = $state<WorkoutDto[]>([]);
  let routines = $state<RoutineDto[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let starting = $state(false);

  const runningWorkout = $derived(workouts.find((w) => w.finishedAt === null) ?? null);
  const todayIndex = backendWeekdayIndex(new Date());
  const finishedWorkouts = $derived(workouts.filter((w) => w.finishedAt !== null));

  onMount(async () => {
    try {
      try {
        const { workouts: loaded } = await api.workouts.list({ limit: 50 });
        await hydrateWorkouts(loaded);
        workouts = loaded;
      } catch (err) {
        if (!(err instanceof TypeError)) throw err;
        workouts = await listWorkoutsLocal(50);
      }
      // Routinen sind kein Offline-Datentyp (M4-Scope) — ohne Netzwerk bleibt die
      // Zuordnung "Workout -> Routinenname" in der Liste einfach leer.
      try {
        const { routines: loadedRoutines } = await api.routines.list();
        routines = loadedRoutines;
      } catch {
        routines = [];
      }
    } catch (err) {
      loadError = describeError(err);
    } finally {
      loading = false;
    }
  });

  function routineName(routineId: string | null): string | null {
    if (!routineId) return null;
    return routines.find((r) => r.id === routineId)?.name ?? null;
  }

  function routineExerciseLine(routine: RoutineDto): string {
    return routine.items
      .map((item) => item.exercise?.nameDe ?? item.exercise?.name)
      .filter((name): name is string => !!name)
      .join(', ');
  }

  function weekdayLabel(routine: RoutineDto): string | null {
    if (routine.weekday === null) return null;
    const key = weekdayKey(routine.weekday);
    return key ? m().weekdays[key] : null;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(getLocale() === 'de' ? 'de-DE' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  async function startWorkout(routineId: string | null): Promise<void> {
    starting = true;
    loadError = null;
    try {
      const id = crypto.randomUUID();
      await upsertWorkout(id, {
        startedAt: new Date().toISOString(),
        routineId,
      });
      await goto(resolve('/workouts/[id]', { id }));
    } catch (err) {
      loadError = describeError(err);
      starting = false;
    }
  }
</script>

<h1>{m().workouts.title}</h1>

{#if loadError}
  <p class="error" role="alert">{loadError}</p>
{/if}

{#if loading}
  <div class="skeleton-list">
    <div class="skeleton-row"></div>
    <div class="skeleton-row"></div>
  </div>
{:else}
  <h2 class="section-label">{m().workouts.quickStartTitle}</h2>
  {#if runningWorkout}
    <a class="list-card" href={resolve('/workouts/[id]', { id: runningWorkout.id })}>
      <div class="list-card-main">
        <span class="list-card-title">{m().workouts.continueButton}</span>
        <span class="list-card-meta">
          <span>{m().workouts.inProgress}</span>
          <span>
            {runningWorkout.sets.length}
            {runningWorkout.sets.length === 1 ? m().workouts.setsOne : m().workouts.setsOther}
          </span>
        </span>
      </div>
      <span class="exercise-row-chevron"><Icon name="chevron-right" size={18} /></span>
    </a>
  {/if}
  <button
    type="button"
    class="quick-start-row"
    disabled={starting}
    onclick={() => startWorkout(null)}
  >
    <Icon name="plus" />
    {m().workouts.startEmpty}
  </button>
  <a class="quick-start-row" href={resolve('/exercises')}>
    <Icon name="book" />
    {m().exercises.openLibrary}
    <span class="exercise-row-chevron"><Icon name="chevron-right" size={18} /></span>
  </a>

  <h2 class="section-label">
    {m().routines.title}
    <a
      class="icon-btn"
      href={resolve('/routines/new')}
      aria-label={m().routines.createButton}
    >
      <Icon name="plus" />
    </a>
  </h2>
  {#if routines.length === 0}
    <div class="card">
      <p class="empty-state">{m().workouts.noRoutinesHint}</p>
      <a class="secondary" href={resolve('/routines/new')}>{m().routines.createButton}</a>
    </div>
  {:else}
    {#each routines as routine (routine.id)}
      <div class="card routine-card">
        <div class="routine-card-head">
          <a class="routine-card-name" href={resolve('/routines/[id]', { id: routine.id })}>
            {routine.name}
          </a>
          {#if weekdayLabel(routine)}
            <span class="weekday-badge">{weekdayLabel(routine)}</span>
          {/if}
        </div>
        {#if routineExerciseLine(routine)}
          <p class="routine-card-exercises">{routineExerciseLine(routine)}</p>
        {/if}
        <button
          type="button"
          class={`routine-card-start ${routine.weekday === todayIndex ? 'primary' : 'tonal'}`}
          disabled={starting}
          onclick={() => startWorkout(routine.id)}
        >
          {m().workouts.startRoutineButton}
        </button>
      </div>
    {/each}
  {/if}

  <h2 class="section-label">{m().stats.historyTitle}</h2>
  {#if finishedWorkouts.length === 0}
    <div class="card">
      <p class="empty-state">{m().workouts.empty}</p>
    </div>
  {:else}
    {#each finishedWorkouts as workout (workout.id)}
      {@const durationMin = computeDurationMinutes(workout.startedAt, workout.finishedAt)}
      <a class="list-card workout-feed-card" href={resolve('/workouts/[id]', { id: workout.id })}>
        <div class="list-card-main">
          <span class="list-card-title">
            {routineName(workout.routineId) ?? m().workouts.session.freeWorkoutTitle}
          </span>
          <span class="list-card-meta">{formatDate(workout.startedAt)}</span>
          <span class="workout-feed-stats">
            <span class="workout-feed-stat">
              <span class="workout-feed-stat-label">{m().workouts.session.summaryDuration}</span>
              <span class="workout-feed-stat-value">
                {durationMin !== null ? `${durationMin} ${m().workouts.minutesShort}` : '—'}
              </span>
            </span>
            <span class="workout-feed-stat">
              <span class="workout-feed-stat-label">{m().workouts.session.summarySets}</span>
              <span class="workout-feed-stat-value">{workout.sets.length}</span>
            </span>
            <span class="workout-feed-stat">
              <span class="workout-feed-stat-label">{m().workouts.session.summaryVolume}</span>
              <span class="workout-feed-stat-value">
                {computeVolumeKg(workout.sets)} {m().common.kg}
              </span>
            </span>
          </span>
        </div>
        <span class="exercise-row-chevron"><Icon name="chevron-right" size={18} /></span>
      </a>
    {/each}
  {/if}
{/if}
