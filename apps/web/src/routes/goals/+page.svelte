<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ACTIVITY_LEVELS,
    calculateTargets,
    GOALS,
    type ActivityLevel,
    type Goal,
    type Sex,
    type TargetResult,
  } from '@repfuel/shared';
  import { resolve } from '$app/paths';
  import { api } from '$lib/api.js';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';

  let heightCm = $state<number | ''>('');
  let birthYear = $state<number | ''>('');
  let sex = $state<Sex | ''>('');
  let activityLevel = $state<ActivityLevel | ''>('');
  let goal = $state<Goal | ''>('');

  let weightKg = $state<number | ''>('');
  let hasWeightEntry = $state(false);

  let kcalTarget = $state<number | ''>('');
  let proteinTargetG = $state<number | ''>('');
  let carbsTargetG = $state<number | ''>('');
  let fatTargetG = $state<number | ''>('');
  // Wasser und Fasten werden nicht berechnet, sondern gesetzt — sie hängen
  // nicht am Kalorienbedarf und werden deshalb von der Live-Berechnung nicht
  // angefasst. Leer = Karte auf der Startseite bleibt aus.
  let waterTargetMl = $state<number | ''>('');
  let fastingWindowH = $state<number | ''>('');
  /** true, sobald gespeicherte oder manuell bearbeitete Ziele existieren — verhindert, dass die
   * Live-Berechnung sie bei jeder Eingabeänderung stillschweigend überschreibt. */
  let targetsManuallyEdited = $state(false);

  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let saving = $state(false);
  let saveError = $state<string | null>(null);
  let saved = $state(false);

  onMount(async () => {
    try {
      const [{ profile }, { entries }] = await Promise.all([
        api.profile.get(),
        api.weight.list({ limit: 1 }),
      ]);
      if (profile.heightCm != null) heightCm = profile.heightCm;
      if (profile.birthYear != null) birthYear = profile.birthYear;
      if (profile.sex != null) sex = profile.sex;
      if (profile.activityLevel != null) activityLevel = profile.activityLevel;
      if (profile.goal != null) goal = profile.goal;
      if (profile.kcalTarget != null) kcalTarget = profile.kcalTarget;
      if (profile.proteinTargetG != null) proteinTargetG = profile.proteinTargetG;
      if (profile.carbsTargetG != null) carbsTargetG = profile.carbsTargetG;
      if (profile.fatTargetG != null) fatTargetG = profile.fatTargetG;
      if (profile.waterTargetMl != null) waterTargetMl = profile.waterTargetMl;
      if (profile.fastingWindowH != null) fastingWindowH = profile.fastingWindowH;
      if (
        profile.kcalTarget != null ||
        profile.proteinTargetG != null ||
        profile.carbsTargetG != null ||
        profile.fatTargetG != null
      ) {
        // Bereits gespeicherte Ziele nicht sofort durch die Live-Vorschau überschreiben.
        targetsManuallyEdited = true;
      }

      const latest = entries[0];
      if (latest) {
        hasWeightEntry = true;
        weightKg = latest.weightKg;
      }
    } catch (err) {
      loadError = describeError(err);
    } finally {
      loading = false;
    }
  });

  const preview = $derived.by<TargetResult | null>(() => {
    if (heightCm === '' || birthYear === '' || sex === '' || activityLevel === '' || goal === '' || weightKg === '') {
      return null;
    }
    return calculateTargets({
      heightCm: Number(heightCm),
      birthYear: Number(birthYear),
      sex,
      activityLevel,
      goal,
      weightKg: Number(weightKg),
    });
  });

  $effect(() => {
    const p = preview;
    if (p && !targetsManuallyEdited) {
      kcalTarget = p.kcalTarget;
      proteinTargetG = p.proteinTargetG;
      carbsTargetG = p.carbsTargetG;
      fatTargetG = p.fatTargetG;
    }
  });

  function markTargetsEdited(): void {
    targetsManuallyEdited = true;
  }

  function resetToCalculated(): void {
    targetsManuallyEdited = false;
  }

  async function save(): Promise<void> {
    saveError = null;
    saved = false;
    if (heightCm === '' || birthYear === '' || sex === '' || activityLevel === '' || goal === '') {
      saveError = m().goals.incompleteForm;
      return;
    }
    saving = true;
    try {
      const { profile: updated } = await api.profile.update({
        heightCm: Number(heightCm),
        birthYear: Number(birthYear),
        sex,
        activityLevel,
        goal,
        kcalTarget: kcalTarget === '' ? null : Number(kcalTarget),
        proteinTargetG: proteinTargetG === '' ? null : Number(proteinTargetG),
        carbsTargetG: carbsTargetG === '' ? null : Number(carbsTargetG),
        fatTargetG: fatTargetG === '' ? null : Number(fatTargetG),
        waterTargetMl: waterTargetMl === '' ? null : Number(waterTargetMl),
        fastingWindowH: fastingWindowH === '' ? null : Number(fastingWindowH),
      });
      kcalTarget = updated.kcalTarget ?? '';
      proteinTargetG = updated.proteinTargetG ?? '';
      carbsTargetG = updated.carbsTargetG ?? '';
      fatTargetG = updated.fatTargetG ?? '';
      waterTargetMl = updated.waterTargetMl ?? '';
      fastingWindowH = updated.fastingWindowH ?? '';
      targetsManuallyEdited = true;
      saved = true;
    } catch (err) {
      saveError = describeError(err);
    } finally {
      saving = false;
    }
  }
</script>

<h1>{m().goals.title}</h1>

{#if loading}
  <p class="muted">{m().common.loading}</p>
{:else}
  {#if loadError}
    <p class="error" role="alert">{loadError}</p>
  {/if}

  <section class="card">
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div class="field-row">
        <div>
          <label for="goals-height">{m().goals.heightLabel}</label>
          <input id="goals-height" type="number" inputmode="numeric" min="80" max="250" bind:value={heightCm} />
        </div>
        <div>
          <label for="goals-birth-year">{m().goals.birthYearLabel}</label>
          <input
            id="goals-birth-year"
            type="number"
            inputmode="numeric"
            min="1900"
            max="2100"
            bind:value={birthYear}
          />
        </div>
      </div>

      <span id="goals-sex-label">{m().goals.sexLabel}</span>
      <div role="radiogroup" aria-labelledby="goals-sex-label">
        <label>
          <input type="radio" name="goals-sex" checked={sex === 'male'} onchange={() => (sex = 'male')} />
          {m().goals.sexMale}
        </label>
        <label>
          <input type="radio" name="goals-sex" checked={sex === 'female'} onchange={() => (sex = 'female')} />
          {m().goals.sexFemale}
        </label>
      </div>

      <label for="goals-activity">{m().goals.activityLabel}</label>
      <select id="goals-activity" bind:value={activityLevel}>
        <option value="" disabled>—</option>
        {#each ACTIVITY_LEVELS as level (level)}
          <option value={level}>{m().goals.activity[level]}</option>
        {/each}
      </select>

      <span id="goals-goal-label">{m().goals.goalLabel}</span>
      <div role="radiogroup" aria-labelledby="goals-goal-label">
        {#each GOALS as g (g)}
          <label>
            <input type="radio" name="goals-goal" checked={goal === g} onchange={() => (goal = g)} />
            {g === 'cut' ? m().goals.goalCut : g === 'bulk' ? m().goals.goalBulk : m().goals.goalMaintain}
          </label>
        {/each}
      </div>

      <h2>{m().goals.weightTitle}</h2>
      {#if hasWeightEntry}
        <p>
          <strong>{weightKg} {m().common.kg}</strong>
          <span class="muted">— {m().goals.weightKnownHint}</span>
        </p>
        <a class="link-more" href={resolve('/weight')}>{m().goals.viewWeightHistory}</a>
      {:else}
        <p class="muted">{m().goals.weightMissingHint}</p>
        <label for="goals-weight">{m().goals.weightInputLabel}</label>
        <input
          id="goals-weight"
          type="number"
          inputmode="decimal"
          min="20"
          max="500"
          step="0.1"
          bind:value={weightKg}
        />
      {/if}

      <h2>{m().goals.previewTitle}</h2>
      {#if preview}
        <dl class="summary-grid">
          <div>
            <dt>{m().goals.bmrLabel}</dt>
            <dd>{preview.bmr} {m().nutrition.kcalUnit}</dd>
          </div>
          <div>
            <dt>{m().goals.tdeeLabel}</dt>
            <dd>{preview.tdee} {m().nutrition.kcalUnit}</dd>
          </div>
          <div>
            <dt>{m().nutrition.kcal}</dt>
            <dd>{preview.kcalTarget} {m().nutrition.kcalUnit}</dd>
          </div>
          <div>
            <dt>{m().nutrition.macros.protein}</dt>
            <dd>{preview.proteinTargetG} g</dd>
          </div>
          <div>
            <dt>{m().nutrition.macros.carbs}</dt>
            <dd>{preview.carbsTargetG} g</dd>
          </div>
          <div>
            <dt>{m().nutrition.macros.fat}</dt>
            <dd>{preview.fatTargetG} g</dd>
          </div>
        </dl>
        <button
          type="button"
          class="secondary"
          onclick={() => {
            resetToCalculated();
          }}
        >
          {m().goals.resetToCalculated}
        </button>
      {:else}
        <p class="empty-state">{m().goals.previewIncomplete}</p>
      {/if}

      <h2>{m().goals.manualOverrideTitle}</h2>
      <p class="hint">{m().goals.manualOverrideHint}</p>
      <div class="field-row">
        <div>
          <label for="goals-kcal-target">{m().goals.kcalTargetLabel}</label>
          <input
            id="goals-kcal-target"
            type="number"
            inputmode="numeric"
            min="500"
            max="10000"
            bind:value={kcalTarget}
            oninput={markTargetsEdited}
          />
        </div>
        <div>
          <label for="goals-protein-target">{m().goals.proteinTargetLabel}</label>
          <input
            id="goals-protein-target"
            type="number"
            inputmode="numeric"
            min="0"
            max="1000"
            bind:value={proteinTargetG}
            oninput={markTargetsEdited}
          />
        </div>
      </div>
      <div class="field-row">
        <div>
          <label for="goals-carbs-target">{m().goals.carbsTargetLabel}</label>
          <input
            id="goals-carbs-target"
            type="number"
            inputmode="numeric"
            min="0"
            max="2000"
            bind:value={carbsTargetG}
            oninput={markTargetsEdited}
          />
        </div>
        <div>
          <label for="goals-fat-target">{m().goals.fatTargetLabel}</label>
          <input
            id="goals-fat-target"
            type="number"
            inputmode="numeric"
            min="0"
            max="1000"
            bind:value={fatTargetG}
            oninput={markTargetsEdited}
          />
        </div>
      </div>

      <h3>{m().goals.habitsTitle}</h3>
      <p class="hint">{m().goals.habitsHint}</p>
      <div class="target-grid">
        <div>
          <label for="goals-water-target">{m().goals.waterTargetLabel}</label>
          <input
            id="goals-water-target"
            type="number"
            inputmode="numeric"
            min="100"
            max="10000"
            step="100"
            bind:value={waterTargetMl}
          />
        </div>
        <div>
          <label for="goals-fasting-window">{m().goals.fastingWindowLabel}</label>
          <input
            id="goals-fasting-window"
            type="number"
            inputmode="numeric"
            min="1"
            max="23"
            bind:value={fastingWindowH}
          />
        </div>
      </div>

      {#if saveError}
        <p class="error" role="alert">{saveError}</p>
      {/if}
      {#if saved}
        <p class="notice">{m().goals.saved}</p>
      {/if}
      <button type="submit" class="primary" disabled={saving}>
        {saving ? m().common.saving : m().goals.applyButton}
      </button>
    </form>
  </section>
{/if}
