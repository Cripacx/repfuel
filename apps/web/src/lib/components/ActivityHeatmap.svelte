<script lang="ts">
  import type { ActivityStatsResponse } from '@repfuel/shared';
  import { m } from '$lib/i18n/index.js';

  /**
   * Trainingsjahr auf einen Blick: eine Spalte je Woche, eine Zeile je
   * Wochentag (Montag oben). Die Intensität steht für die trainierte Zeit, nicht
   * für die Anzahl — zwei kurze Einheiten sollen nicht heller wirken als eine
   * lange.
   *
   * Die Schwellen sind Quartile der tatsächlich trainierten Tage statt fester
   * Minutenwerte: bei 30-Minuten-Einheiten wären sonst alle Tage gleich hell.
   */
  let { days }: { days: ActivityStatsResponse['days'] } = $props();

  const WEEKDAY_COUNT = 7;

  const trainedMinutes = $derived(
    days
      .map((d) => d.minutes)
      .filter((minutes) => minutes > 0)
      .sort((a, b) => a - b),
  );

  /** Quartilsgrenzen; leer, solange es zu wenige Daten für eine Abstufung gibt. */
  const thresholds = $derived.by(() => {
    const values = trainedMinutes;
    if (values.length < 4) return [];
    const at = (fraction: number): number => values[Math.floor(values.length * fraction)] ?? 0;
    return [at(0.25), at(0.5), at(0.75)];
  });

  function level(minutes: number): number {
    // Trainiert, aber ohne verwertbare Dauer (laufendes Workout): niedrigste
    // sichtbare Stufe statt "nichts passiert".
    if (minutes <= 0) return 0;
    if (thresholds.length === 0) return 2;
    if (minutes <= thresholds[0]!) return 1;
    if (minutes <= thresholds[1]!) return 2;
    if (minutes <= thresholds[2]!) return 3;
    return 4;
  }

  /** Spalten à sieben Tage — die Reihe kommt lückenlos vom Server. */
  const weeks = $derived.by(() => {
    const columns: ActivityStatsResponse['days'][] = [];
    for (let i = 0; i < days.length; i += WEEKDAY_COUNT) {
      columns.push(days.slice(i, i + WEEKDAY_COUNT));
    }
    return columns;
  });
</script>

<div class="heatmap">
  <div class="heatmap-grid" role="img" aria-label={m().stats.activityTitle}>
    {#each weeks as week, weekIndex (weekIndex)}
      <div class="heatmap-week">
        {#each week as day (day.date)}
          <span
            class="heatmap-day"
            data-level={level(day.minutes)}
            title={`${day.date} · ${day.minutes} ${m().workouts.minutesShort}`}
          ></span>
        {/each}
      </div>
    {/each}
  </div>

  <p class="heatmap-legend">
    <span>{m().stats.activityLess}</span>
    {#each [0, 1, 2, 3, 4] as value (value)}
      <span class="heatmap-day" data-level={value}></span>
    {/each}
    <span>{m().stats.activityMore}</span>
  </p>
</div>

<style>
  /* Scrollt horizontal: ein Jahr sind 53 Spalten, die auf kein Handy passen,
     ohne die Zellen unlesbar klein zu machen. */
  .heatmap-grid {
    display: flex;
    gap: 3px;
    overflow-x: auto;
    padding-bottom: var(--space-2);
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }

  .heatmap-week {
    display: grid;
    grid-template-rows: repeat(7, 1fr);
    gap: 3px;
    flex: 0 0 auto;
  }

  .heatmap-day {
    width: 11px;
    height: 11px;
    border-radius: 2px;
    background: var(--surface-2);
  }

  /* Vier Stufen desselben Grüns statt Farbwechsel — die Bedeutung ist "mehr",
     nicht "anders". */
  .heatmap-day[data-level='1'] {
    background: color-mix(in srgb, var(--success) 30%, var(--surface-2));
  }
  .heatmap-day[data-level='2'] {
    background: color-mix(in srgb, var(--success) 55%, var(--surface-2));
  }
  .heatmap-day[data-level='3'] {
    background: color-mix(in srgb, var(--success) 78%, var(--surface-2));
  }
  .heatmap-day[data-level='4'] {
    background: var(--success);
  }

  .heatmap-legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-1);
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-xs);
  }

  .heatmap-legend span:first-child {
    margin-right: var(--space-1);
  }

  .heatmap-legend span:last-child {
    margin-left: var(--space-1);
  }
</style>
