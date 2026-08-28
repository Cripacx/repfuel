<script lang="ts">
  import { onMount } from 'svelte';
  import type { RoutineDto } from '@repfuel/shared';
  import { resolve } from '$app/paths';
  import { requestConfirm } from '$lib/confirm.svelte.js';
  import { api } from '$lib/api.js';
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

  async function removeRoutine(routine: RoutineDto): Promise<void> {
    if (!(await requestConfirm({ message: m().routines.confirmDelete, confirmLabel: m().common.delete }))) return;
    loadError = null;
    try {
      await api.routines.remove(routine.id);
      routines = routines.filter((r) => r.id !== routine.id);
    } catch (err) {
      loadError = describeError(err);
    }
  }
</script>

<div class="page-header">
  <h1>{m().routines.title}</h1>
  <a class="primary" href={resolve('/routines/new')}>{m().routines.createButton}</a>
</div>

{#if loading}
  <p class="muted">{m().common.loading}</p>
{:else}
  {#if loadError}
    <p class="error" role="alert">{loadError}</p>
  {/if}

  {#if routines.length === 0}
    <p class="empty-state">{m().routines.empty}</p>
  {:else}
    {#each routines as routine (routine.id)}
      <div class="list-card">
        <a class="list-card-main" href={resolve('/routines/[id]', { id: routine.id })}>
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
        </a>
        <div class="list-card-actions">
          <button type="button" class="danger" onclick={() => removeRoutine(routine)}>
            {m().common.delete}
          </button>
        </div>
      </div>
    {/each}
  {/if}
{/if}
