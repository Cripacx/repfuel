<script lang="ts">
  import type { FoodDto, MealDto, MealType } from '@repfuel/shared';
  import { api, ApiError } from '$lib/api.js';
  import BarcodeScanner from './BarcodeScanner.svelte';
  import NumberStepper from './NumberStepper.svelte';
  import { debounce } from '$lib/debounce.js';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';
  import { round1, roundKcal } from '$lib/nutrition/format.js';
  import { upsertMeal } from '$lib/offline/repo.js';
  import { isOnline } from '$lib/offline/status.svelte.js';

  /**
   * Inhalt des "Mahlzeit hinzufügen"-Modals: drei Eingabewege (Suche, Barcode-Scan,
   * Schnelleintrag). Suche und Barcode münden beide in denselben Mengen-Schritt,
   * bevor per PUT /meals/:uuid geloggt wird.
   */
  let {
    mealType,
    eatenAt,
    onSaved,
    dayKcal = 0,
    kcalTarget = null,
  }: {
    mealType: MealType;
    eatenAt: string;
    onSaved: (meal: MealDto) => void;
    /** Bereits geloggte Kalorien des Tages — für die Auswirkung dieser Auswahl. */
    dayKcal?: number;
    kcalTarget?: number | null;
  } = $props();

  const QUICK_AMOUNTS = [50, 100, 150, 200, 250];

  type Tab = 'search' | 'barcode' | 'quick';
  let tab = $state<Tab>('search');

  // Food-Suche/Barcode sind laut Spec online-only (brauchen den Server/OFF) — offline
  // bleibt nur der Schnelleintrag. Weg von einem gerade deaktivierten Tab wechseln,
  // falls die Verbindung während des Ausfüllens wegfällt.
  $effect(() => {
    if (!isOnline() && tab !== 'quick') {
      tab = 'quick';
    }
  });

  function foodLabel(food: FoodDto): string {
    return food.brand ? `${food.name} · ${food.brand}` : food.name;
  }

  // --- Suche ---
  let query = $state('');
  let results = $state<FoodDto[]>([]);
  let searching = $state(false);
  let searchError = $state<string | null>(null);
  let searchedOnce = $state(false);

  const runSearch = debounce(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      results = [];
      searchedOnce = false;
      return;
    }
    searching = true;
    searchError = null;
    try {
      const { foods } = await api.foods.search(trimmed, 25);
      results = foods;
    } catch (err) {
      searchError = describeError(err);
    } finally {
      searching = false;
      searchedOnce = true;
    }
  }, 400);

  $effect(() => {
    runSearch(query);
  });

  // --- Eigenes Lebensmittel anlegen ---
  let showCustomFoodForm = $state(false);
  let customName = $state('');
  let customBrand = $state('');
  let customKcal = $state<number | ''>('');
  let customProtein = $state<number | ''>('');
  let customCarbs = $state<number | ''>('');
  let customFat = $state<number | ''>('');
  let creatingFood = $state(false);
  let createFoodError = $state<string | null>(null);

  async function createCustomFood(): Promise<void> {
    createFoodError = null;
    if (
      !customName.trim() ||
      customKcal === '' ||
      customProtein === '' ||
      customCarbs === '' ||
      customFat === ''
    ) {
      createFoodError = m().nutrition.addMeal.customFoodIncomplete;
      return;
    }
    creatingFood = true;
    try {
      const { food } = await api.foods.create({
        name: customName.trim(),
        brand: customBrand.trim() || null,
        kcalPer100: Number(customKcal),
        proteinPer100: Number(customProtein),
        carbsPer100: Number(customCarbs),
        fatPer100: Number(customFat),
      });
      showCustomFoodForm = false;
      selectFood(food);
    } catch (err) {
      createFoodError = describeError(err);
    } finally {
      creatingFood = false;
    }
  }

  // --- Barcode-Scan ---
  let barcodeError = $state<string | null>(null);
  let barcodeLoading = $state(false);

  async function handleBarcodeDetected(code: string): Promise<void> {
    barcodeError = null;
    barcodeLoading = true;
    try {
      const { food } = await api.foods.byBarcode(code);
      selectFood(food);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'not_found') {
        barcodeError = m().nutrition.addMeal.barcodeNotFound;
      } else {
        barcodeError = describeError(err);
      }
    } finally {
      barcodeLoading = false;
    }
  }

  // --- Menge (aus Suche oder Barcode) ---
  let selectedFood = $state<FoodDto | null>(null);
  let amountG = $state(100);
  let savingAmount = $state(false);
  let amountError = $state<string | null>(null);

  function selectFood(food: FoodDto): void {
    selectedFood = food;
    amountG = 100;
    amountError = null;
  }

  function clearSelectedFood(): void {
    selectedFood = null;
    barcodeError = null;
  }

  const previewNutrition = $derived.by(() => {
    if (!selectedFood) return null;
    const factor = amountG / 100;
    return {
      kcal: selectedFood.kcalPer100 * factor,
      proteinG: selectedFood.proteinPer100 * factor,
      carbsG: selectedFood.carbsPer100 * factor,
      fatG: selectedFood.fatPer100 * factor,
    };
  });

  async function saveWithFood(): Promise<void> {
    if (!selectedFood || amountG <= 0) {
      amountError = m().errors.generic;
      return;
    }
    savingAmount = true;
    amountError = null;
    try {
      const meal = await upsertMeal(
        crypto.randomUUID(),
        { eatenAt, mealType, foodId: selectedFood.id, amountG },
        selectedFood,
      );
      onSaved(meal);
    } catch (err) {
      amountError = describeError(err);
    } finally {
      savingAmount = false;
    }
  }

  // --- Schnelleintrag ---
  let quickKcal = $state<number | ''>('');
  let savingQuick = $state(false);
  let quickError = $state<string | null>(null);

  async function saveQuick(): Promise<void> {
    quickError = null;
    if (quickKcal === '' || Number(quickKcal) <= 0) {
      quickError = m().errors.generic;
      return;
    }
    savingQuick = true;
    try {
      const meal = await upsertMeal(crypto.randomUUID(), {
        eatenAt,
        mealType,
        quickKcal: Number(quickKcal),
      });
      onSaved(meal);
    } catch (err) {
      quickError = describeError(err);
    } finally {
      savingQuick = false;
    }
  }
</script>

<div class="add-meal">
  {#if selectedFood}
    <div class="amount-entry">
      <button type="button" class="secondary" onclick={clearSelectedFood}>{m().common.back}</button>
      <h3>{foodLabel(selectedFood)}</h3>
      <p class="muted">
        {roundKcal(selectedFood.kcalPer100)}
        {m().nutrition.kcalPer100}
      </p>

      <label for="meal-amount">{m().nutrition.addMeal.amountLabel}</label>
      <NumberStepper
        id="meal-amount"
        bind:value={amountG}
        step={10}
        min={1}
        label={m().nutrition.addMeal.amountLabel}
      />
      <div class="quick-amount-buttons">
        {#each QUICK_AMOUNTS as qa (qa)}
          <button type="button" class:active={amountG === qa} onclick={() => (amountG = qa)}>
            {qa} g
          </button>
        {/each}
      </div>

      {#if previewNutrition}
        <!-- Was diese Auswahl mit dem Tag macht: ohne die Bezugsgröße ist eine
             Kalorienzahl allein schwer einzuordnen. -->
        <p class="day-impact">
          {m().nutrition.addMeal.dayTotalLabel}
          <strong>
            {roundKcal(dayKcal + previewNutrition.kcal)}{kcalTarget != null
              ? ` / ${kcalTarget}`
              : ''}
            {m().nutrition.kcalUnit}
          </strong>
          <span class="day-impact-delta">+{roundKcal(previewNutrition.kcal)}</span>
        </p>

        <dl class="macro-preview">
          <div>
            <dt>{m().nutrition.kcal}</dt>
            <dd>{roundKcal(previewNutrition.kcal)}</dd>
          </div>
          <div>
            <dt>{m().nutrition.macros.protein}</dt>
            <dd>{round1(previewNutrition.proteinG)} g</dd>
          </div>
          <div>
            <dt>{m().nutrition.macros.carbs}</dt>
            <dd>{round1(previewNutrition.carbsG)} g</dd>
          </div>
          <div>
            <dt>{m().nutrition.macros.fat}</dt>
            <dd>{round1(previewNutrition.fatG)} g</dd>
          </div>
        </dl>
      {/if}

      {#if amountError}
        <p class="error" role="alert">{amountError}</p>
      {/if}
      <!-- Bleibt beim Scrollen erreichbar: die Nährwerte darüber können den
           Button sonst aus dem Blick schieben. -->
      <div class="sticky-action">
        <button type="button" class="primary" onclick={saveWithFood} disabled={savingAmount}>
          {savingAmount ? m().common.saving : m().nutrition.addMeal.logButton}
        </button>
      </div>
    </div>
  {:else}
    <nav class="tabs" aria-label={m().nutrition.addMeal.tabsLabel}>
      <button
        type="button"
        class:active={tab === 'search'}
        disabled={!isOnline()}
        onclick={() => (tab = 'search')}
      >
        {m().nutrition.addMeal.tabSearch}
      </button>
      <button
        type="button"
        class:active={tab === 'barcode'}
        disabled={!isOnline()}
        onclick={() => (tab = 'barcode')}
      >
        {m().nutrition.addMeal.tabBarcode}
      </button>
      <button type="button" class:active={tab === 'quick'} onclick={() => (tab = 'quick')}>
        {m().nutrition.addMeal.tabQuick}
      </button>
    </nav>

    {#if !isOnline()}
      <p class="hint">{m().offline.searchUnavailableOffline}</p>
    {/if}

    {#if tab === 'search'}
      <label for="meal-food-search">{m().nutrition.addMeal.searchLabel}</label>
      <input
        id="meal-food-search"
        type="text"
        autocomplete="off"
        placeholder={m().nutrition.addMeal.searchPlaceholder}
        bind:value={query}
      />

      {#if searching}
        <p class="muted">{m().nutrition.addMeal.searching}</p>
      {:else if searchError}
        <p class="error" role="alert">{searchError}</p>
      {:else if searchedOnce && results.length === 0}
        <p class="empty-state">{m().nutrition.addMeal.noResults}</p>
      {:else if results.length > 0}
        <ul class="picker-results">
          {#each results as food (food.id)}
            <li>
              <button type="button" class="picker-result-btn" onclick={() => selectFood(food)}>
                {foodLabel(food)}
                <span class="picker-result-meta">
                  {roundKcal(food.kcalPer100)}
                  {m().nutrition.kcalPer100}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      <button
        type="button"
        class="secondary"
        onclick={() => (showCustomFoodForm = !showCustomFoodForm)}
        aria-expanded={showCustomFoodForm}
      >
        {m().nutrition.addMeal.createCustomFoodToggle}
      </button>

      {#if showCustomFoodForm}
        <div class="card">
          <label for="custom-food-name">{m().nutrition.addMeal.customFoodName}</label>
          <input id="custom-food-name" type="text" bind:value={customName} />

          <label for="custom-food-brand">{m().nutrition.addMeal.customFoodBrand}</label>
          <input id="custom-food-brand" type="text" bind:value={customBrand} />

          <div class="field-row">
            <div>
              <label for="custom-food-kcal">{m().nutrition.addMeal.customFoodKcal}</label>
              <input
                id="custom-food-kcal"
                type="number"
                inputmode="decimal"
                min="0"
                step="1"
                bind:value={customKcal}
              />
            </div>
            <div>
              <label for="custom-food-protein">{m().nutrition.macros.protein} (g/100g)</label>
              <input
                id="custom-food-protein"
                type="number"
                inputmode="decimal"
                min="0"
                step="0.1"
                bind:value={customProtein}
              />
            </div>
          </div>
          <div class="field-row">
            <div>
              <label for="custom-food-carbs">{m().nutrition.macros.carbs} (g/100g)</label>
              <input
                id="custom-food-carbs"
                type="number"
                inputmode="decimal"
                min="0"
                step="0.1"
                bind:value={customCarbs}
              />
            </div>
            <div>
              <label for="custom-food-fat">{m().nutrition.macros.fat} (g/100g)</label>
              <input
                id="custom-food-fat"
                type="number"
                inputmode="decimal"
                min="0"
                step="0.1"
                bind:value={customFat}
              />
            </div>
          </div>

          {#if createFoodError}
            <p class="error" role="alert">{createFoodError}</p>
          {/if}
          <button type="button" class="primary" onclick={createCustomFood} disabled={creatingFood}>
            {creatingFood ? m().common.saving : m().nutrition.addMeal.createCustomFoodButton}
          </button>
        </div>
      {/if}
    {:else if tab === 'barcode'}
      {#if barcodeLoading}
        <p class="muted">{m().nutrition.addMeal.barcodeLookingUp}</p>
      {:else}
        {#if barcodeError}
          <p class="error" role="alert">{barcodeError}</p>
        {/if}
        <BarcodeScanner onDetected={handleBarcodeDetected} />
      {/if}
    {:else}
      <label for="quick-kcal">{m().nutrition.addMeal.quickKcalLabel}</label>
      <input
        id="quick-kcal"
        type="number"
        inputmode="numeric"
        min="1"
        step="1"
        bind:value={quickKcal}
      />
      {#if quickError}
        <p class="error" role="alert">{quickError}</p>
      {/if}
      <button type="button" class="primary" onclick={saveQuick} disabled={savingQuick}>
        {savingQuick ? m().common.saving : m().nutrition.addMeal.quickSaveButton}
      </button>
    {/if}
  {/if}
</div>
