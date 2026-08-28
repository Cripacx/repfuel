<script lang="ts">
  import { onMount } from 'svelte';
  import type {
    BodyWeightDto,
    NutritionDayDto,
    NutritionTargets,
    ProfileDto,
    WorkoutDto,
  } from '@repfuel/shared';
  import { resolve } from '$app/paths';
  import { api } from '$lib/api.js';
  import FastingCard from '$lib/components/FastingCard.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import KcalRing from '$lib/components/KcalRing.svelte';
  import MacroBars from '$lib/components/MacroBars.svelte';
  import WaterCard from '$lib/components/WaterCard.svelte';
  import { getUser } from '$lib/auth.svelte.js';
  import { latestMetricEntry, sumMetricValues } from '$lib/health/dashboard.js';
  import { getLocale, m } from '$lib/i18n/index.js';
  import {
    currentTzOffsetMinutes,
    localDayBoundsUtc,
    shiftDateString,
    todayDateString,
  } from '$lib/nutrition/day-range.js';
  import { roundKcal } from '$lib/nutrition/format.js';
  import { computeVolumeKg } from '$lib/workout/volume.js';

  const user = $derived(getUser());

  let recentWorkouts = $state<WorkoutDto[]>([]);
  let latestWeight = $state<BodyWeightDto | null>(null);
  let profile = $state<ProfileDto | null>(null);
  let waterMl = $state(0);
  let waterBusy = $state(false);
  let lastMealAt = $state<string | null>(null);
  let todayNutrition = $state<NutritionDayDto | null>(null);
  let nutritionTargets = $state<NutritionTargets | null>(null);
  let loading = $state(true);

  let todaySteps = $state<number | null>(null);
  let todayActiveKcal = $state<number | null>(null);
  let latestRestingHr = $state<number | null>(null);

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
        <span class="quick-action-icon"><Icon name="dumbbell" size={24} /></span>
        {m().home.startWorkout}
      </a>
      <a class="quick-action" href={resolve('/routines')}>
        <span class="quick-action-icon"><Icon name="clipboard" size={24} /></span>
        {m().home.viewRoutines}
      </a>
      <a class="quick-action" href={resolve('/exercises')}>
        <span class="quick-action-icon"><Icon name="book" size={24} /></span>
        {m().exercises.openLibrary}
      </a>
      <a class="quick-action" href={resolve('/weight')}>
        <span class="quick-action-icon"><Icon name="scale" size={24} /></span>
        {m().home.viewWeight}
      </a>
      <a class="quick-action" href={resolve('/goals')}>
        <span class="quick-action-icon"><Icon name="target" size={24} /></span>
        {m().nav.goals}
      </a>
      <a class="quick-action" href={resolve('/nutrition')}>
        <span class="quick-action-icon"><Icon name="utensils" size={24} /></span>
        {m().home.viewNutrition}
      </a>
    </div>
  </section>

  {#if !loading}
    {#if healthTiles.length > 0}
      <section class="card">
        <h2>{m().home.healthTitle}</h2>
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
      </section>
    {/if}

    <section class="card">
      <h2>{m().home.todayNutritionTitle}</h2>
      {#if todayNutrition && nutritionTargets?.kcalTarget != null}
        <KcalRing kcal={todayNutrition.kcal} target={nutritionTargets.kcalTarget} />
        <p class="kcal-consumed">
          {roundKcal(todayNutrition.kcal)} / {nutritionTargets.kcalTarget}
          {m().nutrition.kcalUnit}
        </p>
        <MacroBars day={todayNutrition} targets={nutritionTargets} />
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

    {#if profile?.waterTargetMl != null}
      <WaterCard
        totalMl={waterMl}
        targetMl={profile.waterTargetMl}
        busy={waterBusy}
        onAdd={addWater}
      />
    {/if}

    <FastingCard {lastMealAt} windowH={profile?.fastingWindowH ?? null} />

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
