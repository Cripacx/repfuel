<script lang="ts">
  import '../app.css';
  import { onMount, type Snippet } from 'svelte';
  import { browser } from '$app/environment';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { isAiEnabled } from '$lib/ai/status.svelte.js';
  import ConfirmHost from '$lib/components/ConfirmHost.svelte';
  import { getUser } from '$lib/auth.svelte.js';
  import { m } from '$lib/i18n/index.js';
  import {
    getPendingCount,
    initOfflineRuntime,
    isOnline,
    isSyncing,
    syncNow,
  } from '$lib/offline/status.svelte.js';

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    // Sync-Trigger (App-Start/`online`/Intervall) nur im Browser — SPA, kein SSR.
    const stopOfflineRuntime = initOfflineRuntime();

    if (browser) {
      // Manuelle SW-Registrierung statt Auto-Inject (siehe vite.config.ts:
      // `injectRegister: false`) — hält die Registrierung an einer Stelle, die
      // sichtbar nur im Browser-Build läuft. `registerType: 'autoUpdate'` lädt
      // neue Versionen im Hintergrund nach; `immediate` registriert sofort statt
      // erst beim `load`-Event (SvelteKit hat das DOM da schon gerendert).
      void import('virtual:pwa-register').then(({ registerSW }) => {
        registerSW({ immediate: true });
      });
    }

    return () => {
      stopOfflineRuntime();
    };
  });

  function isActiveNav(path: string): boolean {
    const current = page.url.pathname;
    return path === '/' ? current === '/' : current === path || current.startsWith(`${path}/`);
  }

</script>

<div class="app-shell">
  <header class="topbar">
    <a class="brand" href={resolve('/')}>{m().common.appName}</a>
    <div class="topbar-actions">
      {#if getUser() && (!isOnline() || getPendingCount() > 0)}
        <div class="sync-status" role="status">
          {#if !isOnline()}
            <span class="badge sync-status-offline">{m().offline.badgeOffline}</span>
          {/if}
          {#if getPendingCount() > 0}
            <button
              type="button"
              class="sync-status-pending"
              onclick={() => syncNow()}
              disabled={isSyncing() || !isOnline()}
              title={m().offline.syncNow}
            >
              {getPendingCount()}
              {getPendingCount() === 1 ? m().offline.pendingOne : m().offline.pendingOther}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </header>
  {#if getUser()}
    <nav class="main-nav" aria-label={m().nav.home}>
      <a href={resolve('/')} class:active={isActiveNav('/')}>{m().nav.home}</a>
      <a href={resolve('/workouts')} class:active={isActiveNav('/workouts') || isActiveNav('/routines') || isActiveNav('/exercises')}
        >{m().nav.workouts}</a
      >
      <a href={resolve('/nutrition')} class:active={isActiveNav('/nutrition')}
        >{m().nav.nutrition}</a
      >
      <a href={resolve('/stats')} class:active={isActiveNav('/stats')}>{m().nav.stats}</a>
      {#if isAiEnabled()}
        <a href={resolve('/chat')} class:active={isActiveNav('/chat')}>{m().nav.coach}</a>
      {/if}
      <a href={resolve('/settings')} class:active={isActiveNav('/settings') || isActiveNav('/admin')}
        >{m().nav.profile}</a
      >
    </nav>
  {/if}
  <main class="app-main">
    {@render children()}
  </main>

  <ConfirmHost />
  {#if getUser()}
    <nav class="bottom-nav" aria-label={m().nav.home}>
      <div class="bottom-nav-inner">
        <a href={resolve('/')} class:active={isActiveNav('/')}>
          <span class="bottom-nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5.5H9V20H5a1 1 0 0 1-1-1v-8.5Z" />
            </svg>
          </span>
          {m().nav.home}
        </a>
        <a
          href={resolve('/workouts')}
          class:active={isActiveNav('/workouts') || isActiveNav('/routines') || isActiveNav('/exercises')}
        >
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
        {#if isAiEnabled()}
          <a href={resolve('/chat')} class:active={isActiveNav('/chat')}>
            <span class="bottom-nav-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 12.5a7 7 0 0 1-7 7H8l-4 2.5.9-3.6A7 7 0 0 1 11 5.5h2a7 7 0 0 1 7 7Z" />
                <path d="M9.5 12h5" />
              </svg>
            </span>
            {m().nav.coach}
          </a>
        {:else}
          <a href={resolve('/stats')} class:active={isActiveNav('/stats')}>
            <span class="bottom-nav-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 20V12M10 20V6M15 20v-5M20 20V9" />
              </svg>
            </span>
            {m().nav.stats}
          </a>
        {/if}
        <a
          href={resolve('/settings')}
          class:active={isActiveNav('/settings') || isActiveNav('/admin') || (isAiEnabled() && isActiveNav('/stats'))}
        >
          <span class="bottom-nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5 20a7 7 0 0 1 14 0" />
            </svg>
          </span>
          {m().nav.profile}
        </a>
      </div>
    </nav>
  {/if}
</div>
