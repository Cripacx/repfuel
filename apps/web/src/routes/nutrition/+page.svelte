<script lang="ts">
  import { onMount } from 'svelte';
  import { MEAL_TYPES, type MealDto, type MealType, type NutritionDayDto, type NutritionTargets } from '@repfuel/shared';
  import { resolve } from '$app/paths';
  import { requestConfirm } from '$lib/confirm.svelte.js';
  import { api } from '$lib/api.js';
  import AddMealForm from '$lib/components/AddMealForm.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import MonthCalendar from '$lib/components/MonthCalendar.svelte';
  import NumberStepper from '$lib/components/NumberStepper.svelte';
  import { describeError } from '$lib/errors.js';
  import { getLocale, m } from '$lib/i18n/index.js';
  import { monthBounds, monthKeyOf } from '$lib/nutrition/month-grid.js';
  import { DUR_EXIT, DUR_STATE, arrive } from '$lib/motion.js';
  import {
    currentTzOffsetMinutes,
    defaultEatenAtIso,
    isToday,
    localDayBoundsUtc,
    shiftDateString,
    todayDateString,
  } from '$lib/nutrition/day-range.js';
  import { round1, roundKcal } from '$lib/nutrition/format.js';
  import { groupMealsByType } from '$lib/nutrition/meal-grouping.js';
  import { computeProgress } from '$lib/nutrition/progress.js';
  import { hydrateMeals, listMealsLocal, removeMeal, upsertMeal } from '$lib/offline/repo.js';

  const tzOffsetMinutes = currentTzOffsetMinutes();

  let selectedDate = $state(todayDateString());
  let meals = $state<MealDto[]>([]);
  let statsDay = $state<NutritionDayDto | null>(null);
  let targets = $state<NutritionTargets | null>(null);

  let loading = $state(true);
  let loadError = $state<string | null>(null);

  let addMealType = $state<MealType | null>(null);

  let editingMealId = $state<string | null>(null);
  let editAmount = $state(100);
  let editQuickKcal = $state<number | ''>('');
  let editSaving = $state(false);
  let editError = $state<string | null>(null);

  const grouped = $derived(groupMealsByType(meals));
  const kcalProgress = $derived(
    statsDay && targets ? computeProgress(statsDay.kcal, targets.kcalTarget) : null,
  );
  const proteinProgress = $derived(
    statsDay && targets ? computeProgress(statsDay.proteinG, targets.proteinTargetG) : null,
  );
  const carbsProgress = $derived(
    statsDay && targets ? computeProgress(statsDay.carbsG, targets.carbsTargetG) : null,
  );
  const fatProgress = $derived(
    statsDay && targets ? computeProgress(statsDay.fatG, targets.fatTargetG) : null,
  );
  const noTargetsSet = $derived(targets !== null && targets.kcalTarget == null);

  function emptyDay(date: string): NutritionDayDto {
    return { date, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, mealCount: 0 };
  }

  /** Summiert Tageswerte aus lokal gespiegelten Mahlzeiten — Offline-Fallback für
   * `GET /stats/nutrition`, das kein eigener Offline-Entitätstyp ist (M4-Scope: nur
   * workouts/sets/meals/body_weight). Ziele bleiben dabei auf dem zuletzt online
   * geladenen Stand, da Profil/Ziele nicht in Dexie gespiegelt werden. */
  function aggregateDayFromMeals(date: string, dayMeals: MealDto[]): NutritionDayDto {
    return dayMeals.reduce(
      (acc, meal) => ({
        date,
        kcal: acc.kcal + meal.kcal,
        proteinG: acc.proteinG + meal.proteinG,
        carbsG: acc.carbsG + meal.carbsG,
        fatG: acc.fatG + meal.fatG,
        mealCount: acc.mealCount + 1,
      }),
      emptyDay(date),
    );
  }

  let lastKnownTargets: NutritionTargets | null = null;

  async function loadStats(date: string, dayMeals: MealDto[]): Promise<void> {
    try {
      const res = await api.stats.nutrition({ from: date, to: date, tzOffsetMinutes });
      statsDay = res.days.find((d) => d.date === date) ?? emptyDay(date);
      targets = res.targets;
      lastKnownTargets = res.targets;
    } catch (err) {
      if (!(err instanceof TypeError)) throw err;
      statsDay = aggregateDayFromMeals(date, dayMeals);
      targets = lastKnownTargets;
    }
  }

  async function loadDay(date: string): Promise<void> {
    loading = true;
    loadError = null;
    try {
      const bounds = localDayBoundsUtc(date, tzOffsetMinutes);
      let dayMeals: MealDto[];
      try {
        const mealsRes = await api.meals.list({ from: bounds.from, to: bounds.to, limit: 500 });
        dayMeals = mealsRes.meals;
        await hydrateMeals(dayMeals);
      } catch (err) {
        if (!(err instanceof TypeError)) throw err;
        dayMeals = await listMealsLocal(bounds.from, bounds.to);
      }
      meals = dayMeals;
      await loadStats(date, dayMeals);
    } catch (err) {
      loadError = describeError(err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadDay(selectedDate);
  });

  function changeDate(next: string): void {
    selectedDate = next;
    editingMealId = null;
    void loadDay(next);
  }

  function goToday(): void {
    changeDate(todayDateString());
  }
  function goPrevDay(): void {
    changeDate(shiftDateString(selectedDate, -1));
  }
  function goNextDay(): void {
    changeDate(shiftDateString(selectedDate, 1));
  }

  function formatDateLabel(date: string): string {
    if (isToday(date)) return m().nutrition.today;
    if (date === shiftDateString(todayDateString(), -1)) return m().nutrition.yesterday;
    return new Date(`${date}T00:00:00`).toLocaleDateString(getLocale() === 'de' ? 'de-DE' : 'en-US', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
  }

  function openAddMeal(type: MealType): void {
    addMealType = type;
  }
  function closeAddMeal(): void {
    addMealType = null;
  }

  function handleMealSaved(meal: MealDto): void {
    meals = [...meals, meal];
    closeAddMeal();
    void loadStats(selectedDate, meals);
  }

  async function deleteMeal(meal: MealDto): Promise<void> {
    if (!(await requestConfirm({ message: m().nutrition.deleteMealConfirm, confirmLabel: m().common.delete }))) return;
    loadError = null;
    try {
      await removeMeal(meal.id);
      meals = meals.filter((m2) => m2.id !== meal.id);
      await loadStats(selectedDate, meals);
    } catch (err) {
      loadError = describeError(err);
    }
  }

  function startEditMeal(meal: MealDto): void {
    editingMealId = meal.id;
    editError = null;
    if (meal.foodId) {
      editAmount = meal.amountG ?? 100;
    } else {
      editQuickKcal = meal.quickKcal ?? '';
    }
  }

  function cancelEditMeal(): void {
    editingMealId = null;
    editError = null;
  }

  async function saveEditMeal(meal: MealDto): Promise<void> {
    editSaving = true;
    editError = null;
    try {
      const updated = meal.foodId
        ? await upsertMeal(
            meal.id,
            { eatenAt: meal.eatenAt, mealType: meal.mealType, foodId: meal.foodId, amountG: editAmount },
            meal.food,
          )
        : await upsertMeal(meal.id, {
            eatenAt: meal.eatenAt,
            mealType: meal.mealType,
            quickKcal: editQuickKcal === '' ? 0 : Number(editQuickKcal),
          });
      meals = meals.map((m2) => (m2.id === updated.id ? updated : m2));
      editingMealId = null;
      await loadStats(selectedDate, meals);
    } catch (err) {
      editError = describeError(err);
    } finally {
      editSaving = false;
    }
  }

  function overAmount(actual: number, target: number | null | undefined): number {
    if (target == null) return 0;
    return Math.max(0, Math.round(actual - target));
  }

  function mealLabel(meal: MealDto): string {
    if (meal.food) {
      return meal.food.brand ? `${meal.food.name} · ${meal.food.brand}` : meal.food.name;
    }
    return m().nutrition.quickEntryLabel;
  }

  // --- Monatsübersicht ---------------------------------------------------
  // Standardmäßig zu, damit der schnelle Weg (heute loggen) der kurze bleibt;
  // die Übersicht ist einen Tipp entfernt.
  let calendarOpen = $state(false);
  // Folgt dem gewählten Tag, lässt sich aber überschreiben: im Kalender zu
  // blättern ändert selectedDate nicht, der Nutzer kann also frei in anderen
  // Monaten stöbern, bis er einen Tag wählt.
  let calendarMonth = $derived(monthKeyOf(selectedDate));
  let loggedDates = $state<Set<string>>(new Set());

  $effect(() => {
    if (!calendarOpen) return;
    const month = calendarMonth;
    void (async () => {
      try {
        const { from, to } = monthBounds(month);
        const res = await api.stats.nutrition({ from, to, tzOffsetMinutes });
        loggedDates = new Set(res.days.filter((d) => d.mealCount > 0).map((d) => d.date));
      } catch {
        // Ohne Monatsdaten bleibt der Kalender nutzbar — nur die Punkte fehlen.
      }
    })();
  });

  function pickDate(date: string): void {
    calendarMonth = monthKeyOf(date);
    changeDate(date);
  }
</script>

<div class="page-header">
  <h1>{m().nutrition.title}</h1>
  <a class="secondary" href={resolve('/goals')}>{m().nutrition.goalsLink}</a>
</div>

<div class="date-nav">
  <button type="button" class="icon-btn" onclick={goPrevDay} aria-label={m().nutrition.previousDay}>
    <Icon name="chevron-left" />
  </button>
  <div class="date-nav-current">
    <button
      type="button"
      class="date-nav-label"
      onclick={() => (calendarOpen = !calendarOpen)}
      aria-expanded={calendarOpen}
      aria-label={m().nutrition.monthOverview}
    >
      {formatDateLabel(selectedDate)}
    </button>
    {#if !isToday(selectedDate)}
      <button type="button" class="link-more" onclick={goToday}>{m().nutrition.today}</button>
    {/if}
  </div>
  <button
    type="button"
    class="icon-btn"
    onclick={goNextDay}
    disabled={isToday(selectedDate)}
    aria-label={m().nutrition.nextDay}
  >
    <Icon name="chevron-right" />
  </button>
</div>

{#if calendarOpen}
  <!-- Klappt aus dem Datum darüber auf und wieder dorthin zurück — der Schalter
       ist die Herkunft, nicht irgendein Rand. -->
  <section
    class="card"
    in:arrive={{ duration: DUR_STATE }}
    out:arrive={{ duration: DUR_EXIT }}
  >
    <MonthCalendar
      month={calendarMonth}
      {selectedDate}
      today={todayDateString()}
      {loggedDates}
      onSelect={pickDate}
      onMonthChange={(next) => (calendarMonth = next)}
    />
  </section>
{/if}

{#if loading}
  <p class="muted">{m().common.loading}</p>
{:else}
  {#if loadError}
    <p class="error" role="alert">{loadError}</p>
  {/if}

  <section class="card">
    <div class="progress-block">
      <div class="progress-label" class:warning={kcalProgress?.over}>
        <span>{m().nutrition.kcal}</span>
        <span>
          {roundKcal(statsDay?.kcal ?? 0)}{targets?.kcalTarget != null
            ? ` / ${targets.kcalTarget}`
            : ''}
          {m().nutrition.kcalUnit}
        </span>
      </div>
      {#if kcalProgress}
        <div
          class="progress-bar"
          role="progressbar"
          aria-valuenow={Math.round(kcalProgress.cappedPercent)}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="progress-bar-fill kcal"
            class:over={kcalProgress.over}
            style={`width:${kcalProgress.cappedPercent}%`}
          ></div>
        </div>
        {#if kcalProgress.over}
          <p class="over-hint">
            +{overAmount(statsDay?.kcal ?? 0, targets?.kcalTarget)}
            {m().nutrition.kcalUnit} {m().nutrition.overTargetLabel}
          </p>
        {/if}
      {/if}
    </div>

    <div class="macro-bars">
      <div class="progress-block">
        <div class="progress-label" class:warning={proteinProgress?.over}>
          <span>{m().nutrition.macros.protein}</span>
          <span>
            {round1(statsDay?.proteinG ?? 0)}{targets?.proteinTargetG != null
              ? ` / ${targets.proteinTargetG}`
              : ''} g
          </span>
        </div>
        {#if proteinProgress}
          <div class="progress-bar">
            <div
              class="progress-bar-fill protein"
              class:over={proteinProgress.over}
              style={`width:${proteinProgress.cappedPercent}%`}
            ></div>
          </div>
          {#if proteinProgress.over}
            <p class="over-hint">
              +{overAmount(statsDay?.proteinG ?? 0, targets?.proteinTargetG)} g
              {m().nutrition.overTargetLabel}
            </p>
          {/if}
        {/if}
      </div>
      <div class="progress-block">
        <div class="progress-label" class:warning={carbsProgress?.over}>
          <span>{m().nutrition.macros.carbs}</span>
          <span>
            {round1(statsDay?.carbsG ?? 0)}{targets?.carbsTargetG != null
              ? ` / ${targets.carbsTargetG}`
              : ''} g
          </span>
        </div>
        {#if carbsProgress}
          <div class="progress-bar">
            <div
              class="progress-bar-fill carbs"
              class:over={carbsProgress.over}
              style={`width:${carbsProgress.cappedPercent}%`}
            ></div>
          </div>
          {#if carbsProgress.over}
            <p class="over-hint">
              +{overAmount(statsDay?.carbsG ?? 0, targets?.carbsTargetG)} g
              {m().nutrition.overTargetLabel}
            </p>
          {/if}
        {/if}
      </div>
      <div class="progress-block">
        <div class="progress-label" class:warning={fatProgress?.over}>
          <span>{m().nutrition.macros.fat}</span>
          <span>
            {round1(statsDay?.fatG ?? 0)}{targets?.fatTargetG != null
              ? ` / ${targets.fatTargetG}`
              : ''} g
          </span>
        </div>
        {#if fatProgress}
          <div class="progress-bar">
            <div
              class="progress-bar-fill fat"
              class:over={fatProgress.over}
              style={`width:${fatProgress.cappedPercent}%`}
            ></div>
          </div>
          {#if fatProgress.over}
            <p class="over-hint">
              +{overAmount(statsDay?.fatG ?? 0, targets?.fatTargetG)} g
              {m().nutrition.overTargetLabel}
            </p>
          {/if}
        {/if}
      </div>
    </div>

    {#if noTargetsSet}
      <p class="notice">
        {m().nutrition.noTargetsHint}
        <a href={resolve('/goals')}>{m().nutrition.goToGoals}</a>
      </p>
    {/if}
  </section>

  {#each MEAL_TYPES as type (type)}
    <section class="card meal-group">
      <div class="meal-group-header">
        <h2>{m().nutrition.mealTypes[type]}</h2>
        <button
          type="button"
          class="icon-btn"
          onclick={() => openAddMeal(type)}
          aria-label={m().nutrition.addMealButton}
        >
          <Icon name="plus" />
        </button>
      </div>

      {#if grouped[type].length === 0}
        <p class="empty-state">{m().nutrition.emptyMealGroup}</p>
      {:else}
        <ul class="meal-list">
          {#each grouped[type] as meal (meal.id)}
            <li class="meal-row">
              <div class="meal-row-main">
                <span class="meal-row-name">{mealLabel(meal)}</span>
                <span class="meal-row-meta">
                  {#if meal.food && meal.amountG !== null}
                    {round1(meal.amountG)} g ·
                  {/if}
                  {roundKcal(meal.kcal)}
                  {m().nutrition.kcalUnit} · P {round1(meal.proteinG)} · C {round1(meal.carbsG)} · F
                  {round1(meal.fatG)}
                </span>
              </div>
              <div class="row-actions">
                <button
                  type="button"
                  class="icon-btn"
                  onclick={() => startEditMeal(meal)}
                  aria-label={m().common.edit}
                >
                  <Icon name="edit" size={18} />
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  onclick={() => deleteMeal(meal)}
                  aria-label={m().common.delete}
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </li>
            {#if editingMealId === meal.id}
              <li class="meal-edit-row">
                {#if meal.foodId}
                  <NumberStepper
                    id={`edit-amount-${meal.id}`}
                    bind:value={editAmount}
                    step={10}
                    min={1}
                    label={m().nutrition.addMeal.amountLabel}
                  />
                {:else}
                  <input
                    type="number"
                    inputmode="numeric"
                    min="1"
                    step="1"
                    bind:value={editQuickKcal}
                    aria-label={m().nutrition.addMeal.quickKcalLabel}
                  />
                {/if}
                {#if editError}
                  <p class="error" role="alert">{editError}</p>
                {/if}
                <div class="row-actions">
                  <button
                    type="button"
                    class="primary"
                    onclick={() => saveEditMeal(meal)}
                    disabled={editSaving}
                  >
                    {editSaving ? m().common.saving : m().common.save}
                  </button>
                  <button type="button" class="secondary" onclick={cancelEditMeal}>
                    {m().common.cancel}
                  </button>
                </div>
              </li>
            {/if}
          {/each}
        </ul>
      {/if}
    </section>
  {/each}
{/if}

{#if addMealType}
  <Modal title={`${m().nutrition.addMeal.title} — ${m().nutrition.mealTypes[addMealType]}`} onClose={closeAddMeal}>
    <AddMealForm
      mealType={addMealType}
      eatenAt={defaultEatenAtIso(selectedDate)}
      onSaved={handleMealSaved}
      dayKcal={statsDay?.kcal ?? 0}
      kcalTarget={targets?.kcalTarget ?? null}
    />
  </Modal>
{/if}
