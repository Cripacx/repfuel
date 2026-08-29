<script lang="ts">
  import { onMount } from 'svelte';
  import type { RoutineDto } from '@repfuel/shared';
  import { resolve } from '$app/paths';
  import { api } from '$lib/api.js';
  import Icon from '$lib/components/Icon.svelte';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';
  import { weekdayKey } from '$lib/workout/weekday.js';

  let routines = $state<RoutineDto[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  onMount(async () => {
    try {
      const { routines: loaded } = await api.routines.list();
      routines = loaded;
    } catch (err) {
      loadError = describeError(err);
    } finally {
      loading = false;
    }
  });

  function weekdayLabel(weekday: number | null): string | null {
    const key = weekday === null ? null : weekdayKey(weekday);
    return key ? m().weekdays[key] : null;
  }

</script>

<div class="page-header">
  <h1>{m().routines.title}</h1>
  <a class="primary" href={resolve('/routines/new')}>{m().routines.createButton}</a>
</div>

{#if loading}
  <div class="skeleton-list">
    <div class="skeleton-row"></div>
    <div class="skeleton-row"></div>
  </div>
{:else}
  {#if loadError}
    <p class="error" role="alert">{loadError}</p>
  {/if}

  {#if routines.length === 0}
    <div class="card">
      <p class="empty-state">{m().routines.empty}</p>
      <a class="secondary" href={resolve('/routines/new')}>{m().routines.createButton}</a>
    </div>
  {:else}
    {#each routines as routine (routine.id)}
      <a class="list-card" href={resolve('/routines/[id]', { id: routine.id })}>
        <div class="list-card-main">
          <span class="list-card-title">{routine.name}</span>
          <span class="list-card-meta">
            {#if weekdayLabel(routine.weekday)}
              <span class="weekday-badge">{weekdayLabel(routine.weekday)}</span>
            {/if}
            <span>
              {routine.items.length}
              {routine.items.length === 1 ? m().routines.itemsOne : m().routines.itemsOther}
            </span>
          </span>
        </div>
        <span class="exercise-row-chevron"><Icon name="chevron-right" size={18} /></span>
      </a>
    {/each}
  {/if}
{/if}
