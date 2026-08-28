<script lang="ts">
  import type { Snippet } from 'svelte';
  import { m } from '$lib/i18n/index.js';

  /**
   * Generisches Modal/Bottom-Sheet (auf Mobile ein Sheet vom unteren Bildschirmrand,
   * auf breiteren Screens eine zentrierte Karte — siehe `.modal-*`-Klassen in app.css).
   * Schließt über Backdrop-Klick, Escape oder den ×-Button.
   */
  let {
    title,
    onClose,
    children,
  }: { title: string; onClose: () => void; children: Snippet } = $props();

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose} role="presentation">
  <div
    class="modal-sheet"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
    onclick={(event) => event.stopPropagation()}
    onkeydown={(event) => event.stopPropagation()}
  >
    <div class="modal-header">
      <h2>{title}</h2>
      <button type="button" class="icon-btn" onclick={onClose} aria-label={m().common.close}>
        ×
      </button>
    </div>
    <div class="modal-body">
      {@render children()}
    </div>
  </div>
</div>
