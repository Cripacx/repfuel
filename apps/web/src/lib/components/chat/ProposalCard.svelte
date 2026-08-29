<script lang="ts">
  import type { ExerciseDto, ProposalDto, ProposalStatus } from '@repfuel/shared';
  import { EXERCISE_MEDIA_ATTRIBUTION_URL } from '@repfuel/shared';
  import { api } from '$lib/api.js';
  import {
    extractRoutineItems,
    formatProposalPayload,
    humanizeKey,
    stripDisplayHelpers,
    type ProposalField,
    type RoutineItemPreview,
  } from '$lib/chat/proposal-format.js';
  import ExerciseAnimation from '$lib/components/ExerciseAnimation.svelte';
  import ExerciseThumb from '$lib/components/ExerciseThumb.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';

  /**
   * Bestätigungs-Flow für KI-Schreibvorschläge (`create_routine` /
   * `update_routine` / `update_profile`). Nichts wird geschrieben, bevor der
   * Nutzer hier bestätigt — dieser Guard ist Architekturvorgabe, kein UI-Detail.
   *
   * Routinen-Vorschläge zeigen ihre Übungen wie im Übungskatalog (Thumbnail,
   * Name, Muskelgruppe). Ein Tap öffnet ein Sheet mit Details und einer Liste
   * ähnlicher Übungen (gleiche primäre Muskelgruppe) — Antippen tauscht die
   * Übung im offenen Vorschlag (server-seitig persistiert, Sätze bleiben).
   */
  let {
    proposal,
    offline = false,
    onResolved,
    onUpdated,
  }: {
    proposal: ProposalDto;
    offline?: boolean;
    onResolved?: (proposal: ProposalDto) => void;
    onUpdated?: (proposal: ProposalDto) => void;
  } = $props();

  let expanded = $state(false);
  let busy = $state<'confirm' | 'reject' | null>(null);
  let resolvedStatus = $state<ProposalStatus | null>(null);
  let actionError = $state<string | null>(null);

  const fields = $derived(formatProposalPayload(stripDisplayHelpers(proposal.payload)));
  const routineItems = $derived(
    proposal.kind === 'update_profile' ? [] : extractRoutineItems(proposal.payload),
  );
  const status = $derived(resolvedStatus ?? proposal.status);
  const done = $derived(status !== 'pending');
  const kindLabel = $derived(
    proposal.kind === 'update_routine'
      ? m().chat.proposals.kindRoutine
      : proposal.kind === 'create_routine'
        ? m().chat.proposals.kindCreateRoutine
        : m().chat.proposals.kindProfile,
  );

  // --- Übungs-Details: volle DTOs (Thumbnail, Muskeln, Anleitung) nachladen ---
  let exerciseMap = $state<Record<string, ExerciseDto>>({});

  $effect(() => {
    const missing = routineItems
      .map((item) => item.exerciseId)
      .filter((id) => id !== '' && !(id in exerciseMap));
    if (missing.length === 0 || offline) return;
    void (async () => {
      try {
        const { exercises } = await api.exercises.byIds(missing);
        const next = { ...exerciseMap };
        for (const exercise of exercises) next[exercise.id] = exercise;
        exerciseMap = next;
      } catch {
        // Ohne DTOs bleiben die Zeilen nutzbar (Name aus dem Payload).
      }
    })();
  });

  function itemLabel(item: RoutineItemPreview): string {
    const dto = exerciseMap[item.exerciseId];
    return dto ? (dto.nameDe ?? dto.name) : item.name;
  }

  function itemMeta(item: RoutineItemPreview): string {
    const dto = exerciseMap[item.exerciseId];
    if (!dto) return '';
    return [dto.muscleGroups[0], dto.equipment].filter(Boolean).join(' · ');
  }

  function targetText(item: RoutineItemPreview): string {
    if (item.targetSets === null || item.targetReps === null) return '';
    const weight = item.targetWeightKg !== null ? ` · ${item.targetWeightKg} kg` : '';
    return `${item.targetSets}×${item.targetReps}${weight}`;
  }

  const hasMedia = $derived(
    routineItems.some((item) => exerciseMap[item.exerciseId]?.mediaUrl),
  );

  // --- Sheet: Details + ähnliche Übungen zum Tauschen ---------------------
  let sheetItem = $state<RoutineItemPreview | null>(null);
  let alternatives = $state<ExerciseDto[]>([]);
  let alternativesLoading = $state(false);
  let alternativesError = $state<string | null>(null);
  let swapBusyId = $state<string | null>(null);
  let swapError = $state<string | null>(null);

  const sheetExercise = $derived(sheetItem ? (exerciseMap[sheetItem.exerciseId] ?? null) : null);

  async function openExercise(item: RoutineItemPreview): Promise<void> {
    sheetItem = item;
    swapError = null;
    alternatives = [];
    alternativesError = null;
    const muscle = exerciseMap[item.exerciseId]?.muscleGroups[0];
    if (!muscle || offline) return;
    alternativesLoading = true;
    try {
      const { exercises } = await api.exercises.list({ muscle, limit: 15 });
      const inProposal = new Set(routineItems.map((entry) => entry.exerciseId));
      // Antwort einer inzwischen geschlossenen/gewechselten Übung verwerfen.
      if (sheetItem?.exerciseId !== item.exerciseId) return;
      alternatives = exercises.filter((exercise) => !inProposal.has(exercise.id)).slice(0, 10);
    } catch (err) {
      if (sheetItem?.exerciseId === item.exerciseId) alternativesError = describeError(err);
    } finally {
      alternativesLoading = false;
    }
  }

  function closeSheet(): void {
    sheetItem = null;
    alternatives = [];
    alternativesError = null;
    swapError = null;
  }

  async function swapWith(replacement: ExerciseDto): Promise<void> {
    if (!sheetItem || swapBusyId || done || offline) return;
    swapBusyId = replacement.id;
    swapError = null;
    try {
      const { proposal: updated } = await api.ai.swapProposalExercise(proposal.id, {
        fromExerciseId: sheetItem.exerciseId,
        toExerciseId: replacement.id,
      });
      exerciseMap = { ...exerciseMap, [replacement.id]: replacement };
      onUpdated?.(updated);
      closeSheet();
    } catch (err) {
      swapError = `${m().chat.proposals.swapError} ${describeError(err)}`;
    } finally {
      swapBusyId = null;
    }
  }

  function labelFor(field: ProposalField): string {
    if (field.index !== null) return `${m().chat.proposals.listItem} ${field.index}`;
    const labels: Record<string, string> = m().chat.proposals.fields;
    return labels[field.key] ?? humanizeKey(field.key);
  }

  async function resolve(action: 'confirm' | 'reject'): Promise<void> {
    if (busy || done || offline) return;
    busy = action;
    actionError = null;
    try {
      const { proposal: updated } =
        action === 'confirm'
          ? await api.ai.confirmProposal(proposal.id)
          : await api.ai.rejectProposal(proposal.id);
      resolvedStatus = updated.status;
      onResolved?.(updated);
    } catch (err) {
      actionError = `${m().chat.proposals.actionError} ${describeError(err)}`;
    } finally {
      busy = null;
    }
  }
</script>

<section class="proposal-card" class:resolved={done} aria-label={kindLabel}>
  <header class="proposal-head">
    <span class="proposal-kind">{kindLabel}</span>
    {#if done}
      <span class="proposal-state" class:rejected={status === 'rejected'}>
        <span class="proposal-state-icon" aria-hidden="true">
          {#if status === 'confirmed'}
            <svg viewBox="0 0 24 24"><path d="M20 6.5 9.5 17 4 11.5" /></svg>
          {:else}
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
          {/if}
        </span>
        {status === 'confirmed' ? m().chat.proposals.confirmed : m().chat.proposals.rejected}
      </span>
    {/if}
  </header>

  <p class="proposal-summary">{proposal.summary}</p>

  {#if !done}
    <p class="proposal-guard">{m().chat.proposals.guardHint}</p>
  {/if}

  {#if routineItems.length > 0}
    <ul class="exercise-library proposal-exercises" aria-label={m().chat.proposals.exercisesLabel}>
      {#each routineItems as item, index (`${item.exerciseId}-${index}`)}
        <li>
          <button
            type="button"
            class="exercise-row-btn"
            onclick={() => openExercise(item)}
            disabled={done}
          >
            <ExerciseThumb
              mediaUrl={exerciseMap[item.exerciseId]?.mediaUrl ?? null}
              name={itemLabel(item)}
            />
            <span class="exercise-library-text">
              <span class="exercise-library-name">{itemLabel(item)}</span>
              {#if itemMeta(item)}
                <span class="exercise-library-meta">{itemMeta(item)}</span>
              {/if}
            </span>
            {#if targetText(item)}
              <span class="proposal-exercise-target">{targetText(item)}</span>
            {/if}
            {#if !done}
              <span class="exercise-row-chevron"><Icon name="chevron-right" size={18} /></span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
    {#if hasMedia}
      <!-- Lizenzbedingung für die Übungsmedien — nicht entfernen, siehe
           apps/server/src/modules/workout/seed/README.md. -->
      <p class="picker-attribution">
        <a href={EXERCISE_MEDIA_ATTRIBUTION_URL} target="_blank" rel="external noreferrer noopener">
          © Gym visual
        </a>
      </p>
    {/if}
  {/if}

  {#if fields.length > 0}
    <button
      type="button"
      class="proposal-toggle"
      aria-expanded={expanded}
      onclick={() => (expanded = !expanded)}
    >
      {expanded ? m().chat.proposals.hideDetails : m().chat.proposals.showDetails}
      <span class="proposal-caret" class:open={expanded} aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="m8 10 4 4 4-4" /></svg>
      </span>
    </button>

    {#if expanded}
      <dl class="proposal-fields">
        {#each fields as field (field.path.join('.') || field.key)}
          <div class="proposal-field" style="--indent: {field.depth}">
            <dt class:group={field.value === null}>{labelFor(field)}</dt>
            {#if field.value === null}
              <!-- Gruppenzeile: leeres dd hält die dl-Struktur gültig. -->
              <dd class="proposal-group-spacer" aria-hidden="true"></dd>
            {:else}
              <dd>
                {#if field.value.kind === 'empty'}
                  <span class="muted">{m().chat.proposals.emptyValue}</span>
                {:else if field.value.kind === 'boolean'}
                  {field.value.value ? m().common.yes : m().common.no}
                {:else if field.value.kind === 'number'}
                  <span class="proposal-number">{field.value.text}</span>
                {:else}
                  {field.value.text}
                {/if}
              </dd>
            {/if}
          </div>
        {/each}
      </dl>
    {/if}
  {/if}

  {#if actionError}
    <p class="error" role="alert">{actionError}</p>
  {/if}

  {#if !done}
    {#if offline}
      <p class="hint proposal-offline">{m().chat.proposals.offlineHint}</p>
    {/if}
    <div class="proposal-actions">
      <button
        type="button"
        class="primary"
        disabled={busy !== null || offline}
        onclick={() => resolve('confirm')}
      >
        {busy === 'confirm' ? m().chat.proposals.working : m().chat.proposals.confirm}
      </button>
      <button
        type="button"
        class="secondary"
        disabled={busy !== null || offline}
        onclick={() => resolve('reject')}
      >
        {busy === 'reject' ? m().chat.proposals.working : m().chat.proposals.reject}
      </button>
    </div>
  {/if}
</section>

{#if sheetItem}
  <Modal title={itemLabel(sheetItem)} onClose={closeSheet}>
    <div class="exercise-detail">
      {#if sheetExercise}
        <ExerciseAnimation mediaUrl={sheetExercise.mediaUrl} gifUrl={sheetExercise.gifUrl} />
        <div class="tag-row">
          {#each sheetExercise.muscleGroups as group (group)}
            <span class="tag">{group}</span>
          {/each}
          {#if sheetExercise.equipment}
            <span class="tag tag-equipment">{sheetExercise.equipment}</span>
          {/if}
        </div>
      {/if}

      {#if sheetItem && targetText(sheetItem)}
        <p class="proposal-sheet-target">
          <span class="muted">{m().chat.proposals.targetLabel}:</span>
          <strong>{targetText(sheetItem)}</strong>
        </p>
      {/if}

      {#if sheetExercise && sheetExercise.instructions.length > 0}
        <section class="exercise-detail-section">
          <h3>{m().exercises.howToTitle}</h3>
          <ol class="howto-steps">
            {#each sheetExercise.instructions as step, i (i)}
              <li>{step}</li>
            {/each}
          </ol>
        </section>
      {/if}

      <section class="exercise-detail-section">
        <h3>{m().chat.proposals.similarTitle}</h3>
        {#if offline}
          <p class="empty-state">{m().chat.proposals.offlineHint}</p>
        {:else}
          <p class="hint">{m().chat.proposals.similarHint}</p>
          {#if swapError}
            <p class="error" role="alert">{swapError}</p>
          {/if}
          {#if alternativesLoading}
            <div class="skeleton-list" aria-hidden="true">
              <div class="skeleton-row"></div>
              <div class="skeleton-row"></div>
            </div>
            <p class="visually-hidden" role="status">{m().common.loading}</p>
          {:else if alternativesError}
            <p class="error" role="alert">{alternativesError}</p>
          {:else if alternatives.length === 0}
            <p class="empty-state">{m().chat.proposals.similarEmpty}</p>
          {:else}
            <ul class="exercise-library">
              {#each alternatives as alternative (alternative.id)}
                <li>
                  <button
                    type="button"
                    class="exercise-row-btn"
                    onclick={() => swapWith(alternative)}
                    disabled={swapBusyId !== null}
                    aria-busy={swapBusyId === alternative.id}
                  >
                    <ExerciseThumb
                      mediaUrl={alternative.mediaUrl}
                      name={alternative.nameDe ?? alternative.name}
                    />
                    <span class="exercise-library-text">
                      <span class="exercise-library-name">
                        {alternative.nameDe ?? alternative.name}
                      </span>
                      <span class="exercise-library-meta">
                        {[alternative.muscleGroups[0], alternative.equipment]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span class="proposal-swap-cta">
                      {swapBusyId === alternative.id
                        ? m().chat.proposals.working
                        : m().chat.proposals.swapAction}
                    </span>
                  </button>
                </li>
              {/each}
            </ul>
            {#if alternatives.some((alternative) => alternative.mediaUrl)}
              <p class="picker-attribution">
                <a
                  href={EXERCISE_MEDIA_ATTRIBUTION_URL}
                  target="_blank"
                  rel="external noreferrer noopener"
                >
                  © Gym visual
                </a>
              </p>
            {/if}
          {/if}
        {/if}
      </section>
    </div>
  </Modal>
{/if}
