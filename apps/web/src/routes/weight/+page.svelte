<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { BodyWeightDto } from '@repfuel/shared';
  import type { Chart as ChartInstance } from 'chart.js';
  import { requestConfirm } from '$lib/confirm.svelte.js';
  import Icon from '$lib/components/Icon.svelte';
  import { api } from '$lib/api.js';
  import { describeError } from '$lib/errors.js';
  import { getLocale, m } from '$lib/i18n/index.js';
  import { hydrateWeight, listWeightLocal, removeWeight, upsertWeight } from '$lib/offline/repo.js';
  import { filterByRange } from '$lib/weight-range.js';

  type Range = 30 | 90 | 365 | 'all';

  let entries = $state<BodyWeightDto[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  let newDate = $state(todayDateInputValue());
  let newWeight = $state<number | ''>('');
  let adding = $state(false);
  let addError = $state<string | null>(null);

  let range = $state<Range>(90);
  let chartCanvas = $state<HTMLCanvasElement | undefined>(undefined);
  let chartInstance: ChartInstance | null = null;

  function todayDateInputValue(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(getLocale() === 'de' ? 'de-DE' : 'en-US');
  }

  const sortedDesc = $derived(
    entries
      .slice()
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()),
  );

  onMount(async () => {
    try {
      const { entries: loaded } = await api.weight.list({ limit: 2000 });
      await hydrateWeight(loaded);
      entries = loaded;
    } catch (err) {
      if (!(err instanceof TypeError)) {
        loadError = describeError(err);
      } else {
        entries = await listWeightLocal(2000);
      }
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    chartInstance?.destroy();
  });

  async function addEntry(): Promise<void> {
    addError = null;
    if (newWeight === '' || Number.isNaN(newWeight)) {
      addError = m().errors.generic;
      return;
    }
    adding = true;
    try {
      const measuredAt = new Date(`${newDate}T12:00:00`).toISOString();
      const id = crypto.randomUUID();
      const entry = await upsertWeight(id, { weightKg: newWeight, measuredAt });
      entries = [...entries, entry];
      newWeight = '';
      newDate = todayDateInputValue();
    } catch (err) {
      addError = describeError(err);
    } finally {
      adding = false;
    }
  }

  async function removeEntry(entry: BodyWeightDto): Promise<void> {
    if (!(await requestConfirm({ message: m().weight.deleteConfirm, confirmLabel: m().common.delete }))) return;
    loadError = null;
    try {
      await removeWeight(entry.id);
      entries = entries.filter((e) => e.id !== entry.id);
    } catch (err) {
      loadError = describeError(err);
    }
  }

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

  async function updateChart(canvas: HTMLCanvasElement, filtered: BodyWeightDto[]): Promise<void> {
    const { Chart } = await import('chart.js/auto');
    const labels = filtered.map((e) => formatDate(e.measuredAt));
    const data = filtered.map((e) => e.weightKg);

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
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: m().weight.title,
            data,
            borderColor: accent,
            backgroundColor: hexToRgba(accent, 0.15),
            tension: 0.25,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: accent,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: { ticks: { color: textMuted }, grid: { color: border } },
          y: { ticks: { color: textMuted }, grid: { color: border } },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  const chartFiltered = $derived(filterByRange(entries, range));

  $effect(() => {
    const canvas = chartCanvas;
    const filtered = chartFiltered;
    if (!canvas || filtered.length < 2) {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      return;
    }
    void updateChart(canvas, filtered);
  });
</script>

<h1>{m().weight.title}</h1>

<h2 class="section-label">{m().weight.entryTitle}</h2>
<section class="card">
  <form
    onsubmit={(event) => {
      event.preventDefault();
      void addEntry();
    }}
  >
    <div class="field-row">
      <div>
        <label for="weight-date">{m().weight.entryDateLabel}</label>
        <input id="weight-date" type="date" bind:value={newDate} />
      </div>
      <div>
        <label for="weight-value">{m().weight.entryWeightLabel}</label>
        <input
          id="weight-value"
          type="number"
          inputmode="decimal"
          min="20"
          max="500"
          step="0.1"
          bind:value={newWeight}
        />
      </div>
    </div>
    {#if addError}
      <p class="error" role="alert">{addError}</p>
    {/if}
    <button type="submit" class="primary" disabled={adding}>
      {adding ? m().common.saving : m().weight.addButton}
    </button>
  </form>
</section>

{#if loading}
  <p class="muted">{m().common.loading}</p>
{:else}
  {#if loadError}
    <p class="error" role="alert">{loadError}</p>
  {/if}

  <h2 class="section-label">{m().weight.chartTitle}</h2>
  <section class="card">
    <nav class="tabs" aria-label={m().weight.rangeLabel}>
        <button type="button" class:active={range === 30} onclick={() => (range = 30)}>
          {m().weight.range30}
        </button>
        <button type="button" class:active={range === 90} onclick={() => (range = 90)}>
          {m().weight.range90}
        </button>
        <button type="button" class:active={range === 365} onclick={() => (range = 365)}>
          {m().weight.range365}
        </button>
        <button type="button" class:active={range === 'all'} onclick={() => (range = 'all')}>
          {m().weight.rangeAll}
        </button>
    </nav>
    {#if chartFiltered.length < 2}
      <p class="empty-state">{m().weight.chartUnavailable}</p>
    {:else}
      <div class="chart-container">
        <canvas bind:this={chartCanvas}></canvas>
      </div>
    {/if}
  </section>

  <h2 class="section-label">{m().weight.entriesTitle}</h2>
  <section class="card">
    {#if sortedDesc.length === 0}
      <p class="empty-state">{m().weight.empty}</p>
    {:else}
      <ul class="history-list">
        {#each sortedDesc as entry (entry.id)}
          <li class="history-row">
            <span class="history-row-date">{formatDate(entry.measuredAt)}</span>
            <span class="history-row-side">
              <span class="history-row-top">
                {entry.weightKg}
                <span class="history-row-unit">{m().common.kg}</span>
              </span>
              <button
                type="button"
                class="icon-btn icon-btn-danger"
                onclick={() => removeEntry(entry)}
                aria-label={m().common.delete}
              >
                <Icon name="trash" size={18} />
              </button>
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}
