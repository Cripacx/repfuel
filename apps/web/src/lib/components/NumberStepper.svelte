<script lang="ts">
  import Icon from './Icon.svelte';

  /** Numerisches Eingabefeld mit +/- Buttons für große Touch-Targets zwischen zwei Sätzen. */
  let {
    value = $bindable(),
    step,
    min = 0,
    id,
    label,
  }: {
    value: number;
    step: number;
    min?: number;
    id: string;
    label: string;
  } = $props();

  // Vermeidet Fließkomma-Artefakte wie 47.500000000000004 nach wiederholtem +2.5.
  function round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  function decrement(): void {
    value = Math.max(min, round(value - step));
  }

  function increment(): void {
    value = round(value + step);
  }
</script>

<div class="stepper">
  <button type="button" onclick={decrement} aria-label={`${label} -${step}`}><Icon name="minus" /></button>
  <input
    {id}
    type="number"
    inputmode="decimal"
    bind:value
    {step}
    {min}
    aria-label={label}
    onchange={() => {
      if (Number.isNaN(value) || value < min) value = min;
    }}
  />
  <button type="button" onclick={increment} aria-label={`${label} +${step}`}><Icon name="plus" /></button>
</div>
