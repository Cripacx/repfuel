<script lang="ts">
  import type { ExerciseDto } from '@repfuel/shared';
  import { api } from '$lib/api.js';
  import ExerciseAnimation from '$lib/components/ExerciseAnimation.svelte';
  import ExerciseThumb from '$lib/components/ExerciseThumb.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { debounce } from '$lib/debounce.js';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';
  import { EXERCISE_MEDIA_ATTRIBUTION_URL } from '@repfuel/shared';

  /**
   * Übungsbibliothek zum Stöbern — bewusst kein Tab, sondern von der
   * Trainingsseite aus erreichbar: man kommt hierher, um etwas nachzuschlagen,
   * nicht um hier zu wohnen.
   *
   * Der Picker in Routine-Editor und Workout bleibt davon unberührt; er löst
   * eine andere Aufgabe (auswählen statt nachschlagen).
   */
  const PAGE_SIZE = 40;

  let query = $state('');
  let muscle = $state<string | null>(null);
  let equipment = $state<string | null>(null);

  let exercises = $state<ExerciseDto[]>([]);
  let muscles = $state<string[]>([]);
  let equipmentValues = $state<string[]>([]);

  let loading = $state(true);
  let loadingMore = $state(false);
  let loadError = $state<string | null>(null);
  let reachedEnd = $state(false);

  function exerciseLabel(exercise: ExerciseDto): string {
    return exercise.nameDe ?? exercise.name;
  }

  /** "Abs · Body Weight" — primärer Zielmuskel und Equipment, sonst nichts. */
  function exerciseMeta(exercise: ExerciseDto): string {
    return [exercise.muscleGroups[0], exercise.equipment].filter(Boolean).join(' · ');
  }

  const runSearch = debounce(async () => {
    loading = true;
    loadError = null;
    try {
      const { exercises: found } = await api.exercises.list({
        q: query.trim() || undefined,
        muscle: muscle ?? undefined,
        equipment: equipment ?? undefined,
        limit: PAGE_SIZE,
      });
      exercises = found;
      reachedEnd = found.length < PAGE_SIZE;
    } catch (err) {
      loadError = describeError(err);
    } finally {
      loading = false;
    }
  }, 250);

  // Läuft bei jeder Filteränderung — die Abhängigkeiten werden bewusst gelesen.
  $effect(() => {
    void query;
    void muscle;
    void equipment;
    runSearch();
  });

  $effect(() => {
    void (async () => {
      try {
        const { facets } = await api.exercises.facets();
        muscles = facets.muscles;
        equipmentValues = facets.equipment;
      } catch {
        // Ohne Facetten bleibt die Suche nutzbar — nur die Chips fehlen dann.
      }
    })();
  });

  async function loadMore(): Promise<void> {
    if (loadingMore || reachedEnd) return;
    loadingMore = true;
    try {
      const { exercises: next } = await api.exercises.list({
        q: query.trim() || undefined,
        muscle: muscle ?? undefined,
        equipment: equipment ?? undefined,
        limit: PAGE_SIZE,
        offset: exercises.length,
      });
      exercises = [...exercises, ...next];
      if (next.length < PAGE_SIZE) reachedEnd = true;
    } catch (err) {
      loadError = describeError(err);
    } finally {
      loadingMore = false;
    }
  }

  const hasFilter = $derived(query.trim() !== '' || muscle !== null || equipment !== null);

  function clearFilters(): void {
    query = '';
    muscle = null;
    equipment = null;
  }

  // --- Detail-Sheet -------------------------------------------------------
  // Alle Daten stecken bereits in der Listen-DTO — das Sheet öffnet ohne
  // weiteren Request und damit ohne Ladezustand.
  let detail = $state<ExerciseDto | null>(null);
</script>

<svelte:head><title>{m().exercises.libraryTitle}</title></svelte:head>

<section class="page-header">
  <div>
    <h1>{m().exercises.libraryTitle}</h1>
    <p class="muted">{m().exercises.librarySubtitle}</p>
  </div>
</section>

<div class="exercise-filters">
  <input
    type="search"
    autocomplete="off"
    placeholder={m().exercises.searchPlaceholder}
    aria-label={m().exercises.searchLabel}
    bind:value={query}
  />

  {#if muscles.length > 0}
    <div class="chip-row" role="group" aria-label={m().exercises.customMuscleGroupsLabel}>
      <button type="button" class="chip" class:active={muscle === null} onclick={() => (muscle = null)}>
        {m().exercises.filterAllMuscles}
      </button>
      {#each muscles as value (value)}
        <button
          type="button"
          class="chip"
          class:active={muscle === value}
          onclick={() => (muscle = muscle === value ? null : value)}
        >
          {value}
        </button>
      {/each}
    </div>
  {/if}

  {#if equipmentValues.length > 0}
    <div class="chip-row" role="group" aria-label={m().exercises.customEquipmentLabel}>
      <button
        type="button"
        class="chip"
        class:active={equipment === null}
        onclick={() => (equipment = null)}
      >
        {m().exercises.filterAllEquipment}
      </button>
      {#each equipmentValues as value (value)}
        <button
          type="button"
          class="chip"
          class:active={equipment === value}
          onclick={() => (equipment = equipment === value ? null : value)}
        >
          {value}
        </button>
      {/each}
    </div>
  {/if}
</div>

{#if loadError}
  <p class="error" role="alert">{loadError}</p>
{:else if loading}
  <p class="muted" role="status">{m().common.loading}</p>
{:else if exercises.length === 0}
  <p class="empty-state">
    {m().exercises.noResults}
    {#if hasFilter}
      <button type="button" class="secondary" onclick={clearFilters}>
        {m().exercises.filterReset}
      </button>
    {/if}
  </p>
{:else}
  <ul class="exercise-library">
    {#each exercises as exercise (exercise.id)}
      <li>
        <button type="button" class="exercise-row-btn" onclick={() => (detail = exercise)}>
          <ExerciseThumb mediaUrl={exercise.mediaUrl} name={exerciseLabel(exercise)} />
          <span class="exercise-library-text">
            <span class="exercise-library-name">{exerciseLabel(exercise)}</span>
            {#if exerciseMeta(exercise)}
              <span class="exercise-library-meta">{exerciseMeta(exercise)}</span>
            {/if}
          </span>
          <span class="exercise-row-chevron"><Icon name="chevron-right" size={18} /></span>
        </button>
      </li>
    {/each}
  </ul>

  {#if !reachedEnd}
    <button type="button" class="secondary" onclick={loadMore} disabled={loadingMore}>
      {loadingMore ? m().common.loading : m().exercises.loadMore}
    </button>
  {/if}

  <!-- Lizenzbedingung für die Übungsmedien — nicht entfernen, siehe
       apps/server/src/modules/workout/seed/README.md. -->
  <p class="picker-attribution">
    <a href={EXERCISE_MEDIA_ATTRIBUTION_URL} target="_blank" rel="external noreferrer noopener">
      © Gym visual
    </a>
  </p>
{/if}

{#if detail}
  <Modal title={exerciseLabel(detail)} onClose={() => (detail = null)}>
    <div class="exercise-detail">
      <ExerciseAnimation mediaUrl={detail.mediaUrl} gifUrl={detail.gifUrl} />

      <div class="tag-row">
        {#each detail.muscleGroups as group (group)}
          <span class="tag">{group}</span>
        {/each}
        {#if detail.equipment}
          <span class="tag tag-equipment">{detail.equipment}</span>
        {/if}
      </div>

      <section class="exercise-detail-section">
        <h3>{m().exercises.howToTitle}</h3>
        {#if detail.instructions.length > 0}
          {#if m().exercises.howToEnglishHint}
            <p class="hint">{m().exercises.howToEnglishHint}</p>
          {/if}
          <ol class="howto-steps">
            {#each detail.instructions as step, i (i)}
              <li>{step}</li>
            {/each}
          </ol>
        {:else}
          <p class="empty-state">{m().exercises.noInstructions}</p>
        {/if}
      </section>
    </div>
  </Modal>
{/if}
