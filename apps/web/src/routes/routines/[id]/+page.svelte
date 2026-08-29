<script lang="ts">
  import { onMount } from 'svelte';
  import type { RoutineDto } from '@repfuel/shared';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { api } from '$lib/api.js';
  import RoutineEditor from '$lib/components/RoutineEditor.svelte';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';

  const routineId = $derived(page.params.id ?? '');

  let routine = $state<RoutineDto | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  onMount(async () => {
    try {
      const { routine: loaded } = await api.routines.get(routineId);
      routine = loaded;
    } catch (err) {
      loadError = describeError(err);
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <p class="muted">{m().common.loading}</p>
{:else if loadError}
  <p class="error" role="alert">{loadError}</p>
{:else if routine}
  <RoutineEditor
    {routine}
    onSaved={(updated) => (routine = updated)}
    onDeleted={() => void goto(resolve('/routines'))}
  />
{/if}
