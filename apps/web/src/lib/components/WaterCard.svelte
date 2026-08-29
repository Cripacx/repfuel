<script lang="ts">
  import { m } from '$lib/i18n/index.js';

  /**
   * Wasser des Tages. Die drei Schnellmengen sind der eigentliche Weg — Wasser
   * loggt man nebenbei, nicht über ein Formular.
   */
  let {
    totalMl,
    targetMl,
    busy,
    onAdd,
  }: {
    totalMl: number;
    targetMl: number;
    busy: boolean;
    onAdd: (ml: number) => void;
  } = $props();

  const QUICK_ML = [200, 300, 500];

  const progress = $derived(targetMl > 0 ? Math.min(totalMl / targetMl, 1) : 0);
  const reached = $derived(totalMl >= targetMl);
</script>

<section class="card">
  <div class="card-head">
    <h2>{m().nutrition.waterTitle}</h2>
    <span class="water-total" class:reached>
      {totalMl} / {targetMl} {m().nutrition.mlUnit}
    </span>
  </div>

  <span class="water-track">
    <span class="water-fill" style={`transform: scaleX(${progress});`}></span>
  </span>

  <div class="water-actions">
    {#each QUICK_ML as ml (ml)}
      <button type="button" class="chip" disabled={busy} onclick={() => onAdd(ml)}>
        +{ml} {m().nutrition.mlUnit}
      </button>
    {/each}
  </div>
</section>

<style>
  .card-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .card-head h2 {
    margin: 0;
  }

  .water-total {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  /* Ziel erreicht wird zusätzlich zur Farbe durch die Zahlen selbst getragen. */
  .water-total.reached {
    color: var(--success);
    font-weight: var(--weight-medium);
  }

  .water-track {
    display: block;
    height: 8px;
    margin: var(--space-3) 0;
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .water-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--macro-carbs);
    transform-origin: left center;
    transition: transform var(--dur-base) var(--ease-out);
  }

  .water-actions {
    display: flex;
    gap: var(--space-2);
  }
</style>
