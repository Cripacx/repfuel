<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { Locale } from '@repfuel/shared';
  import { api } from '$lib/api.js';
  import { getUser, setUser } from '$lib/auth.svelte.js';
  import { getLocale, m, setLocale } from '$lib/i18n/index.js';

  let { children }: { children: Snippet } = $props();

  let loggingOut = $state(false);

  async function handleLogout(): Promise<void> {
    loggingOut = true;
    try {
      await api.logout();
    } catch {
      // Egal ob der Server erreichbar war — lokal melden wir in jedem Fall ab.
    } finally {
      setUser(null);
      loggingOut = false;
      await goto(resolve('/login'));
    }
  }

  async function handleLocaleChange(next: Locale): Promise<void> {
    if (next === getLocale()) return;
    setLocale(next);
    const user = getUser();
    if (!user) return;
    try {
      const { user: updated } = await api.updateMe({ locale: next });
      setUser(updated);
    } catch {
      // Best effort: UI zeigt die neue Sprache bereits lokal, der Server-Sync
      // wird beim nächsten erfolgreichen Aufruf nachgeholt.
    }
  }
</script>

<div class="app-shell">
  <header class="topbar">
    <a class="brand" href={resolve('/')}>{m().common.appName}</a>
    <div class="topbar-actions">
      <div class="locale-switch" role="group" aria-label={m().language.label}>
        <button
          type="button"
          class:active={getLocale() === 'de'}
          onclick={() => handleLocaleChange('de')}
        >
          DE
        </button>
        <button
          type="button"
          class:active={getLocale() === 'en'}
          onclick={() => handleLocaleChange('en')}
        >
          EN
        </button>
      </div>
      {#if getUser()}
        <span class="username">{getUser()?.username}</span>
        <button type="button" class="logout-btn" onclick={handleLogout} disabled={loggingOut}>
          {loggingOut ? m().nav.loggingOut : m().nav.logout}
        </button>
      {/if}
    </div>
  </header>
  <main class="app-main">
    {@render children()}
  </main>
</div>
