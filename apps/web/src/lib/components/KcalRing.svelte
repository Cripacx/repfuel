<script lang="ts">
  import { m } from '$lib/i18n/index.js';

  /**
   * Tagesbudget als Ring: der Rest ist die Zahl, die zählt ("was darf ich noch
   * essen?"), nicht der bereits gegessene Anteil. Deshalb steht der Rest in der
   * Mitte und der Verbrauch nur klein darunter.
   *
   * Über dem Ziel wechselt der Ring auf --warning und die Mitte zeigt die
   * Überschreitung mit Vorzeichen — die Bedeutung hängt nie allein an der Farbe.
   */
  let {
    kcal,
    target,
  }: {
    kcal: number;
    target: number;
  } = $props();

  // r = 52 bei viewBox 120 lässt Platz für die 8px-Kontur ohne Beschnitt.
  const RADIUS = 52;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const ratio = $derived(target > 0 ? kcal / target : 0);
  const over = $derived(kcal > target && target > 0);
  const remaining = $derived(Math.round(target - kcal));
  const dashOffset = $derived(CIRCUMFERENCE * (1 - Math.min(Math.max(ratio, 0), 1)));
</script>

<div class="kcal-ring">
  <svg viewBox="0 0 120 120" role="img" aria-label={m().home.todayNutritionTitle}>
    <circle class="kcal-ring-track" cx="60" cy="60" r={RADIUS} />
    <circle
      class="kcal-ring-value"
      class:over
      cx="60"
      cy="60"
      r={RADIUS}
      stroke-dasharray={CIRCUMFERENCE}
      stroke-dashoffset={dashOffset}
    />
  </svg>

  <div class="kcal-ring-center">
    <strong class="kcal-ring-number">{over ? `+${Math.abs(remaining)}` : remaining}</strong>
    <span class="kcal-ring-caption">
      {over ? m().nutrition.overTargetLabel : m().home.kcalLeft}
    </span>
  </div>
</div>

<style>
  .kcal-ring {
    position: relative;
    width: 168px;
    max-width: 100%;
    margin-inline: auto;
  }

  .kcal-ring svg {
    display: block;
    width: 100%;
    height: auto;
    /* Startpunkt auf 12 Uhr statt 3 Uhr — der Ring soll oben beginnen. */
    transform: rotate(-90deg);
  }

  .kcal-ring circle {
    fill: none;
    stroke-width: 8;
    stroke-linecap: round;
  }

  .kcal-ring-track {
    stroke: var(--surface-2);
  }

  .kcal-ring-value {
    stroke: var(--macro-kcal);
    transition: stroke-dashoffset var(--dur-base) var(--ease-out);
  }

  .kcal-ring-value.over {
    stroke: var(--warning);
  }

  /* Mittig im Ring, ohne den SVG-Rotationskontext zu erben. */
  .kcal-ring-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    pointer-events: none;
  }

  .kcal-ring-number {
    font-size: var(--text-2xl);
    font-weight: var(--weight-heading);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--tracking-2xl);
    line-height: 1;
  }

  .kcal-ring-caption {
    color: var(--text-muted);
    font-size: var(--text-sm);
  }
</style>
