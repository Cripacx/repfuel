<script lang="ts">
  import { onMount } from 'svelte';
  import type { ChatSessionDto } from '@repfuel/shared';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { getAiStatus, isAiEnabled, isAiStatusLoaded } from '$lib/ai/status.svelte.js';
  import { api } from '$lib/api.js';
  import { describeError } from '$lib/errors.js';
  import { getLocale, m } from '$lib/i18n/index.js';
  import { isOnline } from '$lib/offline/status.svelte.js';

  /**
   * Gesprächsliste des Coaches. Ist kein KI-Adapter konfiguriert
   * (`GET /ai/status` → `enabled: false`), zeigt die Route nur den Hinweis, wie
   * er eingeschaltet wird — Chat-Nav und alle KI-Elemente bleiben ausgeblendet.
   */

  let sessions = $state<ChatSessionDto[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let creating = $state(false);
  let actionError = $state<string | null>(null);

  const aiStatus = $derived(getAiStatus()?.status ?? null);

  async function load(): Promise<void> {
    loading = true;
    loadError = null;
    try {
      const { sessions: loaded } = await api.chat.listSessions();
      sessions = loaded;
    } catch (err) {
      loadError = describeError(err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (isAiEnabled()) void load();
    else loading = false;
  });

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(getLocale() === 'de' ? 'de-DE' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  async function createSession(): Promise<void> {
    creating = true;
    actionError = null;
    try {
      const { session } = await api.chat.createSession();
      await goto(resolve('/chat/[id]', { id: session.id }));
    } catch (err) {
      actionError = `${m().chat.sessions.createError} ${describeError(err)}`;
      creating = false;
    }
  }

  async function removeSession(session: ChatSessionDto): Promise<void> {
    if (!confirm(m().chat.sessions.deleteConfirm)) return;
    actionError = null;
    try {
      await api.chat.deleteSession(session.id);
      sessions = sessions.filter((s) => s.id !== session.id);
    } catch (err) {
      actionError = `${m().chat.sessions.deleteError} ${describeError(err)}`;
    }
  }
</script>

{#if !isAiStatusLoaded()}
  <div class="page-header"><h1>{m().chat.title}</h1></div>
  <div class="skeleton-list" aria-hidden="true">
    <div class="skeleton-row"></div>
    <div class="skeleton-row"></div>
  </div>
  <p class="visually-hidden" role="status">{m().common.loading}</p>
{:else if !isAiEnabled()}
  <div class="page-header"><h1>{m().chat.title}</h1></div>
  <div class="card ai-off">
    <h2>{m().chat.disabled.title}</h2>
    <p class="muted">{m().chat.disabled.body}</p>
    <p>{m().chat.disabled.howTo}</p>
    <pre class="env-snippet"><code
        >AI_PROVIDER=anthropic|openai|openrouter|ollama
AI_API_KEY=…
AI_MODEL=…</code
      ></pre>
    <p class="hint">{m().chat.disabled.docsHint}</p>
    {#if aiStatus}
      <dl class="ai-status">
        <dt>{m().chat.disabled.statusProvider}</dt>
        <dd class="ai-status-value">{aiStatus.provider}</dd>
        {#if aiStatus.model}
          <dt>{m().chat.disabled.statusModel}</dt>
          <dd class="ai-status-value">{aiStatus.model}</dd>
        {/if}
      </dl>
      {#if aiStatus.message}
        <p class="hint">{aiStatus.message}</p>
      {/if}
    {/if}
    <a class="secondary" href={resolve('/')}>{m().chat.disabled.backHome}</a>
  </div>
{:else}
  <div class="page-header">
    <h1>{m().chat.title}</h1>
    <!-- Genau eine Primäraktion pro View: im Leerzustand trägt sie die Empty-Karte. -->
    {#if sessions.length > 0}
      <button
        type="button"
        class="primary"
        onclick={createSession}
        disabled={creating || !isOnline()}
      >
        {creating ? m().chat.sessions.creating : m().chat.sessions.newButton}
      </button>
    {/if}
  </div>

  {#if !isOnline()}
    <p class="notice" role="status">{m().chat.sessions.offlineHint}</p>
  {/if}

  {#if actionError}
    <p class="error" role="alert">{actionError}</p>
  {/if}

  {#if loading}
    <div class="skeleton-list" aria-hidden="true">
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
    </div>
    <p class="visually-hidden" role="status">{m().common.loading}</p>
  {:else if loadError}
    <div class="card error-card" role="alert">
      <p>{m().chat.sessions.loadError}</p>
      <p class="hint">{loadError}</p>
      <button type="button" class="secondary" onclick={load}>{m().chat.sessions.retry}</button>
    </div>
  {:else if sessions.length === 0}
    <div class="card empty-card">
      <h2>{m().chat.sessions.emptyTitle}</h2>
      <p class="muted">{m().chat.sessions.emptyBody}</p>
      <button
        type="button"
        class="primary"
        onclick={createSession}
        disabled={creating || !isOnline()}
      >
        {creating ? m().chat.sessions.creating : m().chat.sessions.newButton}
      </button>
    </div>
  {:else}
    {#each sessions as session (session.id)}
      <div class="list-card">
        <a class="list-card-main" href={resolve('/chat/[id]', { id: session.id })}>
          <span class="list-card-title">{session.title ?? m().chat.sessions.untitled}</span>
          <span class="list-card-meta">
            <span>{formatDate(session.createdAt)}</span>
          </span>
        </a>
        <div class="list-card-actions">
          <button
            type="button"
            class="danger"
            aria-label={m().chat.sessions.deleteLabel}
            onclick={() => removeSession(session)}
          >
            {m().common.delete}
          </button>
        </div>
      </div>
    {/each}
  {/if}
{/if}
