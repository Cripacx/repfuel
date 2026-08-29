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
  /** Typ der aktuellen Chart-Instanz — Chart.js' config-Union macht den
   * Zugriff auf `config.type` unnötig sperrig, also selbst mitführen. */
  let chartInstanceType: 'line' | 'bar' | null = null;

  /** Welche Kennzahl das Diagramm zeigt: Top-Satz-Gewicht, geschätztes 1RM
   * (beides je Workout) oder Wochenvolumen. */
  type ChartMode = 'topset' | 'e1rm' | 'volume';
  let chartMode = $state<ChartMode>('topset');

  function exerciseLabel(exercise: ExerciseDto): string {
    return exercise.nameDe ?? exercise.name;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(getLocale() === 'de' ? 'de-DE' : 'en-US');
  }

  function formatShortDate(iso: string): string {
    return new Date(iso).toLocaleDateString(getLocale() === 'de' ? 'de-DE' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  function formatSetLine(sets: StrengthStatsResponse['history'][number]['sets']): string {
    return sets.map((s) => `${s.weightKg}×${s.reps}`).join(' · ');
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

  /** Datenreihe je Modus: Verlauf ist je Workout (aufsteigend), Volumen je Woche. */
  function chartSeries(
    mode: ChartMode,
    data: StrengthStatsResponse,
  ): { labels: string[]; values: number[]; type: 'line' | 'bar'; label: string } {
    if (mode === 'volume') {
      const locale = getLocale();
      return {
        labels: data.weeklyTrend.map((w) => formatIsoWeekLabel(w.week, locale)),
        values: data.weeklyTrend.map((w) => w.volumeKg),
        type: 'bar',
        label: m().stats.volumeLabel,
      };
    }
    const ascending = [...data.history].reverse();
    return {
      labels: ascending.map((h) => formatShortDate(h.date)),
      values: ascending.map((h) => (mode === 'topset' ? h.topWeightKg : h.bestEst1RmKg)),
      type: 'line',
      label: mode === 'topset' ? m().stats.chartModeTopSet : m().stats.chartModeE1rm,
    };
  }

  async function updateChart(canvas: HTMLCanvasElement, data: StrengthStatsResponse): Promise<void> {
    const { Chart } = await import('chart.js/auto');
    const series = chartSeries(chartMode, data);

    // Typwechsel (line ↔ bar) braucht eine neue Instanz.
    if (chartInstance && chartInstanceType !== series.type) {
      chartInstance.destroy();
      chartInstance = null;
    }

    if (chartInstance) {
      chartInstance.data.labels = series.labels;
      const dataset = chartInstance.data.datasets[0];
      if (dataset) {
        dataset.data = series.values;
        dataset.label = series.label;
      }
      chartInstance.update();
      return;
    }

    const accent = readToken('--accent', '#c8f542');
    const textMuted = readToken('--text-muted', '#a6aeab');
    const border = readToken('--border', '#2a2e33');

    chartInstanceType = series.type;
    chartInstance = new Chart(canvas, {
      type: series.type,
      data: {
        labels: series.labels,
        datasets: [
          series.type === 'bar'
            ? {
                label: series.label,
                data: series.values,
                backgroundColor: hexToRgba(accent, 0.75),
                borderRadius: 4,
                maxBarThickness: 36,
              }
            : {
                label: series.label,
                data: series.values,
                borderColor: accent,
                backgroundColor: hexToRgba(accent, 0.18),
                pointBackgroundColor: accent,
                pointRadius: 3,
                tension: 0.3,
                fill: true,
              },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textMuted }, grid: { display: false } },
          y: {
            ticks: { color: textMuted },
            grid: { color: border },
            beginAtZero: chartMode === 'volume',
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  const chartHasData = $derived(
    stats !== null &&
      (chartMode === 'volume' ? stats.weeklyTrend.length > 0 : stats.history.length > 1),
  );

  $effect(() => {
    const canvas = chartCanvas;
    const data = stats;
    void chartMode;
    if (!canvas || !data || !chartHasData) {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      return;
    }
    void updateChart(canvas, data);
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
        <h2>{m().stats.progressTitle}</h2>
        <div class="method-switch" role="group" aria-label={m().stats.chartModeLabel}>
          <button
            type="button"
            class:active={chartMode === 'topset'}
            onclick={() => (chartMode = 'topset')}
          >
            {m().stats.chartModeTopSet}
          </button>
          <button
            type="button"
            class:active={chartMode === 'e1rm'}
            onclick={() => (chartMode = 'e1rm')}
          >
            {m().stats.chartModeE1rm}
          </button>
          <button
            type="button"
            class:active={chartMode === 'volume'}
            onclick={() => (chartMode = 'volume')}
          >
            {m().stats.chartModeVolume}
          </button>
        </div>
        {#if !chartHasData}
          <p class="empty-state">{m().stats.chartUnavailable}</p>
        {:else}
          <div class="chart-container">
            <canvas bind:this={chartCanvas}></canvas>
          </div>
        {/if}
      </section>

      {#if stats.history.length > 0}
        <section class="card">
          <h2>{m().stats.historyTitle}</h2>
          <ul class="history-list">
            {#each stats.history as entry (entry.date)}
              <li class="history-row">
                <div class="history-row-main">
                  <span class="history-row-date">{formatDate(entry.date)}</span>
                  <span class="history-row-sets">{formatSetLine(entry.sets)}</span>
                </div>
                <span class="history-row-top">
                  {entry.topWeightKg}
                  <span class="history-row-unit">{m().common.kg}</span>
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/if}
  {/if}
{/if}
