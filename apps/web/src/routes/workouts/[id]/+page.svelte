<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { ExerciseDto, LastSetsResponse, RoutineDto, SetDto, WorkoutDto } from '@repfuel/shared';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { requestConfirm } from '$lib/confirm.svelte.js';
  import { api } from '$lib/api.js';
  import ExercisePicker from '$lib/components/ExercisePicker.svelte';
  import ExerciseAnimation from '$lib/components/ExerciseAnimation.svelte';
  import ExerciseThumb from '$lib/components/ExerciseThumb.svelte';
  import NumberStepper from '$lib/components/NumberStepper.svelte';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';
  import {
    getWorkoutLocal,
    hydrateWorkouts,
    removeSet as repoRemoveSet,
    upsertSet as repoUpsertSet,
    upsertWorkout as repoUpsertWorkout,
  } from '$lib/offline/repo.js';
  import { computeDraftRowCount, derivePrefill } from '$lib/workout/prefill.js';
  import { suggestOverload, summarizeLastSets } from '$lib/workout/progression.js';
  import { DUR_EXIT, DUR_STATE, arrive, riseFromBottom } from '$lib/motion.js';
  import {
    DEFAULT_REST_SECONDS,
    REST_TIMER_OPTIONS_SECONDS,
    formatCountdown,
    remainingSeconds,
  } from '$lib/workout/timer.js';
  import { computeDurationMinutes, computeVolumeKg, nextSetPosition } from '$lib/workout/volume.js';

  interface DraftRowState {
    weightKg: number;
    reps: number;
    isWarmup: boolean;
    rpe: number | null;
  }

  interface SectionState {
    exerciseId: string;
    exerciseName: string;
    exerciseMediaUrl: string | null;
    exerciseGifUrl: string | null;
    targetSets: number | null;
    targetReps: number | null;
    targetWeightKg: number | null;
    loggedSets: SetDto[];
    draftCount: number;
  }

  const workoutId = $derived(page.params.id ?? '');

  let workout = $state<WorkoutDto | null>(null);
  /**
   * Erst nach dem ersten Laden dürfen Sätze animiert eintreffen. Sonst würde
   * beim Öffnen eines Workouts die gesamte bestehende Liste einfliegen —
   * Choreografie beim Seitenaufbau, die nur Zeit kostet und nichts erklärt.
   */
  let listReady = $state(false);
  let routine = $state<RoutineDto | null>(null);
  let lastSets = $state<LastSetsResponse>({});
  let exerciseCache = $state<Record<string, ExerciseDto>>({});
  let manuallyAdded = $state<ExerciseDto[]>([]);

  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let logError = $state<string | null>(null);
  let addingExercise = $state(false);
  let notes = $state('');

  let draftInputs = $state<Record<string, DraftRowState>>({});
  let editingSetId = $state<string | null>(null);
  let editDraft = $state<DraftRowState | null>(null);

  let restDuration = $state<number>(DEFAULT_REST_SECONDS);
  let restActive = $state(false);
  let restStartedAt = $state(0);
  let restRemaining = $state(0);
  let restIntervalId: ReturnType<typeof setInterval> | undefined;

  const isFinished = $derived(workout ? workout.finishedAt !== null : false);

  function exerciseLabel(exercise: ExerciseDto): string {
    return exercise.nameDe ?? exercise.name;
  }

  function draftKey(exerciseId: string, index: number): string {
    return `${exerciseId}#${index}`;
  }

  const sections = $derived.by<SectionState[]>(() => {
    if (!workout) return [];
    const list: SectionState[] = [];

    function ensure(
      exerciseId: string,
      targets: { targetSets: number | null; targetReps: number | null; targetWeightKg: number | null } = {
        targetSets: null,
        targetReps: null,
        targetWeightKg: null,
      },
    ): void {
      if (list.some((s) => s.exerciseId === exerciseId)) return;
      const cached = exerciseCache[exerciseId];
      list.push({
        exerciseId,
        exerciseName: cached ? exerciseLabel(cached) : exerciseId,
        exerciseMediaUrl: cached?.mediaUrl ?? null,
        exerciseGifUrl: cached?.gifUrl ?? null,
        targetSets: targets.targetSets,
        targetReps: targets.targetReps,
        targetWeightKg: targets.targetWeightKg,
        loggedSets: [],
        draftCount: 0,
      });
    }

    if (routine) {
      for (const item of routine.items.slice().sort((a, b) => a.position - b.position)) {
        ensure(item.exerciseId, {
          targetSets: item.targetSets,
          targetReps: item.targetReps,
          targetWeightKg: item.targetWeightKg,
        });
      }
    }
    for (const exercise of manuallyAdded) {
      ensure(exercise.id);
    }
    for (const set of workout.sets) {
      ensure(set.exerciseId);
    }

    for (const section of list) {
      section.loggedSets = workout.sets
        .filter((s) => s.exerciseId === section.exerciseId)
        .sort((a, b) => a.position - b.position);
      section.draftCount = computeDraftRowCount(section.loggedSets.length, section.targetSets);
    }

    return list;
  });

  // Legt fehlende Entwurfszeilen an (Vorbelegung aus lastSets/Zielwerten), ohne bereits
  // vom Nutzer bearbeitete Werte zu überschreiben.
  $effect(() => {
    for (const section of sections) {
      const history = lastSets[section.exerciseId]?.sets ?? [];
      for (let i = 0; i < section.draftCount; i++) {
        const rowIndex = section.loggedSets.length + i;
        const key = draftKey(section.exerciseId, rowIndex);
        if (!(key in draftInputs)) {
          const fallback = {
            weightKg: section.targetWeightKg ?? 0,
            reps: section.targetReps ?? 8,
          };
          const prefill = derivePrefill(history, rowIndex, fallback);
          draftInputs[key] = {
            weightKg: prefill.weightKg,
            reps: prefill.reps,
            isWarmup: false,
            rpe: null,
          };
        }
      }
    }
  });

  async function resolveMissingExerciseNames(ids: string[]): Promise<void> {
    let remaining = ids.filter((id) => !(id in exerciseCache));
    if (remaining.length === 0) return;
    const found: Record<string, ExerciseDto> = {};
    let offset = 0;
    const limit = 500;
    while (remaining.length > 0) {
      const { exercises } = await api.exercises.list({ limit, offset });
      if (exercises.length === 0) break;
      for (const exercise of exercises) {
        if (remaining.includes(exercise.id)) {
          found[exercise.id] = exercise;
        }
      }
      remaining = remaining.filter((id) => !(id in found));
      if (exercises.length < limit) break;
      offset += limit;
    }
    exerciseCache = { ...exerciseCache, ...found };
  }

  onMount(async () => {
    try {
      // Netzwerk zuerst versuchen (hydratisiert Dexie mit dem Server-Stand), aber immer
      // aus Dexie rendern — so bleiben lokal noch nicht synchronisierte Sätze sichtbar,
      // auch wenn der GET erfolgreich war, aber der Sync-Batch noch aussteht.
      let remote: WorkoutDto | null = null;
      let networkError = false;
      try {
        const res = await api.workouts.get(workoutId);
        remote = res.workout;
      } catch (err) {
        if (err instanceof TypeError) {
          networkError = true;
        } else {
          throw err;
        }
      }
      if (remote) await hydrateWorkouts([remote]);
      workout = (await getWorkoutLocal(workoutId)) ?? remote;

      if (!workout) {
        loadError = networkError ? describeError(new TypeError('offline')) : m().errors.notFound;
        return;
      }
      notes = workout.notes ?? '';

      const allExerciseIds = workout.sets.map((s) => s.exerciseId);

      // Routinen sind kein Offline-Datentyp (M4-Scope: nur workouts/sets/meals/
      // body_weight) — ohne sie fehlen offline nur die Zielwerte je Übung.
      if (workout.routineId) {
        try {
          const { routine: loadedRoutine } = await api.routines.get(workout.routineId);
          routine = loadedRoutine;
          const updates: Record<string, ExerciseDto> = {};
          for (const item of loadedRoutine.items) {
            allExerciseIds.push(item.exerciseId);
            if (item.exercise) updates[item.exerciseId] = item.exercise;
          }
          exerciseCache = { ...exerciseCache, ...updates };
        } catch {
          // best effort — Logging funktioniert auch ohne Routinen-Zielwerte.
        }
      }

      const uniqueExerciseIds = allExerciseIds.filter((id, i) => allExerciseIds.indexOf(id) === i);
      try {
        await resolveMissingExerciseNames(uniqueExerciseIds);
        if (uniqueExerciseIds.length > 0) {
          const { lastSets: loadedLastSets } = await api.workouts.lastSets(uniqueExerciseIds);
          lastSets = loadedLastSets;
        }
      } catch {
        // Übungsnamen/Prefill sind best effort — offline bleiben Fallback-Werte.
      }
    } catch (err) {
      loadError = describeError(err);
    } finally {
      loading = false;
      listReady = true;
    }
  });

  onDestroy(() => clearRestInterval());

  function clearRestInterval(): void {
    if (restIntervalId !== undefined) {
      clearInterval(restIntervalId);
      restIntervalId = undefined;
    }
  }

  function playRestEndSignal(): void {
    try {
      if (navigator.vibrate) navigator.vibrate(300);
    } catch {
      // Vibration-API evtl. nicht verfügbar — kein Problem, der Timer bleibt sichtbar.
    }
    try {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.15;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
      oscillator.onended = () => void ctx.close();
    } catch {
      // Web Audio evtl. nicht verfügbar/erlaubt.
    }
  }

  function finishRestTimer(): void {
    clearRestInterval();
    restActive = false;
  }

  function startRestTimer(): void {
    restActive = true;
    restStartedAt = Date.now();
    restRemaining = restDuration;
    clearRestInterval();
    restIntervalId = setInterval(() => {
      restRemaining = remainingSeconds(restDuration, Date.now() - restStartedAt);
      if (restRemaining <= 0) {
        finishRestTimer();
        playRestEndSignal();
      }
    }, 250);
  }

  function changeRestDuration(seconds: number): void {
    restDuration = seconds;
    if (restActive) {
      restStartedAt = Date.now();
      restRemaining = seconds;
    }
  }

  /**
   * Verlängert die laufende Pause, ohne sie neu zu starten: Ziel und Gesamtdauer
   * wachsen um denselben Betrag, damit der Fortschrittsbalken nicht zurückspringt.
   */
  function extendRestTimer(seconds: number): void {
    if (!restActive) return;
    restDuration += seconds;
    restRemaining = remainingSeconds(restDuration, Date.now() - restStartedAt);
  }

  function skipRestTimer(): void {
    finishRestTimer();
  }

  async function addManualExercise(exercise: ExerciseDto): Promise<void> {
    exerciseCache = { ...exerciseCache, [exercise.id]: exercise };
    if (!manuallyAdded.some((e) => e.id === exercise.id)) {
      manuallyAdded = [...manuallyAdded, exercise];
    }
    addingExercise = false;
    if (!(exercise.id in lastSets)) {
      try {
        const { lastSets: fetched } = await api.workouts.lastSets([exercise.id]);
        lastSets = { ...lastSets, ...fetched };
      } catch {
        // Prefill ist best effort — Logging funktioniert auch ohne Historie.
      }
    }
  }

  async function logSet(exerciseId: string, key: string): Promise<void> {
    if (!workout) return;
    const draft = draftInputs[key];
    if (!draft) return;
    logError = null;
    const setId = crypto.randomUUID();
    const position = nextSetPosition(workout.sets);
    try {
      const set = await repoUpsertSet(workout.id, setId, {
        exerciseId,
        position,
        reps: draft.reps,
        weightKg: draft.weightKg,
        isWarmup: draft.isWarmup,
        rpe: draft.rpe,
      });
      workout = { ...workout, sets: [...workout.sets, set] };
      delete draftInputs[key];
      startRestTimer();
    } catch (err) {
      logError = describeError(err);
    }
  }

  function startEditSet(set: SetDto): void {
    editingSetId = set.id;
    editDraft = { weightKg: set.weightKg, reps: set.reps, isWarmup: set.isWarmup, rpe: set.rpe };
  }

  function cancelEditSet(): void {
    editingSetId = null;
    editDraft = null;
  }

  async function saveEditSet(set: SetDto): Promise<void> {
    if (!workout || !editDraft) return;
    logError = null;
    try {
      const updated = await repoUpsertSet(workout.id, set.id, {
        exerciseId: set.exerciseId,
        position: set.position,
        reps: editDraft.reps,
        weightKg: editDraft.weightKg,
        isWarmup: editDraft.isWarmup,
        rpe: editDraft.rpe,
      });
      workout = { ...workout, sets: workout.sets.map((s) => (s.id === updated.id ? updated : s)) };
      cancelEditSet();
    } catch (err) {
      logError = describeError(err);
    }
  }

  async function deleteSet(set: SetDto): Promise<void> {
    if (!workout) return;
    if (!(await requestConfirm({ message: m().workouts.session.deleteSetConfirm }))) return;
    logError = null;
    try {
      await repoRemoveSet(workout.id, set.id);
      workout = { ...workout, sets: workout.sets.filter((s) => s.id !== set.id) };
    } catch (err) {
      logError = describeError(err);
    }
  }

  async function saveNotes(): Promise<void> {
    if (!workout) return;
    try {
      const updated = await repoUpsertWorkout(workout.id, {
        startedAt: workout.startedAt,
        finishedAt: workout.finishedAt,
        routineId: workout.routineId,
        notes: notes.trim() || null,
      });
      workout = { ...workout, notes: updated.notes };
    } catch (err) {
      logError = describeError(err);
    }
  }

  async function finishWorkout(): Promise<void> {
    if (!workout) return;
    if (!(await requestConfirm({ message: m().workouts.session.finishConfirm }))) return;
    logError = null;
    try {
      const updated = await repoUpsertWorkout(workout.id, {
        startedAt: workout.startedAt,
        finishedAt: new Date().toISOString(),
        routineId: workout.routineId,
        notes: workout.notes,
      });
      workout = updated;
      finishRestTimer();
    } catch (err) {
      logError = describeError(err);
    }
  }
</script>

{#if loading}
  <p class="muted">{m().common.loading}</p>
{:else if loadError}
  <p class="error" role="alert">{loadError}</p>
{:else if workout}
  {#if isFinished}
    <section class="card">
      <h2>{m().workouts.session.summaryTitle}</h2>
      <dl class="summary-grid">
        <div>
          <dt>{m().workouts.session.summaryDuration}</dt>
          <dd>
            {computeDurationMinutes(workout.startedAt, workout.finishedAt)}
            {m().workouts.minutesShort}
          </dd>
        </div>
        <div>
          <dt>{m().workouts.session.summarySets}</dt>
          <dd>{workout.sets.length}</dd>
        </div>
        <div>
          <dt>{m().workouts.session.summaryVolume}</dt>
          <dd>{computeVolumeKg(workout.sets)} {m().common.kg}</dd>
        </div>
      </dl>
      <a class="secondary" href={resolve('/workouts')}>{m().workouts.session.backToWorkouts}</a>
    </section>

    {#each sections as section (section.exerciseId)}
      {#if section.loggedSets.length > 0}
        <div class="item-row">
          <div class="item-row-header">
            <span class="item-row-heading">
              <ExerciseThumb mediaUrl={section.exerciseMediaUrl} name={section.exerciseName} />
              <span class="item-row-title">{section.exerciseName}</span>
            </span>
          </div>
          <ul class="plain-list">
            {#each section.loggedSets as set (set.id)}
              <li>
                {set.reps} × {set.weightKg} {m().common.kg}
                {#if set.isWarmup}<span class="muted">({m().workouts.session.warmupLabel})</span
                  >{/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    {/each}

    {#if workout.notes}
      <section class="card">
        <h2>{m().workouts.session.notesLabel}</h2>
        <p>{workout.notes}</p>
      </section>
    {/if}
  {:else}
    {#if sections.length === 0}
      <p class="empty-state">{m().workouts.session.noExercisesYet}</p>
    {/if}

    {#each sections as section (section.exerciseId)}
      <section class="exercise-section card">
        <div class="exercise-section-title">
          <span class="exercise-section-heading">
            <ExerciseThumb mediaUrl={section.exerciseMediaUrl} name={section.exerciseName} />
            <h2>{section.exerciseName}</h2>
          </span>
          {#if section.targetSets}
            <span class="muted">
              {section.targetSets} × {section.targetReps}{section.targetWeightKg
                ? ` · ${section.targetWeightKg} ${m().common.kg}`
                : ''}
            </span>
          {/if}
        </div>

        <ExerciseAnimation
          mediaUrl={section.exerciseMediaUrl}
          gifUrl={section.exerciseGifUrl}
        />

        {#if summarizeLastSets(lastSets[section.exerciseId])}
          <p class="last-time">
            <span class="last-time-label">{m().workouts.session.lastTimeLabel}</span>
            {summarizeLastSets(lastSets[section.exerciseId])}
          </p>
        {/if}

        {#if suggestOverload(lastSets[section.exerciseId], section.targetReps)}
          {@const suggestion = suggestOverload(lastSets[section.exerciseId], section.targetReps)}
          <p class="overload-hint">
            {m().workouts.session.overloadHint}
            <strong>{suggestion?.weightKg} {m().common.kg}</strong>
          </p>
        {/if}

        {#each section.loggedSets as set, i (set.id)}
          <div class="set-row logged" in:arrive={{ duration: listReady ? DUR_STATE : 0 }}>
            <span class="set-row-label">{i + 1}</span>
            {#if editingSetId === set.id && editDraft}
              <div class="set-row-field">
                <label for={`edit-weight-${set.id}`}>{m().workouts.session.weightLabel}</label>
                <NumberStepper
                  id={`edit-weight-${set.id}`}
                  label={m().workouts.session.weightLabel}
                  step={2.5}
                  bind:value={editDraft.weightKg}
                />
              </div>
              <div class="set-row-field">
                <label for={`edit-reps-${set.id}`}>{m().workouts.session.repsLabel}</label>
                <NumberStepper
                  id={`edit-reps-${set.id}`}
                  label={m().workouts.session.repsLabel}
                  step={1}
                  bind:value={editDraft.reps}
                />
              </div>
              <div class="item-row-actions">
                <button type="button" class="secondary" onclick={() => saveEditSet(set)}>
                  {m().workouts.session.updateSetButton}
                </button>
                <button type="button" class="secondary" onclick={cancelEditSet}>
                  {m().common.cancel}
                </button>
              </div>
              <div class="set-row-toggles">
                <label>
                  <input type="checkbox" bind:checked={editDraft.isWarmup} />
                  {m().workouts.session.warmupLabel}
                </label>
              </div>
            {:else}
              <div class="set-row-field">
                <span>{set.weightKg} {m().common.kg}</span>
              </div>
              <div class="set-row-field">
                <span>{set.reps} {m().workouts.session.repsLabel}</span>
              </div>
              <div class="item-row-actions">
                <button
                  type="button"
                  class="icon-btn"
                  onclick={() => startEditSet(set)}
                  aria-label={m().common.edit}
                >
                  ✎
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  onclick={() => deleteSet(set)}
                  aria-label={m().common.delete}
                >
                  ✕
                </button>
              </div>
              {#if set.isWarmup}
                <span class="set-row-toggles">{m().workouts.session.warmupLabel}</span>
              {/if}
            {/if}
          </div>
        {/each}

        {#each Array.from({ length: section.draftCount }) as _unused, di (di)}
          {@const rowIndex = section.loggedSets.length + di}
          {@const key = draftKey(section.exerciseId, rowIndex)}
          {@const draft = draftInputs[key]}
          {#if draft}
            <div class="set-row">
              <span class="set-row-label">{rowIndex + 1}</span>
              <div class="set-row-field">
                <label for={`weight-${key}`}>{m().workouts.session.weightLabel}</label>
                <NumberStepper
                  id={`weight-${key}`}
                  label={m().workouts.session.weightLabel}
                  step={2.5}
                  bind:value={draft.weightKg}
                />
              </div>
              <div class="set-row-field">
                <label for={`reps-${key}`}>{m().workouts.session.repsLabel}</label>
                <NumberStepper
                  id={`reps-${key}`}
                  label={m().workouts.session.repsLabel}
                  step={1}
                  bind:value={draft.reps}
                />
              </div>
              <button type="button" class="primary" onclick={() => logSet(section.exerciseId, key)}>
                {m().workouts.session.logSetButton}
              </button>
              <div class="set-row-toggles">
                <label>
                  <input type="checkbox" bind:checked={draft.isWarmup} />
                  {m().workouts.session.warmupLabel}
                </label>
                <label for={`rpe-${key}`}>
                  {m().workouts.session.rpeLabel}
                  <input
                    id={`rpe-${key}`}
                    type="number"
                    min="1"
                    max="10"
                    step="0.5"
                    value={draft.rpe ?? ''}
                    oninput={(event) => {
                      const raw = event.currentTarget.value;
                      draft.rpe = raw === '' ? null : Number(raw);
                    }}
                  />
                </label>
              </div>
            </div>
          {/if}
        {/each}
      </section>
    {/each}

    {#if addingExercise}
      <div class="card">
        <ExercisePicker onSelect={addManualExercise} />
      </div>
    {:else}
      <button type="button" class="secondary" onclick={() => (addingExercise = true)}>
        {m().workouts.session.addExercise}
      </button>
    {/if}

    {#if restActive}
      <div
        class="rest-timer"
        in:riseFromBottom={{ duration: DUR_STATE }}
        out:riseFromBottom={{ duration: DUR_EXIT }}
      >
        <span class="rest-timer-time">{formatCountdown(restRemaining)}</span>
        <span class="rest-timer-track" aria-hidden="true">
          <span
            class="rest-timer-fill"
            style={`transform: scaleX(${restDuration > 0 ? restRemaining / restDuration : 0});`}
          ></span>
        </span>
        <button type="button" class="rest-timer-extend" onclick={() => extendRestTimer(15)}>
          {m().workouts.session.restAdd}
        </button>
        <div class="rest-timer-options">
          {#each REST_TIMER_OPTIONS_SECONDS as seconds (seconds)}
            <button
              type="button"
              class:active={restDuration === seconds}
              onclick={() => changeRestDuration(seconds)}
            >
              {seconds}s
            </button>
          {/each}
        </div>
        <button type="button" class="rest-timer-skip" onclick={skipRestTimer}>
          {m().workouts.session.restTimerSkip}
        </button>
      </div>
    {/if}

    <section class="card">
      <label for="workout-notes">{m().workouts.session.notesLabel}</label>
      <textarea
        id="workout-notes"
        placeholder={m().workouts.session.notesPlaceholder}
        bind:value={notes}
        onblur={saveNotes}
      ></textarea>
    </section>

    {#if logError}
      <p class="error" role="alert">{logError}</p>
    {/if}

    <button type="button" class="secondary" onclick={finishWorkout}>
      {m().workouts.session.finishButton}
    </button>
  {/if}
{/if}
