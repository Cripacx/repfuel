<script lang="ts">
  import { onMount } from 'svelte';
  import type { RoutineDto, WorkoutDto } from '@repfuel/shared';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { api } from '$lib/api.js';
  import { describeError } from '$lib/errors.js';
  import { getLocale, m } from '$lib/i18n/index.js';
  import { hydrateWorkouts, listWorkoutsLocal, upsertWorkout } from '$lib/offline/repo.js';
  import { computeDurationMinutes, computeVolumeKg } from '$lib/workout/volume.js';

  let workouts = $state<WorkoutDto[]>([]);
  let routines = $state<RoutineDto[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let showStartOptions = $state(false);
  let starting = $state(false);

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

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(getLocale() === 'de' ? 'de-DE' : 'en-US');
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

<div class="page-header">
  <h1>{m().workouts.title}</h1>
  <button type="button" class="primary" onclick={() => (showStartOptions = !showStartOptions)}>
    {m().workouts.startButton}
  </button>
</div>

{#if showStartOptions}
  <section class="card">
    <h2>{m().workouts.startTitle}</h2>
    <div class="start-options">
      <button type="button" class="secondary" disabled={starting} onclick={() => startWorkout(null)}>
        {m().workouts.startEmpty}
      </button>
      {#if routines.length === 0}
        <p class="hint">{m().workouts.noRoutinesHint}</p>
      {:else}
        <p class="hint">{m().workouts.startFromRoutine}</p>
        {#each routines as routine (routine.id)}
          <button
            type="button"
            class="secondary"
            disabled={starting}
            onclick={() => startWorkout(routine.id)}
          >
            {routine.name}
          </button>
        {/each}
      {/if}
    </div>
  </section>
{/if}

{#if loading}
  <p class="muted">{m().common.loading}</p>
{:else}
  {#if loadError}
    <p class="error" role="alert">{loadError}</p>
  {/if}

  {#if workouts.length === 0}
    <p class="empty-state">{m().workouts.empty}</p>
  {:else}
    {#each workouts as workout (workout.id)}
      {@const durationMin = computeDurationMinutes(workout.startedAt, workout.finishedAt)}
      <a class="list-card" href={resolve('/workouts/[id]', { id: workout.id })}>
        <div class="list-card-main">
          <span class="list-card-title">{formatDateTime(workout.startedAt)}</span>
          <span class="list-card-meta">
            {#if routineName(workout.routineId)}
              <span>{routineName(workout.routineId)}</span>
            {/if}
            <span>
              {workout.sets.length}
              {workout.sets.length === 1 ? m().workouts.setsOne : m().workouts.setsOther}
            </span>
            {#if durationMin !== null}
              <span>{durationMin} {m().workouts.minutesShort}</span>
            {:else}
              <span>{m().workouts.inProgress}</span>
            {/if}
            <span>{computeVolumeKg(workout.sets)} {m().common.kg}</span>
          </span>
        </div>
      </a>
    {/each}
  {/if}
{/if}
