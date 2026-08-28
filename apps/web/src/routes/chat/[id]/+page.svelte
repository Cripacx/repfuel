<script lang="ts">
  import { tick } from 'svelte';
  import type { ChatMessageDto, ProposalDto, ToolCallInfo } from '@repfuel/shared';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { isAiEnabled } from '$lib/ai/status.svelte.js';
  import { api } from '$lib/api.js';
  import CoachMemory from '$lib/components/CoachMemory.svelte';
  import { streamChatMessage } from '$lib/chat/stream.js';
  import ChatMessage from '$lib/components/chat/ChatMessage.svelte';
  import ProposalCard from '$lib/components/chat/ProposalCard.svelte';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';
  import { isOnline } from '$lib/offline/status.svelte.js';

  /**
   * Ein Gespräch mit dem Coach. Die Antwort kommt als SSE-Stream
   * (`POST /chat/sessions/:id/messages`) — Text wächst live, Tool-Aufrufe
   * erscheinen als Chips, Schreibvorschläge als Bestätigungskarten.
   * Der Chat ist bewusst online-only (siehe PWA-Anforderungen).
   */

  const sessionId = $derived(page.params.id ?? '');
  const tzOffsetMinutes = new Date().getTimezoneOffset();
  const MAX_TEXTAREA_HEIGHT = 160;

  let messages = $state<ChatMessageDto[]>([]);
  let proposals = $state<ProposalDto[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  /** Teil-Zustand: Verlauf da, offene Vorschläge nicht ladbar. */
  let proposalsError = $state<string | null>(null);

  let draft = $state('');
  let streaming = $state(false);
  let streamText = $state('');
  let streamTools = $state<ToolCallInfo[]>([]);
  let streamError = $state<string | null>(null);
  let lastSent = $state<string | null>(null);

  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let endMarker = $state<HTMLDivElement | null>(null);

  const canSend = $derived(draft.trim().length > 0 && !streaming && isOnline() && !loadError);

  async function loadProposals(): Promise<void> {
    proposalsError = null;
    try {
      const { proposals: pending } = await api.ai.listProposals();
      // Vom Stream ergänzte Karten nicht überschreiben.
      const known = new Set(proposals.map((p) => p.id));
      proposals = [...proposals, ...pending.filter((p) => !known.has(p.id))];
    } catch (err) {
      proposalsError = describeError(err);
    }
  }

  async function load(): Promise<void> {
    loading = true;
    loadError = null;
    streamError = null;
    proposals = [];
    try {
      const { messages: loaded } = await api.chat.listMessages(sessionId);
      messages = loaded;
      await loadProposals();
      await scrollToEnd();
    } catch (err) {
      loadError = describeError(err);
    } finally {
      loading = false;
    }
  }

  // Läuft beim Mount und erneut, wenn im selben Layout auf ein anderes Gespräch
  // navigiert wird (`sessionId` ist die einzige verfolgte Abhängigkeit).
  $effect(() => {
    if (sessionId === '') return;
    if (!isAiEnabled()) {
      void goto(resolve('/chat'));
      return;
    }
    void load();
  });

  async function scrollToEnd(): Promise<void> {
    await tick();
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    endMarker?.scrollIntoView({ block: 'end', behavior: reduced ? 'auto' : 'smooth' });
  }

  function autoGrow(): void {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = `${Math.min(textareaEl.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    void submit();
  }

  function useSuggestion(text: string): void {
    draft = text;
    textareaEl?.focus();
    autoGrow();
  }

  function applyChunkToStream(toolName: string, result: unknown): void {
    // Ergebnis dem letzten offenen Aufruf desselben Tools zuordnen — gleiche
    // Regel wie im Server-Service, damit Chips nicht doppelt erscheinen.
    const next = [...streamTools];
    for (let i = next.length - 1; i >= 0; i -= 1) {
      const call = next[i];
      if (call && call.toolName === toolName && call.result === undefined) {
        next[i] = { ...call, result };
        streamTools = next;
        return;
      }
    }
    streamTools = [...next, { toolName, args: undefined, result }];
  }

  /** Übernimmt den bisher gestreamten Stand als Nachricht in den Verlauf. */
  function finalizeStream(messageId: string): void {
    if (streamText.length === 0 && streamTools.length === 0) return;
    messages = [
      ...messages,
      {
        id: messageId,
        role: 'assistant',
        content: streamText,
        toolCalls: streamTools.length > 0 ? streamTools : null,
        createdAt: new Date().toISOString(),
      },
    ];
    streamText = '';
    streamTools = [];
  }

  /**
   * Sendet `content` und verarbeitet den Stream. `keepUserMessage` = Retry auf
   * eine bereits sichtbare Nutzer-Nachricht (kein zweiter Bubble im Verlauf).
   */
  async function send(content: string, keepUserMessage = false): Promise<void> {
    if (streaming || content.trim().length === 0) return;
    const text = content.trim();

    if (!keepUserMessage) {
      messages = [
        ...messages,
        {
          id: `local-${Date.now()}`,
          role: 'user',
          content: text,
          toolCalls: null,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    lastSent = text;
    streaming = true;
    streamText = '';
    streamTools = [];
    streamError = null;
    await scrollToEnd();

    try {
      await streamChatMessage({ sessionId, content: text, tzOffsetMinutes }, (chunk) => {
        switch (chunk.type) {
          case 'text-delta':
            streamText += chunk.text;
            break;
          case 'tool-call':
            streamTools = [...streamTools, { toolName: chunk.toolName, args: chunk.args }];
            break;
          case 'tool-result':
            applyChunkToStream(chunk.toolName, chunk.result);
            break;
          case 'proposal':
            proposals = [...proposals.filter((p) => p.id !== chunk.proposal.id), chunk.proposal];
            break;
          case 'done':
            finalizeStream(chunk.messageId);
            break;
          case 'error':
            streamError = chunk.message;
            break;
        }
        void scrollToEnd();
      });
      // Abgebrochener Stream ohne `done`: Teilantwort trotzdem behalten.
      finalizeStream(`partial-${Date.now()}`);
    } catch (err) {
      streamError = describeError(err);
      finalizeStream(`partial-${Date.now()}`);
    } finally {
      streaming = false;
      await scrollToEnd();
    }
  }

  async function submit(): Promise<void> {
    if (!canSend) return;
    const text = draft;
    draft = '';
    if (textareaEl) textareaEl.style.height = 'auto';
    await send(text);
  }

  function retry(): void {
    if (lastSent) void send(lastSent, true);
  }

  function onProposalResolved(updated: ProposalDto): void {
    proposals = proposals.map((p) => (p.id === updated.id ? updated : p));
  }
</script>

<div class="chat-view">
  <div class="chat-topline">
    <a class="chat-back" href={resolve('/chat')}>
      <span aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6" /></svg>
      </span>
      {m().chat.conversation.back}
    </a>
    <CoachMemory />
  </div>

  {#if !isOnline()}
    <div class="notice chat-offline" role="status">
      <strong>{m().chat.conversation.offlineTitle}</strong>
      <span>{m().chat.conversation.offlineBody}</span>
    </div>
  {/if}

  {#if loading}
    <div class="skeleton-list" aria-hidden="true">
      <div class="skeleton-bubble assistant"></div>
      <div class="skeleton-bubble user"></div>
      <div class="skeleton-bubble assistant"></div>
    </div>
    <p class="visually-hidden" role="status">{m().common.loading}</p>
  {:else if loadError}
    <div class="card error-card" role="alert">
      <p>{m().chat.conversation.loadError}</p>
      <p class="hint">{loadError}</p>
      <button type="button" class="secondary" onclick={load}>
        {m().chat.conversation.retry}
      </button>
    </div>
  {:else}
    {#if messages.length === 0 && !streaming}
      <div class="card empty-card">
        <h2>{m().chat.conversation.emptyTitle}</h2>
        <p class="muted">{m().chat.conversation.emptyBody}</p>
        <div class="chat-suggestions">
          {#each [m().chat.conversation.suggestion1, m().chat.conversation.suggestion2, m().chat.conversation.suggestion3] as suggestion (suggestion)}
            <button type="button" class="chat-suggestion" onclick={() => useSuggestion(suggestion)}>
              {suggestion}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="chat-log">
      {#each messages as message (message.id)}
        <ChatMessage
          role={message.role}
          content={message.content}
          toolCalls={message.toolCalls}
        />
      {/each}

      {#if streaming}
        <ChatMessage
          role="assistant"
          content={streamText}
          toolCalls={streamTools}
          streaming={true}
        />
      {/if}
    </div>

    {#if streamError}
      <div class="card error-card" role="alert">
        <p>{m().chat.conversation.streamError}</p>
        <p class="hint">{streamError}</p>
        <button type="button" class="secondary" onclick={retry} disabled={streaming || !isOnline()}>
          {m().chat.conversation.retrySend}
        </button>
      </div>
    {/if}

    {#if proposalsError}
      <div class="notice proposals-partial" role="status">
        <span>{m().chat.proposals.loadError}</span>
        <button type="button" class="link-button" onclick={loadProposals}>
          {m().chat.proposals.retry}
        </button>
      </div>
    {/if}

    {#if proposals.length > 0}
      <section class="chat-proposals" aria-label={m().chat.proposals.pendingTitle}>
        <h2 class="chat-proposals-title">{m().chat.proposals.pendingTitle}</h2>
        {#each proposals as proposal (proposal.id)}
          <ProposalCard {proposal} offline={!isOnline()} onResolved={onProposalResolved} />
        {/each}
      </section>
    {/if}

    <div bind:this={endMarker}></div>
  {/if}

  <div class="chat-composer">
    <label class="visually-hidden" for="chat-input">{m().chat.conversation.inputLabel}</label>
    <div class="chat-composer-row">
      <textarea
        id="chat-input"
        bind:this={textareaEl}
        bind:value={draft}
        rows="1"
        placeholder={m().chat.conversation.inputPlaceholder}
        disabled={streaming || !isOnline() || loadError !== null}
        oninput={autoGrow}
        onkeydown={handleKeydown}
      ></textarea>
      <!-- Label bleibt stabil (kein Layout-Sprung während des Streams); den
           laufenden Zustand trägt die Hinweiszeile darunter. -->
      <button
        type="button"
        class="primary chat-send"
        onclick={submit}
        disabled={!canSend}
        aria-busy={streaming}
      >
        {m().chat.conversation.send}
      </button>
    </div>
    <p class="hint chat-composer-hint" role={streaming ? 'status' : undefined}>
      {#if !isOnline()}
        {m().chat.conversation.offlineBody}
      {:else if streaming}
        {m().chat.conversation.sending}
      {:else}
        {m().chat.conversation.inputHint}
      {/if}
    </p>
  </div>
</div>
