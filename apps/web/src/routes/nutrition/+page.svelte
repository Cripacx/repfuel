<script lang="ts">
  import { onMount } from 'svelte';
  import { MEAL_TYPES, type MealDto, type MealType, type NutritionDayDto, type NutritionTargets } from '@repfuel/shared';
  import { resolve } from '$app/paths';
  import { requestConfirm } from '$lib/confirm.svelte.js';
  import { api } from '$lib/api.js';
  import AddMealForm from '$lib/components/AddMealForm.svelte';
  import DaySummaryCard from '$lib/components/DaySummaryCard.svelte';
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
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
  import { groupMealsByType, suggestMealType } from '$lib/nutrition/meal-grouping.js';
  import { mealKcalBudget } from '$lib/nutrition/progress.js';
  import { hydrateMeals, listMealsLocal, removeMeal, upsertMeal } from '$lib/offline/repo.js';

  const tzOffsetMinutes = currentTzOffsetMinutes();

  let selectedDate = $state(todayDateString());
  let meals = $state<MealDto[]>([]);
  let statsDay = $state<NutritionDayDto | null>(null);
  let targets = $state<NutritionTargets | null>(null);

  let loading = $state(true);
  let loadError = $state<string | null>(null);

  // Sheet-Zustand: der Typ wird im Sheet gewählt (vorbelegt nach Uhrzeit bzw.
  // durch das "+" der jeweiligen Gruppe).
  let addOpen = $state(false);
  let addInitialType = $state<MealType>('breakfast');

  let editingMealId = $state<string | null>(null);
  let editAmount = $state(100);
  let editQuickKcal = $state<number | ''>('');
  let editSaving = $state(false);
  let editError = $state<string | null>(null);

  const grouped = $derived(groupMealsByType(meals));

  /** Diary-Ikonografie je Mahlzeit (YAZIO-Muster). */
  const MEAL_ICONS: Record<MealType, IconName> = {
    breakfast: 'sunrise',
    lunch: 'sun',
    dinner: 'moon',
    snack: 'apple',
  };

  function groupKcal(type: MealType): number {
    return grouped[type].reduce((sum, meal) => sum + meal.kcal, 0);
  }

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

  function openAddMeal(type?: MealType): void {
    addInitialType = type ?? suggestMealType(new Date());
    addOpen = true;
  }
  function closeAddMeal(): void {
    addOpen = false;
  }

  function handleMealSaved(meal: MealDto): void {
    meals = [...meals, meal];
    closeAddMeal();
    // Lokal aggregieren statt den Server zu fragen: der Schreibpfad läuft
    // asynchron über die Outbox — ein sofortiger Stats-Request verliert das
    // Rennen und würde die Summe fälschlich auf den alten Stand setzen.
    statsDay = aggregateDayFromMeals(selectedDate, meals);
  }

  async function deleteMeal(meal: MealDto): Promise<void> {
    if (!(await requestConfirm({ message: m().nutrition.deleteMealConfirm, confirmLabel: m().common.delete }))) return;
    loadError = null;
    try {
      await removeMeal(meal.id);
      meals = meals.filter((m2) => m2.id !== meal.id);
      statsDay = aggregateDayFromMeals(selectedDate, meals);
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
      statsDay = aggregateDayFromMeals(selectedDate, meals);
    } catch (err) {
      editError = describeError(err);
    } finally {
      editSaving = false;
    }
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

  <h2 class="section-label">{m().home.overviewTitle}</h2>
  <DaySummaryCard day={statsDay} targets={targets} />

  <h2 class="section-label">{m().nutrition.mealsTitle}</h2>
  {#each MEAL_TYPES as type (type)}
    <section class="card meal-card">
      <div class="meal-card-head">
        <span class="meal-card-icon" aria-hidden="true"><Icon name={MEAL_ICONS[type]} /></span>
        <div class="meal-card-title">
          <h3>{m().nutrition.mealTypes[type]}</h3>
          <span class="meal-card-kcal">
            {roundKcal(groupKcal(type))}{mealKcalBudget(type, targets?.kcalTarget) !== null
              ? ` / ${mealKcalBudget(type, targets?.kcalTarget)}`
              : ''}
            {m().nutrition.kcalUnit}
          </span>
        </div>
        <button
          type="button"
          class="icon-btn"
          onclick={() => openAddMeal(type)}
          aria-label={`${m().nutrition.mealTypes[type]} — ${m().nutrition.addMealButton}`}
        >
          <Icon name="plus" />
        </button>
      </div>

      {#if grouped[type].length > 0}
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

{#if !loading}
  <button type="button" class="fab" onclick={() => openAddMeal()}>
    <Icon name="plus" />
    {m().nutrition.addMeal.fabLabel}
  </button>
{/if}

{#if addOpen}
  <Modal title={m().nutrition.addMeal.title} onClose={closeAddMeal}>
    <AddMealForm
      initialMealType={addInitialType}
      eatenAt={defaultEatenAtIso(selectedDate)}
      onSaved={handleMealSaved}
      dayKcal={statsDay?.kcal ?? 0}
      kcalTarget={targets?.kcalTarget ?? null}
    />
  </Modal>
{/if}
