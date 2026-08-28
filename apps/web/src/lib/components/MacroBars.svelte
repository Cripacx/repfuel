<script lang="ts">
  import type { NutritionDayDto, NutritionTargets } from '@repfuel/shared';
  import { m } from '$lib/i18n/index.js';

  /**
   * Die drei Makros als Balkenzeilen. Zeigt nur, was ein Ziel hat — ein Balken
   * ohne Bezugsgröße ist keine Information.
   */
  let {
    day,
    targets,
  }: {
    day: NutritionDayDto;
    targets: NutritionTargets;
  } = $props();

  const rows = $derived(
    (
      [
        { key: 'protein', value: day.proteinG, target: targets.proteinTargetG },
        { key: 'carbs', value: day.carbsG, target: targets.carbsTargetG },
        { key: 'fat', value: day.fatG, target: targets.fatTargetG },
      ] as const
    ).filter((row): row is typeof row & { target: number } => row.target !== null && row.target > 0),
  );

  function label(key: 'protein' | 'carbs' | 'fat'): string {
    return m().nutrition.macros[key];
  }
</script>

{#if rows.length > 0}
  <ul class="macro-bars">
    {#each rows as row (row.key)}
      <li>
        <span class="macro-bars-head">
          <span class="macro-bars-name">{label(row.key)}</span>
          <span class="macro-bars-value">
            {Math.round(row.value)} / {Math.round(row.target)} {m().nutrition.gramUnit}
          </span>
        </span>
        <span class="macro-bars-track">
          <span
            class="macro-bars-fill"
            data-macro={row.key}
            class:over={row.value > row.target}
            style={`transform: scaleX(${Math.min(row.value / row.target, 1)});`}
          ></span>
        </span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .macro-bars {
    list-style: none;
    margin: var(--space-4) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .macro-bars-head {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
    font-size: var(--text-sm);
  }

  .macro-bars-value {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .macro-bars-track {
    display: block;
    height: 8px;
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .macro-bars-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    transform-origin: left center;
    transition: transform var(--dur-base) var(--ease-out);
  }

  .macro-bars-fill[data-macro='protein'] {
    background: var(--macro-protein);
  }
  .macro-bars-fill[data-macro='carbs'] {
    background: var(--macro-carbs);
  }
  .macro-bars-fill[data-macro='fat'] {
    background: var(--macro-fat);
  }

  /* Über dem Ziel schlägt die Farbe um — zusammen mit den Zahlen daneben, damit
     die Aussage nicht allein an der Farbe hängt. */
  .macro-bars-fill.over {
    background: var(--warning);
  }
</style>
