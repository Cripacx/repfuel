<script lang="ts">
  import { onMount } from 'svelte';
  import type { BodyWeightDto, WorkoutDto } from '@repfuel/shared';
  import { resolve } from '$app/paths';
  import { api } from '$lib/api.js';
  import { getUser } from '$lib/auth.svelte.js';
  import { getLocale, m } from '$lib/i18n/index.js';
  import { computeVolumeKg } from '$lib/workout/volume.js';

  const user = $derived(getUser());

  let recentWorkouts = $state<WorkoutDto[]>([]);
  let latestWeight = $state<BodyWeightDto | null>(null);
  let loading = $state(true);

  onMount(async () => {
    try {
      const [workoutsRes, weightRes] = await Promise.all([
        api.workouts.list({ limit: 3 }),
        api.weight.list({ limit: 1 }),
      ]);
      recentWorkouts = workoutsRes.workouts;
      latestWeight = weightRes.entries[0] ?? null;
    } catch {
      // Startseite bleibt auch ohne Daten benutzbar — kein Fehlerbanner nötig.
    } finally {
      loading = false;
    }
  });

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(getLocale() === 'de' ? 'de-DE' : 'en-US');
  }
</script>

{#if user}
  <section class="card">
    <h1>{m().home.greeting} {user.username}</h1>
    <p class="muted">
      {user.role === 'admin' ? m().roles.admin : m().roles.user}
    </p>

    {#if user.role === 'admin'}
      <p>
        {m().home.adminLinkHint}
        <a href={resolve('/admin')}>{m().home.goToAdmin}</a>
      </p>
    {/if}
  </section>

  <section class="card">
    <h2>{m().home.quickActionsTitle}</h2>
    <div class="quick-actions">
      <a class="quick-action" href={resolve('/workouts')}>
        <span class="quick-action-icon" aria-hidden="true">🏋️</span>
        {m().home.startWorkout}
      </a>
      <a class="quick-action" href={resolve('/routines')}>
        <span class="quick-action-icon" aria-hidden="true">📋</span>
        {m().home.viewRoutines}
      </a>
      <a class="quick-action" href={resolve('/weight')}>
        <span class="quick-action-icon" aria-hidden="true">⚖️</span>
        {m().home.viewWeight}
      </a>
    </div>
  </section>

  {#if !loading}
    <section class="card">
      <h2>{m().home.recentWorkoutsTitle}</h2>
      {#if recentWorkouts.length === 0}
        <p class="empty-state">{m().home.noRecentWorkouts}</p>
      {:else}
        <ul class="plain-list">
          {#each recentWorkouts as workout (workout.id)}
            <li>
              <a href={resolve('/workouts/[id]', { id: workout.id })}>
                {formatDate(workout.startedAt)}
              </a>
              <span class="muted">
                {workout.sets.length}
                {workout.sets.length === 1 ? m().workouts.setsOne : m().workouts.setsOther} ·
                {computeVolumeKg(workout.sets)}
                {m().common.kg}
              </span>
            </li>
          {/each}
        </ul>
        <a class="link-more" href={resolve('/workouts')}>{m().home.viewAll}</a>
      {/if}
    </section>

    <section class="card">
      <h2>{m().home.latestWeightTitle}</h2>
      {#if latestWeight}
        <p class="latest-weight">
          {latestWeight.weightKg} {m().common.kg}
          <span class="muted">— {formatDate(latestWeight.measuredAt)}</span>
        </p>
      {:else}
        <p class="empty-state">{m().home.noWeightYet}</p>
      {/if}
      <a class="link-more" href={resolve('/weight')}>{m().home.viewAll}</a>
    </section>
  {/if}
{/if}
