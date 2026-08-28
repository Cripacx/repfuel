<script lang="ts">
  import { m } from '$lib/i18n/index.js';

  /**
   * Kompakter Chip für einen Tool-Aufruf des Coaches („get_nutrition_summary … läuft").
   * Details (Eingabe/Ergebnis) sind eingeklappt — im Verlauf zählt, *dass* der
   * Coach Daten geholt hat, nicht das JSON.
   */
  let {
    toolName,
    args,
    result,
    status,
  }: {
    toolName: string;
    args: unknown;
    result: unknown;
    status: 'running' | 'done';
  } = $props();

  let expanded = $state(false);

  const argsText = $derived(formatPayload(args));
  const resultText = $derived(formatPayload(result));

  function formatPayload(value: unknown): string | null {
    if (value === undefined) return null;
    try {
      return JSON.stringify(value, null, 2) ?? String(value);
    } catch {
      return String(value);
    }
  }
</script>

<div class="tool-chip" class:running={status === 'running'}>
  <button
    type="button"
    class="tool-chip-head"
    aria-expanded={expanded}
    onclick={() => (expanded = !expanded)}
  >
    <span class="tool-chip-icon" aria-hidden="true">
      {#if status === 'running'}
        <svg viewBox="0 0 24 24" class="spin">
          <path d="M12 4a8 8 0 0 1 8 8" />
          <circle cx="12" cy="12" r="8" class="track" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24">
          <path d="M20 6.5 9.5 17 4 11.5" />
        </svg>
      {/if}
    </span>
    <span class="tool-chip-name">{toolName}</span>
    <span class="tool-chip-status">
      {status === 'running' ? m().chat.tools.running : m().chat.tools.done}
    </span>
    <span class="tool-chip-caret" class:open={expanded} aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="m8 10 4 4 4-4" /></svg>
    </span>
  </button>

  {#if expanded}
    <div class="tool-chip-details">
      {#if argsText}
        <h4>{m().chat.tools.args}</h4>
        <pre>{argsText}</pre>
      {/if}
      {#if resultText}
        <h4>{m().chat.tools.result}</h4>
        <pre>{resultText}</pre>
      {/if}
    </div>
  {/if}
</div>
