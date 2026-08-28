<script lang="ts">
  import { getPendingConfirm, resolveConfirm } from '$lib/confirm.svelte.js';
  import Modal from './Modal.svelte';
  import { m } from '$lib/i18n/index.js';

  /**
   * Rendert die offene Bestätigungsanfrage. Liegt einmal im Layout, damit jede
   * Seite `requestConfirm()` aufrufen kann, ohne selbst Dialog-Zustand zu halten.
   *
   * Abbrechen ist die sichere Vorgabe: Backdrop-Klick, Escape und das × lösen
   * alle mit `false` auf, nie mit `true`.
   */
  const pending = $derived(getPendingConfirm());

  let confirmButton = $state<HTMLButtonElement | null>(null);

  // Der Fokus springt auf die bestätigende Aktion, sobald der Dialog erscheint —
  // sonst bliebe er auf dem auslösenden Element hinter dem Backdrop hängen.
  $effect(() => {
    if (pending) confirmButton?.focus();
  });
</script>

{#if pending}
  <Modal
    title={pending.title ?? m().common.confirmTitle}
    onClose={() => resolveConfirm(false)}
  >
    <p class="confirm-message">{pending.message}</p>
    <div class="confirm-actions">
      <button type="button" class="secondary" onclick={() => resolveConfirm(false)}>
        {m().common.cancel}
      </button>
      <button
        type="button"
        class="danger"
        bind:this={confirmButton}
        onclick={() => resolveConfirm(true)}
      >
        {pending.confirmLabel ?? m().common.delete}
      </button>
    </div>
  </Modal>
{/if}

<style>
  .confirm-message {
    margin: 0 0 var(--space-4);
  }

  .confirm-actions {
    display: flex;
    gap: var(--space-2);
  }

  .confirm-actions button {
    flex: 1;
  }
</style>
