<script lang="ts">
  import { untrack } from 'svelte';
  import type { ExerciseDto, RoutineDto, RoutineItemInput } from '@repfuel/shared';
  import { api } from '$lib/api.js';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';
  import { WEEKDAY_KEYS } from '$lib/workout/weekday.js';
  import ExercisePicker from './ExercisePicker.svelte';
  import ExerciseThumb from './ExerciseThumb.svelte';

  interface EditableItem {
    key: string;
    exerciseId: string;
    exercise: ExerciseDto | null;
    supersetGroup: number | null;
    targetSets: number;
    targetReps: number;
    targetWeightKg: number | null;
  }

  let {
    routine,
    onSaved,
    onDeleted,
  }: {
    routine: RoutineDto | null;
    onSaved: (routine: RoutineDto) => void;
    onDeleted?: () => void;
  } = $props();

  function itemsFromRoutine(source: RoutineDto | null): EditableItem[] {
    if (!source) return [];
    return source.items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        key: item.id,
        exerciseId: item.exerciseId,
        exercise: item.exercise,
        supersetGroup: item.supersetGroup,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        targetWeightKg: item.targetWeightKg,
      }));
  }

  // Nur als Ausgangswert fürs lokale Editier-Formular gedacht (kontrollierte Kopie) —
  // spätere Prop-Änderungen (z. B. nach dem Speichern) sollen die Eingaben nicht überschreiben.
  let name = $state(untrack(() => routine?.name ?? ''));
  let weekday = $state<number | null>(untrack(() => routine?.weekday ?? null));
  let items = $state<EditableItem[]>(untrack(() => itemsFromRoutine(routine)));

  let addingExercise = $state(false);
  let saving = $state(false);
  let deleting = $state(false);
  let formError = $state<string | null>(null);

  function exerciseLabel(exercise: ExerciseDto | null, exerciseId: string): string {
    if (!exercise) return exerciseId;
    return exercise.nameDe ?? exercise.name;
  }

  function addItem(exercise: ExerciseDto): void {
    items = [
      ...items,
      {
        key: crypto.randomUUID(),
        exerciseId: exercise.id,
        exercise,
        supersetGroup: null,
        targetSets: 3,
        targetReps: 10,
        targetWeightKg: null,
      },
    ];
    addingExercise = false;
  }

  function removeItem(index: number): void {
    items = items.filter((_, i) => i !== index);
  }

  function moveItem(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    items = next;
  }

  async function handleSave(): Promise<void> {
    formError = null;
    if (!name.trim()) {
      formError = m().routines.editor.nameRequired;
      return;
    }
    saving = true;
    try {
      const itemInputs: RoutineItemInput[] = items.map((item, index) => ({
        exerciseId: item.exerciseId,
        position: index,
        supersetGroup: item.supersetGroup,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        targetWeightKg: item.targetWeightKg,
      }));
      const result = routine
        ? await api.routines.update(routine.id, {
            name: name.trim(),
            weekday,
            items: itemInputs,
          })
        : await api.routines.create({
            name: name.trim(),
            weekday,
            items: itemInputs,
          });
      onSaved(result.routine);
    } catch (err) {
      formError = describeError(err);
    } finally {
      saving = false;
    }
  }

  async function handleDelete(): Promise<void> {
    if (!routine) return;
    if (!confirm(m().routines.confirmDelete)) return;
    deleting = true;
    formError = null;
    try {
      await api.routines.remove(routine.id);
      onDeleted?.();
    } catch (err) {
      formError = describeError(err);
      deleting = false;
    }
  }
</script>

<h1>{routine ? m().routines.editor.editTitle : m().routines.editor.newTitle}</h1>

<form
  onsubmit={(event) => {
    event.preventDefault();
    void handleSave();
  }}
>
  <label for="routine-name">{m().routines.editor.nameLabel}</label>
  <input
    id="routine-name"
    type="text"
    placeholder={m().routines.editor.namePlaceholder}
    bind:value={name}
  />

  <label for="routine-weekday">{m().routines.editor.weekdayLabel}</label>
  <select
    id="routine-weekday"
    value={weekday === null ? '' : String(weekday)}
    onchange={(event) => {
      const raw = event.currentTarget.value;
      weekday = raw === '' ? null : Number(raw);
    }}
  >
    <option value="">{m().routines.editor.weekdayNone}</option>
    {#each WEEKDAY_KEYS as key, index (key)}
      <option value={String(index)}>{m().weekdays[key]}</option>
    {/each}
  </select>

  <h2>{m().routines.editor.itemsTitle}</h2>

  {#if items.length === 0}
    <p class="empty-state">{m().routines.editor.noItems}</p>
  {:else}
    {#each items as item, index (item.key)}
      <div class="item-row">
        <div class="item-row-header">
          <span class="item-row-heading">
            <ExerciseThumb
              mediaUrl={item.exercise?.mediaUrl ?? null}
              name={exerciseLabel(item.exercise, item.exerciseId)}
            />
            <span class="item-row-title">{exerciseLabel(item.exercise, item.exerciseId)}</span>
          </span>
          <div class="item-row-actions">
            <button
              type="button"
              class="icon-btn"
              onclick={() => moveItem(index, -1)}
              disabled={index === 0}
              aria-label={m().routines.editor.moveUp}
            >
              ↑
            </button>
            <button
              type="button"
              class="icon-btn"
              onclick={() => moveItem(index, 1)}
              disabled={index === items.length - 1}
              aria-label={m().routines.editor.moveDown}
            >
              ↓
            </button>
            <button
              type="button"
              class="icon-btn"
              onclick={() => removeItem(index)}
              aria-label={m().routines.editor.removeItem}
            >
              ✕
            </button>
          </div>
        </div>
        <div class="item-row-fields">
          <div>
            <label for={`target-sets-${item.key}`}>{m().routines.editor.targetSetsLabel}</label>
            <input
              id={`target-sets-${item.key}`}
              type="number"
              min="1"
              max="20"
              bind:value={item.targetSets}
            />
          </div>
          <div>
            <label for={`target-reps-${item.key}`}>{m().routines.editor.targetRepsLabel}</label>
            <input
              id={`target-reps-${item.key}`}
              type="number"
              min="1"
              max="200"
              bind:value={item.targetReps}
            />
          </div>
          <div>
            <label for={`target-weight-${item.key}`}
              >{m().routines.editor.targetWeightLabel} ({m().common.optional})</label
            >
            <input
              id={`target-weight-${item.key}`}
              type="number"
              min="0"
              step="0.5"
              value={item.targetWeightKg ?? ''}
              oninput={(event) => {
                const raw = event.currentTarget.value;
                item.targetWeightKg = raw === '' ? null : Number(raw);
              }}
            />
          </div>
          <div>
            <label for={`superset-${item.key}`}
              >{m().routines.editor.supersetLabel} ({m().common.optional})</label
            >
            <input
              id={`superset-${item.key}`}
              type="number"
              min="0"
              max="50"
              value={item.supersetGroup ?? ''}
              oninput={(event) => {
                const raw = event.currentTarget.value;
                item.supersetGroup = raw === '' ? null : Number(raw);
              }}
            />
          </div>
        </div>
      </div>
    {/each}
  {/if}

  {#if addingExercise}
    <div class="card">
      <ExercisePicker onSelect={addItem} />
    </div>
  {:else}
    <button type="button" class="secondary" onclick={() => (addingExercise = true)}>
      {m().routines.editor.addExercise}
    </button>
  {/if}

  {#if formError}
    <p class="error" role="alert">{formError}</p>
  {/if}

  <button type="submit" class="primary" disabled={saving}>
    {saving ? m().common.saving : m().routines.editor.saveButton}
  </button>

  {#if routine}
    <button type="button" class="danger" onclick={handleDelete} disabled={deleting}>
      {m().routines.editor.deleteButton}
    </button>
  {/if}
</form>
