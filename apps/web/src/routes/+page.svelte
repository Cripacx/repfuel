<script lang="ts">
  import { onMount } from 'svelte';
  import type { BodyWeightDto, NutritionDayDto, NutritionTargets, WorkoutDto } from '@repfuel/shared';
  import { resolve } from '$app/paths';
  import { api } from '$lib/api.js';
  import { getUser } from '$lib/auth.svelte.js';
  import { getLocale, m } from '$lib/i18n/index.js';
  import { currentTzOffsetMinutes, todayDateString } from '$lib/nutrition/day-range.js';
  import { roundKcal } from '$lib/nutrition/format.js';
  import { computeProgress } from '$lib/nutrition/progress.js';
  import { computeVolumeKg } from '$lib/workout/volume.js';

  const user = $derived(getUser());

  let recentWorkouts = $state<WorkoutDto[]>([]);
  let latestWeight = $state<BodyWeightDto | null>(null);
  let todayNutrition = $state<NutritionDayDto | null>(null);
  let nutritionTargets = $state<NutritionTargets | null>(null);
  let loading = $state(true);

  const kcalProgress = $derived(
    todayNutrition && nutritionTargets
      ? computeProgress(todayNutrition.kcal, nutritionTargets.kcalTarget)
      : null,
  );

  onMount(async () => {
    const today = todayDateString();
    try {
      const [workoutsRes, weightRes, nutritionRes] = await Promise.all([
        api.workouts.list({ limit: 3 }),
        api.weight.list({ limit: 1 }),
        api.stats.nutrition({ from: today, to: today, tzOffsetMinutes: currentTzOffsetMinutes() }),
      ]);
      recentWorkouts = workoutsRes.workouts;
      latestWeight = weightRes.entries[0] ?? null;
      todayNutrition = nutritionRes.days.find((d) => d.date === today) ?? null;
      nutritionTargets = nutritionRes.targets;
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
      <a class="quick-action" href={resolve('/nutrition')}>
        <span class="quick-action-icon" aria-hidden="true">🍽️</span>
        {m().home.viewNutrition}
      </a>
    </div>
  </section>

  {#if !loading}
    <section class="card">
      <h2>{m().home.todayNutritionTitle}</h2>
      {#if todayNutrition && nutritionTargets?.kcalTarget != null}
        <p class="latest-weight">
          {roundKcal(todayNutrition.kcal)} / {nutritionTargets.kcalTarget}
          {m().nutrition.kcalUnit}
        </p>
        {#if kcalProgress}
          <div class="progress-bar">
            <div
              class="progress-bar-fill kcal"
              class:over={kcalProgress.over}
              style={`width:${kcalProgress.cappedPercent}%`}
            ></div>
          </div>
          {#if kcalProgress.over && nutritionTargets?.kcalTarget != null}
            <p class="over-hint">
              +{Math.round(todayNutrition ? todayNutrition.kcal - nutritionTargets.kcalTarget : 0)}
              {m().nutrition.kcalUnit} {m().nutrition.overTargetLabel}
            </p>
          {/if}
        {/if}
      {:else if todayNutrition}
        <p class="latest-weight">{roundKcal(todayNutrition.kcal)} {m().nutrition.kcalUnit}</p>
        <p class="muted">
          {m().home.noTargetSet}
          <a href={resolve('/goals')}>{m().home.setGoalsLink}</a>
        </p>
      {:else}
        <p class="empty-state">{m().nutrition.emptyMealGroup}</p>
      {/if}
      <a class="link-more" href={resolve('/nutrition')}>{m().home.logMeal}</a>
    </section>

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
