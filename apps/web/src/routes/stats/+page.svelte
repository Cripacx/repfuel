<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Chart as ChartInstance } from 'chart.js';
  import type { ExerciseDto, StrengthStatsResponse } from '@repfuel/shared';
  import type { ActivityStatsResponse } from '@repfuel/shared';
  import { api } from '$lib/api.js';
  import ActivityHeatmap from '$lib/components/ActivityHeatmap.svelte';
  import ExercisePicker from '$lib/components/ExercisePicker.svelte';
  import { describeError } from '$lib/errors.js';
  import { getLocale, m } from '$lib/i18n/index.js';
  import { isOnline } from '$lib/offline/status.svelte.js';
  import { formatIsoWeekLabel } from '$lib/workout/week-label.js';

  let selected = $state<ExerciseDto | null>(null);
  let stats = $state<StrengthStatsResponse | null>(null);
  let loading = $state(false);
  let loadError = $state<string | null>(null);

  let chartCanvas = $state<HTMLCanvasElement | undefined>(undefined);
  let chartInstance: ChartInstance | null = null;

  function exerciseLabel(exercise: ExerciseDto): string {
    return exercise.nameDe ?? exercise.name;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(getLocale() === 'de' ? 'de-DE' : 'en-US');
  }

  async function loadStats(exercise: ExerciseDto): Promise<void> {
    selected = exercise;
    stats = null;
    loadError = null;
    if (!isOnline()) return;
    loading = true;
    try {
      const { stats: loaded } = await api.stats.strength(exercise.id);
      stats = loaded;
    } catch (err) {
      loadError = describeError(err);
    } finally {
      loading = false;
    }
  }

  function retry(): void {
    if (selected) void loadStats(selected);
  }

  function changeExercise(): void {
    selected = null;
    stats = null;
    loadError = null;
  }

  onDestroy(() => {
    chartInstance?.destroy();
  });

  /** Liest einen Farb-Token aus den CSS-Custom-Properties statt Hex-Werte hart zu kodieren
   * (siehe DESIGN.md) — Chart.js kann selbst keine CSS-Variablen auflösen. */
  function readToken(name: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function hexToRgba(hex: string, alpha: number): string {
    const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
    if (!match) return hex;
    const [, r, g, b] = match;
    return `rgba(${parseInt(r ?? '0', 16)}, ${parseInt(g ?? '0', 16)}, ${parseInt(b ?? '0', 16)}, ${alpha})`;
  }

  async function updateChart(
    canvas: HTMLCanvasElement,
    trend: StrengthStatsResponse['weeklyTrend'],
  ): Promise<void> {
    const { Chart } = await import('chart.js/auto');
    const locale = getLocale();
    const labels = trend.map((w) => formatIsoWeekLabel(w.week, locale));
    const data = trend.map((w) => w.volumeKg);

    if (chartInstance) {
      chartInstance.data.labels = labels;
      const dataset = chartInstance.data.datasets[0];
      if (dataset) dataset.data = data;
      chartInstance.update();
      return;
    }

    const accent = readToken('--accent', '#c8f542');
    const textMuted = readToken('--text-muted', '#a6aeab');
    const border = readToken('--border', '#2a2e33');

    chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: m().stats.volumeLabel,
            data,
            backgroundColor: hexToRgba(accent, 0.75),
            borderRadius: 4,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textMuted }, grid: { display: false } },
          y: { ticks: { color: textMuted }, grid: { color: border }, beginAtZero: true },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  $effect(() => {
    const canvas = chartCanvas;
    const trend = stats?.weeklyTrend ?? [];
    if (!canvas || trend.length === 0) {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      return;
    }
    void updateChart(canvas, trend);
  });

  // Aktivität hängt nicht an der Übungsauswahl — sie beschreibt das ganze
  // Training und wird deshalb einmal beim Betreten geladen.
  let activity = $state<ActivityStatsResponse | null>(null);

  $effect(() => {
    void (async () => {
      try {
        const { activity: loaded } = await api.stats.activity();
        activity = loaded;
      } catch {
        // Die Übungsstatistik unten funktioniert auch ohne die Kacheln.
      }
    })();
  });
</script>

<h1>{m().stats.title}</h1>

{#if activity}
  <div class="kpi-grid">
    <div class="kpi">
      <span class="kpi-label">{m().stats.kpiWorkouts}</span>
      <strong class="kpi-value">{activity.totalWorkouts}</strong>
    </div>
    <div class="kpi">
      <span class="kpi-label">{m().stats.kpiThisMonth}</span>
      <strong class="kpi-value">{activity.workoutsThisMonth}</strong>
    </div>
    <div class="kpi">
      <span class="kpi-label">{m().stats.kpiWeekStreak}</span>
      <strong class="kpi-value">{activity.weekStreak}</strong>
    </div>
    <div class="kpi">
      <span class="kpi-label">{m().stats.kpiThisWeek}</span>
      <strong class="kpi-value">{activity.workoutsThisWeek}</strong>
    </div>
  </div>

  <section class="card">
    <h2>{m().stats.activityTitle}</h2>
    <ActivityHeatmap days={activity.days} />
  </section>
{/if}

{#if !selected}
  <section class="card">
    <p class="muted">{m().stats.pickPrompt}</p>
    <ExercisePicker onSelect={loadStats} />
  </section>
{:else}
  <div class="page-header">
    <h2>{exerciseLabel(selected)}</h2>
    <button type="button" class="secondary" onclick={changeExercise}>
      {m().stats.changeExercise}
    </button>
  </div>

  {#if !isOnline()}
    <section class="card empty-card">
      <h2>{m().stats.offlineTitle}</h2>
      <p class="muted">{m().stats.offlineBody}</p>
    </section>
  {:else if loading}
    <div class="skeleton-list">
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
    </div>
  {:else if loadError}
    <section class="card error-card">
      <p role="alert">{loadError}</p>
      <button type="button" class="secondary" onclick={retry}>{m().stats.retry}</button>
    </section>
  {:else if stats}
    {#if stats.prs.maxWeightKg === null && stats.weeklyTrend.length === 0}
      <section class="card">
        <p class="empty-state">{m().stats.noDataYet}</p>
      </section>
    {:else}
      <section class="card">
        <h2>{m().stats.prTitle}</h2>
        <dl class="summary-grid">
          <div>
            <dt>{m().stats.maxWeightLabel}</dt>
            <dd>
              {stats.prs.maxWeightKg !== null ? `${stats.prs.maxWeightKg} ${m().common.kg}` : '—'}
            </dd>
          </div>
          <div>
            <dt>{m().stats.maxRepsLabel}</dt>
            <dd>{stats.prs.maxReps !== null ? `${stats.prs.maxReps} ${m().stats.repsUnit}` : '—'}</dd>
          </div>
          <div>
            <dt>{m().stats.best1RmLabel}</dt>
            <dd>
              {stats.prs.bestEst1RmKg !== null ? `${stats.prs.bestEst1RmKg} ${m().common.kg}` : '—'}
            </dd>
          </div>
        </dl>
        {#if stats.prs.bestSet}
          <p class="muted">
            {stats.prs.bestSet.weightKg} {m().common.kg} × {stats.prs.bestSet.reps}
            {m().stats.repsUnit} · {m().stats.onDate}
            {formatDate(stats.prs.bestSet.date)}
          </p>
        {/if}
      </section>

      <section class="card">
        <h2>{m().stats.chartTitle}</h2>
        {#if stats.weeklyTrend.length === 0}
          <p class="empty-state">{m().stats.chartUnavailable}</p>
        {:else}
          <div class="chart-container">
            <canvas bind:this={chartCanvas}></canvas>
          </div>
        {/if}
      </section>
    {/if}
  {/if}
{/if}
