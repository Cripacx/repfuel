<script lang="ts">
  import type { ProposalDto, ProposalStatus } from '@repfuel/shared';
  import { api } from '$lib/api.js';
  import {
    extractRoutineItems,
    formatProposalPayload,
    humanizeKey,
    stripDisplayHelpers,
    type ProposalField,
  } from '$lib/chat/proposal-format.js';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';

  /**
   * Bestätigungs-Flow für KI-Schreibvorschläge (`update_routine` / `update_profile`).
   * Nichts wird geschrieben, bevor der Nutzer hier bestätigt — dieser Guard ist
   * Architekturvorgabe, kein UI-Detail.
   */
  let {
    proposal,
    offline = false,
    onResolved,
  }: {
    proposal: ProposalDto;
    offline?: boolean;
    onResolved?: (proposal: ProposalDto) => void;
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
    <ul class="proposal-exercises" aria-label={m().chat.proposals.exercisesLabel}>
      {#each routineItems as item, index (index)}
        <li>
          <span class="proposal-exercise-name">{item.name}</span>
          {#if item.targetSets !== null && item.targetReps !== null}
            <span class="proposal-exercise-target">
              {item.targetSets}×{item.targetReps}{item.targetWeightKg !== null
                ? ` · ${item.targetWeightKg} kg`
                : ''}
            </span>
          {/if}
        </li>
      {/each}
    </ul>
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
