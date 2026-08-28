<script lang="ts">
  import { EXERCISE_MEDIA_ATTRIBUTION_URL, type ExerciseDto } from '@repfuel/shared';
  import { api } from '$lib/api.js';
  import { debounce } from '$lib/debounce.js';
  import ExerciseThumb from './ExerciseThumb.svelte';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';

  /**
   * Übungs-Suche (debounced gegen GET /exercises?q=) mit Option, direkt eine eigene
   * Übung anzulegen. Wird sowohl im Routinen-Editor als auch im Workout-Logging genutzt;
   * ruft bei Auswahl/Erstellung `onSelect` mit der vollständigen ExerciseDto auf.
   */
  let { onSelect }: { onSelect: (exercise: ExerciseDto) => void } = $props();

  let query = $state('');
  let results = $state<ExerciseDto[]>([]);
  let searching = $state(false);
  let searchError = $state<string | null>(null);

  let showCustomForm = $state(false);
  let customName = $state('');
  let customMuscleGroups = $state<string[]>([]);
  let customMuscleInput = $state('');
  let customEquipment = $state('');
  let creating = $state(false);
  let createError = $state<string | null>(null);

  const runSearch = debounce(async (q: string) => {
    searching = true;
    searchError = null;
    try {
      const { exercises } = await api.exercises.list({ q: q.trim() || undefined, limit: 30 });
      results = exercises;
    } catch (err) {
      searchError = describeError(err);
    } finally {
      searching = false;
    }
  }, 300);

  $effect(() => {
    runSearch(query);
  });

  function exerciseLabel(exercise: ExerciseDto): string {
    return exercise.nameDe ?? exercise.name;
  }

  function addMuscleGroup(): void {
    const value = customMuscleInput.trim();
    if (value && !customMuscleGroups.includes(value)) {
      customMuscleGroups = [...customMuscleGroups, value];
    }
    customMuscleInput = '';
  }

  function removeMuscleGroup(group: string): void {
    customMuscleGroups = customMuscleGroups.filter((g) => g !== group);
  }

  function handleMuscleInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addMuscleGroup();
    }
  }

  async function createCustomExercise(): Promise<void> {
    if (!customName.trim()) {
      createError = m().exercises.nameRequired;
      return;
    }
    creating = true;
    createError = null;
    try {
      const { exercise } = await api.exercises.create({
        name: customName.trim(),
        muscleGroups: customMuscleGroups,
        equipment: customEquipment.trim() || null,
      });
      onSelect(exercise);
    } catch (err) {
      createError = describeError(err);
    } finally {
      creating = false;
    }
  }
</script>

<div class="picker">
  <label for="exercise-search">{m().exercises.searchLabel}</label>
  <input
    id="exercise-search"
    type="text"
    placeholder={m().exercises.searchPlaceholder}
    autocomplete="off"
    bind:value={query}
  />

  {#if searchError}
    <p class="error" role="alert">{searchError}</p>
  {:else if !searching && results.length === 0}
    <p class="empty-state">{m().exercises.noResults}</p>
  {:else if results.length > 0}
    <ul class="picker-results">
      {#each results as exercise (exercise.id)}
        <li>
          <button type="button" class="picker-result-btn" onclick={() => onSelect(exercise)}>
            <ExerciseThumb mediaUrl={exercise.mediaUrl} name={exerciseLabel(exercise)} />
            <span class="picker-result-text">
              {exerciseLabel(exercise)}
              {#if exercise.muscleGroups.length > 0}
                <span class="picker-result-meta">{exercise.muscleGroups.join(', ')}</span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
    {#if results.some((exercise) => exercise.mediaUrl !== null)}
      <!-- Lizenzbedingung für die Übungsmedien — nicht entfernen, siehe
           apps/server/src/modules/workout/seed/README.md. -->
      <p class="picker-attribution">
        <a href={EXERCISE_MEDIA_ATTRIBUTION_URL} target="_blank" rel="external noreferrer noopener">
          © Gym visual
        </a>
      </p>
    {/if}
  {/if}

  <button
    type="button"
    class="secondary"
    onclick={() => (showCustomForm = !showCustomForm)}
    aria-expanded={showCustomForm}
  >
    {m().exercises.createCustomToggle}
  </button>

  {#if showCustomForm}
    <div class="card">
      <label for="custom-exercise-name">{m().exercises.customNameLabel}</label>
      <input
        id="custom-exercise-name"
        type="text"
        placeholder={m().exercises.customNamePlaceholder}
        bind:value={customName}
      />

      <label for="custom-muscle-groups">{m().exercises.customMuscleGroupsLabel}</label>
      <div class="chip-input">
        {#each customMuscleGroups as group (group)}
          <span class="chip">
            {group}
            <button
              type="button"
              onclick={() => removeMuscleGroup(group)}
              aria-label={m().common.remove}
            >
              ×
            </button>
          </span>
        {/each}
        <input
          id="custom-muscle-groups"
          type="text"
          placeholder={m().exercises.customMuscleGroupsPlaceholder}
          bind:value={customMuscleInput}
          onkeydown={handleMuscleInputKeydown}
          onblur={addMuscleGroup}
        />
      </div>
      <p class="hint">{m().exercises.customMuscleGroupsHint}</p>

      <label for="custom-equipment">{m().exercises.customEquipmentLabel}</label>
      <input
        id="custom-equipment"
        type="text"
        placeholder={m().exercises.customEquipmentPlaceholder}
        bind:value={customEquipment}
      />

      {#if createError}
        <p class="error" role="alert">{createError}</p>
      {/if}

      <button type="button" class="primary" onclick={createCustomExercise} disabled={creating}>
        {creating ? m().common.saving : m().exercises.createButton}
      </button>
    </div>
  {/if}
</div>
