<script lang="ts">
  import { MEMORY_CATEGORIES, type CoachMemoryDto, type MemoryCategory } from '@repfuel/shared';
  import { requestConfirm } from '$lib/confirm.svelte.js';
  import { api } from '$lib/api.js';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';

  /**
   * Das Coach-Gedächtnis hinter dem Gehirn-Button: ein Sheet, das zeigt, was
   * sich die KI gemerkt hat — thematisch gebündelte Einträge, einzeln und
   * komplett löschbar, plus manuelles Ergänzen. Lädt erst beim Öffnen.
   */
  let open = $state(false);
  let memories = $state<CoachMemoryDto[]>([]);
  let loading = $state(false);
  let loadedOnce = $state(false);
  let error = $state<string | null>(null);
  let newMemory = $state('');
  let newMemoryCategory = $state<MemoryCategory>('preference');
  let saving = $state(false);

  /** Feste Reihenfolge: Vorhaben zuerst, Fakten zuletzt; leere Gruppen entfallen. */
  const groups = $derived(
    MEMORY_CATEGORIES.map((category) => ({
      category,
      entries: memories.filter((memory) => memory.category === category),
    })).filter((group) => group.entries.length > 0),
  );

  async function load(): Promise<void> {
    loading = true;
    error = null;
    try {
      const { memories: loaded } = await api.ai.listMemories();
      memories = loaded;
      loadedOnce = true;
    } catch (err) {
      error = describeError(err);
    } finally {
      loading = false;
    }
  }

  function openSheet(): void {
    open = true;
    if (!loadedOnce) void load();
  }

  async function addMemory(): Promise<void> {
    const content = newMemory.trim();
    if (content.length < 2) return;
    saving = true;
    error = null;
    try {
      const { memory } = await api.ai.addMemory({ category: newMemoryCategory, content });
      if (!memories.some((entry) => entry.id === memory.id)) {
        memories = [...memories, memory];
      }
      newMemory = '';
    } catch (err) {
      error = describeError(err);
    } finally {
      saving = false;
    }
  }

  async function removeMemory(memory: CoachMemoryDto): Promise<void> {
    if (
      !(await requestConfirm({
        message: m().chat.memory.deleteConfirm,
        confirmLabel: m().common.delete,
      }))
    ) {
      return;
    }
    error = null;
    try {
      await api.ai.removeMemory(memory.id);
      memories = memories.filter((entry) => entry.id !== memory.id);
    } catch (err) {
      error = describeError(err);
    }
  }

  async function clearMemories(): Promise<void> {
    if (
      !(await requestConfirm({
        message: m().chat.memory.clearAllConfirm,
        confirmLabel: m().chat.memory.clearAllButton,
      }))
    ) {
      return;
    }
    error = null;
    try {
      await api.ai.clearMemories();
      memories = [];
    } catch (err) {
      error = describeError(err);
    }
  }
</script>

<button type="button" class="icon-btn" onclick={openSheet} aria-label={m().chat.memory.title}>
  <Icon name="brain" />
</button>

{#if open}
  <Modal title={m().chat.memory.title} onClose={() => (open = false)}>
    <div class="coach-memory">
      <p class="hint">{m().chat.memory.hint}</p>

      {#if loading}
        <div class="skeleton-list" aria-hidden="true">
          <div class="skeleton-row"></div>
        </div>
        <p class="visually-hidden" role="status">{m().common.loading}</p>
      {:else}
        {#if error}
          <p class="error" role="alert">{error}</p>
        {/if}
        {#if memories.length === 0}
          <p class="empty-state">{m().chat.memory.empty}</p>
        {:else}
          {#each groups as group (group.category)}
            <p class="memory-group-label">{m().chat.memory.categories[group.category]}</p>
            <ul class="history-list memory-group-list">
              {#each group.entries as memory (memory.id)}
                <li class="history-row">
                  <span class="memory-content">{memory.content}</span>
                  <button
                    type="button"
                    class="icon-btn icon-btn-danger"
                    onclick={() => removeMemory(memory)}
                    aria-label={m().common.delete}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </li>
              {/each}
            </ul>
          {/each}
        {/if}

        <div class="memory-add">
          <select aria-label={m().chat.memory.title} bind:value={newMemoryCategory}>
            {#each MEMORY_CATEGORIES as category (category)}
              <option value={category}>{m().chat.memory.categories[category]}</option>
            {/each}
          </select>
          <input
            type="text"
            placeholder={m().chat.memory.addPlaceholder}
            aria-label={m().chat.memory.addPlaceholder}
            bind:value={newMemory}
            onkeydown={(event) => {
              if (event.key === 'Enter') void addMemory();
            }}
          />
          <button
            type="button"
            class="secondary"
            onclick={addMemory}
            disabled={saving || newMemory.trim().length < 2}
          >
            {saving ? m().common.saving : m().chat.memory.addButton}
          </button>
        </div>

        {#if memories.length > 0}
          <button type="button" class="danger memory-clear-all" onclick={clearMemories}>
            {m().chat.memory.clearAllButton}
          </button>
        {/if}
      {/if}
    </div>
  </Modal>
{/if}

<style>
  .coach-memory {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .memory-clear-all {
    align-self: flex-start;
    margin-top: var(--space-3);
  }
</style>
