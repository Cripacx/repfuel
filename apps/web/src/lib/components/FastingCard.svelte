<script lang="ts">
  import { computeFasting, formatDuration } from '$lib/nutrition/fasting.js';
  import { m } from '$lib/i18n/index.js';

  /**
   * Fastenstand, abgeleitet aus der letzten geloggten Mahlzeit — kein Timer, den
   * man zu starten vergessen kann. Rendert nichts, solange kein Fenster
   * eingestellt ist oder noch nie etwas geloggt wurde.
   */
  let {
    lastMealAt,
    windowH,
  }: {
    lastMealAt: string | null;
    windowH: number | null;
  } = $props();

  // Minütlich neu bewerten reicht: die Anzeige kennt keine Sekunden.
  let now = $state(new Date());

  $effect(() => {
    const id = setInterval(() => (now = new Date()), 60_000);
    return () => clearInterval(id);
  });

  const fasting = $derived(computeFasting(lastMealAt, windowH, now));
</script>

{#if fasting}
  <section class="card fasting-card">
    <div class="card-head">
      <h2>{m().nutrition.fastingTitle}</h2>
      <span class="fasting-value" class:complete={fasting.complete}>
        {fasting.complete
          ? m().nutrition.fastingComplete
          : `${formatDuration(fasting.remainingMs)} ${m().nutrition.fastingRemaining}`}
      </span>
    </div>

    <span class="fasting-track">
      <span
        class="fasting-fill"
        class:complete={fasting.complete}
        style={`transform: scaleX(${fasting.progress});`}
      ></span>
    </span>

    <p class="muted fasting-elapsed">
      {m().nutrition.fastingElapsed}
      {formatDuration(fasting.elapsedMs)}
    </p>
  </section>
{/if}

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

  .fasting-value {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .fasting-value.complete {
    color: var(--success);
    font-weight: var(--weight-medium);
  }

  .fasting-track {
    display: block;
    height: 8px;
    margin: var(--space-3) 0 var(--space-2);
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .fasting-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--accent);
    transform-origin: left center;
    transition: transform var(--dur-base) var(--ease-out);
  }

  .fasting-fill.complete {
    background: var(--success);
  }

  .fasting-elapsed {
    margin: 0;
    font-size: var(--text-sm);
  }
</style>
