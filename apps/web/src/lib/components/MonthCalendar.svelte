<script lang="ts">
  import { buildMonthGrid, shiftMonthKey } from '$lib/nutrition/month-grid.js';
  import { getLocale, m } from '$lib/i18n/index.js';

  /**
   * Monatsübersicht zum Springen zwischen Tagen. Ein Punkt markiert Tage, an
   * denen etwas geloggt ist — so sieht man Lücken, ohne sie einzeln anzusteuern.
   */
  let {
    month,
    selectedDate,
    today,
    loggedDates,
    onSelect,
    onMonthChange,
  }: {
    /** YYYY-MM */
    month: string;
    selectedDate: string;
    today: string;
    /** Tage mit mindestens einem Eintrag. */
    loggedDates: ReadonlySet<string>;
    onSelect: (date: string) => void;
    onMonthChange: (month: string) => void;
  } = $props();

  const weeks = $derived(buildMonthGrid(month));

  const monthLabel = $derived(
    new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString(
      getLocale() === 'de' ? 'de-DE' : 'en-US',
      { month: 'long', year: 'numeric', timeZone: 'UTC' },
    ),
  );

  /** Wochentagskürzel, Montag zuerst — aus der Locale, nicht hartkodiert. */
  const weekdayLabels = $derived.by(() => {
    const formatter = new Intl.DateTimeFormat(getLocale() === 'de' ? 'de-DE' : 'en-US', {
      weekday: 'short',
      timeZone: 'UTC',
    });
    // 2026-06-01 war ein Montag — dient hier nur als Referenzwoche.
    return Array.from({ length: 7 }, (_, i) =>
      formatter.format(new Date(Date.UTC(2026, 5, 1 + i))),
    );
  });

  function dayNumber(date: string): string {
    return String(Number(date.slice(8, 10)));
  }
</script>

<div class="month-calendar">
  <div class="month-calendar-head">
    <button
      type="button"
      class="icon-btn"
      onclick={() => onMonthChange(shiftMonthKey(month, -1))}
      aria-label={m().nutrition.previousMonth}
    >
      ‹
    </button>
    <strong>{monthLabel}</strong>
    <button
      type="button"
      class="icon-btn"
      onclick={() => onMonthChange(shiftMonthKey(month, 1))}
      aria-label={m().nutrition.nextMonth}
    >
      ›
    </button>
  </div>

  <div class="month-calendar-weekdays" aria-hidden="true">
    {#each weekdayLabels as label, i (i)}
      <span>{label}</span>
    {/each}
  </div>

  {#each weeks as week, weekIndex (weekIndex)}
    <div class="month-calendar-week">
      {#each week as day (day.date)}
        <button
          type="button"
          class="month-calendar-day"
          class:outside={!day.inMonth}
          class:selected={day.date === selectedDate}
          class:today={day.date === today}
          disabled={day.date > today}
          onclick={() => onSelect(day.date)}
        >
          <span>{dayNumber(day.date)}</span>
          {#if loggedDates.has(day.date)}
            <span class="month-calendar-dot" aria-hidden="true"></span>
          {/if}
        </button>
      {/each}
    </div>
  {/each}
</div>

<style>
  .month-calendar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .month-calendar-weekdays,
  .month-calendar-week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: var(--space-1);
  }

  .month-calendar-weekdays {
    margin-bottom: var(--space-1);
    color: var(--text-faint);
    font-size: var(--text-xs);
    text-align: center;
  }

  .month-calendar-day {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    /* Volle 44px wären bei sieben Spalten auf 320px-Screens zu breit; 40px plus
       der Abstand dazwischen bleibt sicher treffbar. */
    min-height: 40px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition:
      transform var(--dur-press) var(--ease-out),
      background var(--dur-fast) var(--ease-out);
  }

  .month-calendar-day:active:not(:disabled) {
    transform: scale(0.92);
  }

  .month-calendar-day:disabled {
    cursor: default;
    color: var(--text-faint);
  }

  .month-calendar-day.outside {
    color: var(--text-faint);
  }

  .month-calendar-day.today {
    font-weight: var(--weight-heading);
  }

  .month-calendar-day.selected {
    background: var(--accent);
    color: var(--on-accent);
  }

  .month-calendar-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--success);
  }

  /* Auf der Auswahl muss der Punkt die Akzentfläche kontrastieren. */
  .month-calendar-day.selected .month-calendar-dot {
    background: var(--on-accent);
  }
</style>
