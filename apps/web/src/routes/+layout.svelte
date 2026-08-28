<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { Locale } from '@repfuel/shared';
  import { api } from '$lib/api.js';
  import { getUser, setUser } from '$lib/auth.svelte.js';
  import { getLocale, m, setLocale } from '$lib/i18n/index.js';

  let { children }: { children: Snippet } = $props();

  let loggingOut = $state(false);

  function isActiveNav(path: string): boolean {
    const current = page.url.pathname;
    return path === '/' ? current === '/' : current === path || current.startsWith(`${path}/`);
  }

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
  {#if getUser()}
    <nav class="main-nav" aria-label={m().nav.home}>
      <a href={resolve('/')} class:active={isActiveNav('/')}>{m().nav.home}</a>
      <a href={resolve('/workouts')} class:active={isActiveNav('/workouts')}
        >{m().nav.workouts}</a
      >
      <a href={resolve('/routines')} class:active={isActiveNav('/routines')}
        >{m().nav.routines}</a
      >
      <a href={resolve('/weight')} class:active={isActiveNav('/weight')}>{m().nav.weight}</a>
      <a href={resolve('/nutrition')} class:active={isActiveNav('/nutrition')}
        >{m().nav.nutrition}</a
      >
      {#if getUser()?.role === 'admin'}
        <a href={resolve('/admin')} class:active={isActiveNav('/admin')}>{m().nav.admin}</a>
      {/if}
      <a href={resolve('/settings')} class:active={isActiveNav('/settings')}>{m().nav.settings}</a>
    </nav>
  {/if}
  <main class="app-main">
    {@render children()}
  </main>
  {#if getUser()}
    <nav class="bottom-nav" aria-label={m().nav.home}>
      <div class="bottom-nav-inner">
        <a href={resolve('/workouts')} class:active={isActiveNav('/workouts')}>
          <span class="bottom-nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6.5 8.5v7M4 9.5v5a1 1 0 0 0 1 1h1.5v-7H5a1 1 0 0 0-1 1ZM17.5 8.5v7M20 9.5v5a1 1 0 0 1-1 1h-1.5v-7H19a1 1 0 0 1 1 1ZM8.5 12h7"
              />
            </svg>
          </span>
          {m().nav.workouts}
        </a>
        <a href={resolve('/nutrition')} class:active={isActiveNav('/nutrition')}>
          <span class="bottom-nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12a8 8 0 0 0 16 0H4Z" />
              <path d="M12 3v3M9 4.5l0.8 1.8M15 4.5l-0.8 1.8" />
            </svg>
          </span>
          {m().nav.nutrition}
        </a>
        <a href={resolve('/weight')} class:active={isActiveNav('/weight')}>
          <span class="bottom-nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="5" width="16" height="14" rx="2" />
              <path d="M12 15.5v-2.5M9.5 13l2.5.5 2.5-3" />
            </svg>
          </span>
          {m().nav.weight}
        </a>
        <a href={resolve('/settings')} class:active={isActiveNav('/settings')}>
          <span class="bottom-nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 13a8 8 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a8 8 0 0 0-1.7-1L14.9 3h-3.8l-.4 2.6a8 8 0 0 0-1.7 1l-2.5-1-2 3.4L6.6 11a8 8 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a8 8 0 0 0 1.7 1l.4 2.6h3.8l.4-2.6a8 8 0 0 0 1.7-1l2.5 1 2-3.4L19.4 13Z"
              />
            </svg>
          </span>
          {m().nav.settings}
        </a>
      </div>
    </nav>
  {/if}
</div>
