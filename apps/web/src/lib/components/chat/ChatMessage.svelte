<script lang="ts">
  import type { ChatRole, ToolCallInfo } from '@repfuel/shared';
  import { m } from '$lib/i18n/index.js';
  import ToolCallChip from './ToolCallChip.svelte';

  /**
   * Eine Nachricht im Verlauf. Nutzer rechts (Akzent, dezent), Coach links
   * (Surface). Tool-Aufrufe stehen über dem Antworttext — sie erklären, woher
   * die Zahlen kommen.
   */
  let {
    role,
    content,
    toolCalls = null,
    streaming = false,
  }: {
    role: ChatRole;
    content: string;
    toolCalls?: ToolCallInfo[] | null;
    streaming?: boolean;
  } = $props();

  const calls = $derived(toolCalls ?? []);
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
      <p class="chat-text">{content}{#if streaming}<span class="chat-caret" aria-hidden="true"
          ></span>{/if}</p>
    {:else if streaming}
      <p class="chat-thinking" role="status">
        <span class="chat-thinking-dot" aria-hidden="true"></span>
        {m().chat.conversation.thinking}
      </p>
    {/if}
  </div>
</article>
