<script lang="ts">
  import type { ChatRole, ToolCallInfo } from '@repfuel/shared';
  import { suggestActionsInputSchema, type ChatAction } from '@repfuel/shared';
  import { renderMarkdown } from '$lib/chat/markdown.js';
  import { m } from '$lib/i18n/index.js';
  import ToolCallChip from './ToolCallChip.svelte';

  /**
   * Eine Nachricht im Verlauf. Nutzer rechts (Akzent, dezent), Coach links
   * (Surface). Tool-Aufrufe stehen über dem Antworttext — sie erklären, woher
   * die Zahlen kommen. Coach-Antworten werden als Markdown gerendert (der
   * Renderer escaped alles, siehe $lib/chat/markdown.ts).
   *
   * `suggest_actions`-Aufrufe erscheinen nicht als Chip, sondern als
   * Schnellantwort-Buttons unter der Antwort — nur auf der letzten Nachricht
   * (`actionsEnabled`), ein Klick sendet den hinterlegten Prompt.
   */
  let {
    role,
    content,
    toolCalls = null,
    streaming = false,
    actionsEnabled = false,
    onAction,
  }: {
    role: ChatRole;
    content: string;
    toolCalls?: ToolCallInfo[] | null;
    streaming?: boolean;
    actionsEnabled?: boolean;
    onAction?: (prompt: string) => void;
  } = $props();

  const calls = $derived((toolCalls ?? []).filter((call) => call.toolName !== 'suggest_actions'));

  /** Letzter valider suggest_actions-Aufruf; kaputte Args fallen still weg. */
  const actions = $derived.by((): ChatAction[] => {
    const raw = (toolCalls ?? []).filter((call) => call.toolName === 'suggest_actions').at(-1);
    if (!raw) return [];
    const parsed = suggestActionsInputSchema.safeParse(raw.args);
    return parsed.success ? parsed.data.actions : [];
  });

  const rendered = $derived(role === 'assistant' ? renderMarkdown(content) : '');
</script>

<article class="chat-msg" class:user={role === 'user'} class:assistant={role === 'assistant'}>
  <span class="chat-msg-role">
    {role === 'user' ? m().chat.conversation.roleUser : m().chat.conversation.roleAssistant}
  </span>
  <div class="chat-bubble">
    {#if calls.length > 0}
      <div class="chat-tools" aria-label={m().chat.tools.label}>
        {#each calls as call, index (`${call.toolName}-${index}`)}
          <ToolCallChip
            toolName={call.toolName}
            args={call.args}
            result={call.result}
            status={call.result === undefined ? 'running' : 'done'}
          />
        {/each}
      </div>
    {/if}

    {#if content}
      {#if role === 'assistant'}
        <div class="chat-text chat-markdown">
          <!-- eslint-disable-next-line svelte/no-at-html-tags — renderMarkdown escaped die komplette Eingabe. -->
          {@html rendered}{#if streaming}<span class="chat-caret" aria-hidden="true"></span>{/if}
        </div>
      {:else}
        <p class="chat-text">{content}</p>
      {/if}
    {:else if streaming}
      <p class="chat-thinking" role="status">
        <span class="chat-thinking-dot" aria-hidden="true"></span>
        {m().chat.conversation.thinking}
      </p>
    {/if}
  </div>

  {#if actionsEnabled && !streaming && actions.length > 0 && onAction}
    <div class="chat-actions" aria-label={m().chat.conversation.actionsLabel}>
      {#each actions as action (action.label + action.prompt)}
        <button type="button" class="chat-action" onclick={() => onAction?.(action.prompt)}>
          {action.label}
        </button>
      {/each}
    </div>
  {/if}
</article>
