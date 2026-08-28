<script lang="ts">
  import type { NutritionDayDto, NutritionTargets } from '@repfuel/shared';
  import { resolve } from '$app/paths';
  import KcalRing from './KcalRing.svelte';
  import MacroBars from './MacroBars.svelte';
  import { m } from '$lib/i18n/index.js';
  import { roundKcal } from '$lib/nutrition/format.js';

  /**
   * Tagesübersicht im vertrauten Diary-Muster (YAZIO): Ring mit dem Rest in
   * der Mitte, Gegessen links, Verbrannt/Ziel rechts, Makro-Balken darunter —
   * eine Karte, die den Tag auf einen Blick beantwortet. Wird auf "Heute" und
   * im Ernährungs-Tagebuch identisch verwendet, damit der Nutzer EIN Layout
   * lernt.
   */
  let {
    day,
    targets,
    burnedKcal = null,
  }: {
    day: NutritionDayDto | null;
    targets: NutritionTargets | null;
    /** Aktive Kalorien aus Health-Daten — ohne sie zeigt die rechte Spalte das Ziel. */
    burnedKcal?: number | null;
  } = $props();

  const kcal = $derived(day?.kcal ?? 0);
  const target = $derived(targets?.kcalTarget ?? null);
</script>

<div class="day-summary card">
  {#if target !== null}
    <div class="day-summary-top">
      <div class="day-summary-side">
        <strong>{roundKcal(kcal)}</strong>
        <span>{m().nutrition.summary.eaten}</span>
      </div>
      <KcalRing {kcal} {target} />
      <div class="day-summary-side">
        {#if burnedKcal !== null}
          <strong>{roundKcal(burnedKcal)}</strong>
          <span>{m().nutrition.summary.burned}</span>
        {:else}
          <strong>{target}</strong>
          <span>{m().nutrition.summary.target}</span>
        {/if}
      </div>
    </div>
    {#if day && targets}
      <MacroBars {day} {targets} />
    {/if}
  {:else}
    <div class="day-summary-untargeted">
      <strong class="latest-weight">{roundKcal(kcal)} {m().nutrition.kcalUnit}</strong>
      <p class="muted">
        {m().home.noTargetSet}
        <a href={resolve('/goals')}>{m().home.setGoalsLink}</a>
      </p>
    </div>
  {/if}
</div>

<style>
  .day-summary-top {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--space-3);
  }

  .day-summary-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
  }

  .day-summary-side strong {
    font-size: var(--text-lg);
    font-weight: var(--weight-heading);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--tracking-lg);
  }

  .day-summary-side span {
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .day-summary-untargeted {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .day-summary-untargeted p {
    margin: 0;
  }
</style>
