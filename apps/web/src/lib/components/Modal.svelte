<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';
  import { m } from '$lib/i18n/index.js';
  import { DUR_EXIT, DUR_OVERLAY, EASE_OUT, sheet } from '$lib/motion.js';

  /**
   * Generisches Modal/Bottom-Sheet (auf Mobile ein Sheet vom unteren Bildschirmrand,
   * auf breiteren Screens eine zentrierte Karte — siehe `.modal-*`-Klassen in app.css).
   * Schließt über Backdrop-Klick, Escape oder den ×-Button.
   *
   * Ein- und Ausgang laufen denselben Weg: mobil vom unteren Rand, wo das Sheet
   * auch sitzt, ab Tablet aus der Mitte der Karte. Der Ausgang ist kürzer — die
   * Entscheidung ist gefallen, das Warten darauf wäre Latenz.
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

<div
  class="modal-backdrop"
  onclick={onClose}
  role="presentation"
  in:fade={{ duration: DUR_OVERLAY, easing: EASE_OUT }}
  out:fade={{ duration: DUR_EXIT, easing: EASE_OUT }}
>
  <div
    class="modal-sheet"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
    onclick={(event) => event.stopPropagation()}
    onkeydown={(event) => event.stopPropagation()}
    in:sheet={{ duration: DUR_OVERLAY }}
    out:sheet={{ duration: DUR_EXIT }}
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
