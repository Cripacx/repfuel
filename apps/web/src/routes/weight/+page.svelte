<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { BodyWeightDto } from '@repfuel/shared';
  import type { Chart as ChartInstance } from 'chart.js';
  import { api } from '$lib/api.js';
  import { describeError } from '$lib/errors.js';
  import { getLocale, m } from '$lib/i18n/index.js';
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
      entries = loaded;
    } catch (err) {
      loadError = describeError(err);
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
      const { entry } = await api.weight.upsert(id, { weightKg: newWeight, measuredAt });
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
    if (!confirm(m().weight.deleteConfirm)) return;
    loadError = null;
    try {
      await api.weight.remove(entry.id);
      entries = entries.filter((e) => e.id !== entry.id);
    } catch (err) {
      loadError = describeError(err);
    }
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

    chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: m().weight.title,
            data,
            borderColor: '#2fae74',
            backgroundColor: 'rgba(47, 174, 116, 0.15)',
            tension: 0.25,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: '#2fae74',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: { ticks: { color: '#9aa3b2' }, grid: { color: '#242830' } },
          y: { ticks: { color: '#9aa3b2' }, grid: { color: '#242830' } },
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

  <section class="card">
    <div class="page-header">
      <h2>{m().weight.chartTitle}</h2>
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
    </div>
    {#if chartFiltered.length < 2}
      <p class="empty-state">{m().weight.chartUnavailable}</p>
    {:else}
      <div class="chart-container">
        <canvas bind:this={chartCanvas}></canvas>
      </div>
    {/if}
  </section>

  <section class="card">
    {#if sortedDesc.length === 0}
      <p class="empty-state">{m().weight.empty}</p>
    {:else}
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{m().weight.columnDate}</th>
              <th>{m().weight.columnWeight}</th>
              <th>{m().common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {#each sortedDesc as entry (entry.id)}
              <tr>
                <td>{formatDate(entry.measuredAt)}</td>
                <td>{entry.weightKg} {m().common.kg}</td>
                <td>
                  <button type="button" class="danger" onclick={() => removeEntry(entry)}>
                    {m().common.delete}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
{/if}
