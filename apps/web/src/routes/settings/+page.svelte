<script lang="ts">
  import { onMount } from 'svelte';
  import type { ApiTokenDto, CreatedApiTokenDto } from '@repfuel/shared';
  import { resolve } from '$app/paths';
  import { api } from '$lib/api.js';
  import { passwordsMatch, validatePasswordPolicy } from '$lib/auth-validation.js';
  import { getUser, setUser } from '$lib/auth.svelte.js';
  import { describeError } from '$lib/errors.js';
  import { getLocale, m } from '$lib/i18n/index.js';
  import {
    dismissDeadLetters,
    getDeadLetters,
    getPendingCount,
    isOnline,
    isSyncing,
    syncNow,
  } from '$lib/offline/status.svelte.js';
  import { getAiStatus, isAiEnabled } from '$lib/ai/status.svelte.js';

  const aiStatus = $derived(getAiStatus());

  const user = $derived(getUser());

  // --- Apple Health / Datenimport: API-Tokens ---
  let tokens = $state<ApiTokenDto[]>([]);
  let tokensLoading = $state(true);
  let tokensError = $state<string | null>(null);

  let newTokenName = $state('');
  let creatingToken = $state(false);
  let createTokenError = $state<string | null>(null);
  let createdToken = $state<CreatedApiTokenDto | null>(null);
  let tokenCopied = $state(false);
  let revokingId = $state<string | null>(null);

  onMount(async () => {
    try {
      const { tokens: loaded } = await api.ingest.listTokens();
      tokens = loaded;
    } catch (err) {
      tokensError = describeError(err);
    } finally {
      tokensLoading = false;
    }
  });

  const ingestUrl = $derived(`${location.origin}/api/v1/ingest/health`);

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(getLocale() === 'de' ? 'de-DE' : 'en-US');
  }

  async function createToken(): Promise<void> {
    createTokenError = null;
    const name = newTokenName.trim();
    if (!name) {
      createTokenError = m().settings.healthImport.nameRequired;
      return;
    }
    creatingToken = true;
    try {
      const { token } = await api.ingest.createToken({ name });
      createdToken = token;
      tokenCopied = false;
      tokens = [{ id: token.id, name: token.name, createdAt: token.createdAt, lastUsedAt: token.lastUsedAt }, ...tokens];
      newTokenName = '';
    } catch (err) {
      createTokenError = describeError(err);
    } finally {
      creatingToken = false;
    }
  }

  async function copyCreatedToken(): Promise<void> {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken.token);
      tokenCopied = true;
      setTimeout(() => (tokenCopied = false), 2000);
    } catch {
      // Clipboard-API evtl. nicht verfügbar — der Token steht als Text sichtbar da.
    }
  }

  async function revokeToken(token: ApiTokenDto): Promise<void> {
    if (!confirm(m().settings.healthImport.confirmRevoke)) return;
    tokensError = null;
    revokingId = token.id;
    try {
      await api.ingest.revokeToken(token.id);
      tokens = tokens.filter((t) => t.id !== token.id);
    } catch (err) {
      tokensError = describeError(err);
    } finally {
      revokingId = null;
    }
  }

  // --- Datenexport ---
  let exporting = $state(false);
  let exportError = $state<string | null>(null);

  async function exportData(): Promise<void> {
    exportError = null;
    exporting = true;
    try {
      const { blob, filename } = await api.exportData();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      exportError = describeError(err);
    } finally {
      exporting = false;
    }
  }

  let password = $state('');
  let confirmPassword = $state('');
  let showPassword = $state(false);
  let showConfirmPassword = $state(false);
  let passwordTouched = $state(false);
  let confirmTouched = $state(false);
  let saving = $state(false);
  let saveError = $state<string | null>(null);
  let saved = $state(false);

  const passwordFieldError = $derived.by(() => {
    if (!passwordTouched) return null;
    if (password === '') return m().auth.passwordRequired;
    const policyError = validatePasswordPolicy(password);
    if (policyError === 'tooShort') return m().auth.passwordTooShort;
    if (policyError === 'tooLong') return m().auth.passwordTooLong;
    return null;
  });

  const confirmFieldError = $derived.by(() => {
    if (!confirmTouched) return null;
    if (confirmPassword === '') return m().auth.passwordRequired;
    if (!passwordsMatch(password, confirmPassword)) return m().auth.passwordMismatch;
    return null;
  });

  async function handleSubmit(): Promise<void> {
    saveError = null;
    saved = false;
    passwordTouched = true;
    confirmTouched = true;
    if (
      password === '' ||
      validatePasswordPolicy(password) !== null ||
      confirmPassword === '' ||
      !passwordsMatch(password, confirmPassword)
    ) {
      return;
    }
    saving = true;
    try {
      await api.setPassword({ password });
      const current = getUser();
      if (current) setUser({ ...current, hasPassword: true });
      password = '';
      confirmPassword = '';
      passwordTouched = false;
      confirmTouched = false;
      saved = true;
    } catch (err) {
      saveError = describeError(err);
    } finally {
      saving = false;
    }
  }
</script>

{#if user}
  <h1>{m().settings.title}</h1>

  <section class="card">
    <h2>{m().offline.title}</h2>
    <p class="muted">{isOnline() ? m().offline.hintOnline : m().offline.hintOffline}</p>
    {#if getPendingCount() > 0}
      <p>
        {getPendingCount()}
        {getPendingCount() === 1 ? m().offline.pendingOne : m().offline.pendingOther}
      </p>
    {/if}
    <button
      type="button"
      class="secondary"
      onclick={() => syncNow()}
      disabled={isSyncing() || !isOnline() || getPendingCount() === 0}
    >
      {isSyncing() ? m().offline.syncing : m().offline.syncNow}
    </button>

    {#if getDeadLetters().length > 0}
      <div class="notice">
        <h3>{m().offline.deadLettersTitle}</h3>
        <p>{m().offline.deadLettersHint}</p>
        <ul class="plain-list">
          {#each getDeadLetters() as entry (entry.key)}
            <li>{entry.entity} · {entry.error}</li>
          {/each}
        </ul>
        <button type="button" class="secondary" onclick={() => dismissDeadLetters()}>
          {m().offline.dismissDeadLetters}
        </button>
      </div>
    {/if}
  </section>

  {#if isAiEnabled() && aiStatus?.status}
    <section class="card">
      <h2>{m().settings.aiSectionTitle}</h2>
      <p>
        <span class={aiStatus.status.ok ? 'status-ok' : 'status-warn'}>
          {aiStatus.status.ok ? m().settings.aiConnected : m().settings.aiNotConnected}
        </span>
        · {aiStatus.status.provider}{aiStatus.status.model ? ` · ${aiStatus.status.model}` : ''}
      </p>
      {#if aiStatus.status.message}
        <p class="muted">{aiStatus.status.message}</p>
      {/if}
      {#if !aiStatus.status.ok && aiStatus.status.provider === 'cli'}
        <p class="muted">{m().settings.aiCliHint}</p>
      {/if}
    </section>
  {/if}

  {#if user.role === 'admin'}
    <section class="card">
      <h2>{m().admin.title}</h2>
      <p class="muted">{m().home.adminLinkHint}</p>
      <a class="secondary" href={resolve('/admin')}>{m().home.goToAdmin}</a>
    </section>
  {/if}

  <section class="card">
    <h2>{m().settings.passwordSectionTitle}</h2>
    <p class="hint">{m().settings.passkeysRecommendedHint}</p>
    <p class="muted">
      {user.hasPassword ? m().settings.passwordSetHint : m().settings.passwordNotSetHint}
    </p>

    <form
      onsubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <label for="settings-password">
        {user.hasPassword ? m().settings.newPasswordLabel : m().auth.passwordLabel}
      </label>
      <div class="password-input">
        <input
          id="settings-password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autocomplete="new-password"
          bind:value={password}
          onblur={() => (passwordTouched = true)}
          required
        />
        <button
          type="button"
          class="password-toggle"
          onclick={() => (showPassword = !showPassword)}
        >
          {showPassword ? m().auth.hidePassword : m().auth.showPassword}
        </button>
      </div>
      <p class="hint">{m().auth.passwordHint}</p>
      {#if passwordFieldError}
        <p class="error" role="alert">{passwordFieldError}</p>
      {/if}

      <label for="settings-password-confirm">{m().auth.passwordConfirmLabel}</label>
      <div class="password-input">
        <input
          id="settings-password-confirm"
          name="password-confirm"
          type={showConfirmPassword ? 'text' : 'password'}
          autocomplete="new-password"
          bind:value={confirmPassword}
          onblur={() => (confirmTouched = true)}
          required
        />
        <button
          type="button"
          class="password-toggle"
          onclick={() => (showConfirmPassword = !showConfirmPassword)}
        >
          {showConfirmPassword ? m().auth.hidePassword : m().auth.showPassword}
        </button>
      </div>
      {#if confirmFieldError}
        <p class="error" role="alert">{confirmFieldError}</p>
      {/if}

      {#if saveError}
        <p class="error" role="alert">{saveError}</p>
      {/if}
      {#if saved}
        <p class="notice">{m().settings.passwordSaved}</p>
      {/if}

      <button type="submit" class="primary" disabled={saving}>
        {saving
          ? m().common.saving
          : user.hasPassword
            ? m().settings.changePasswordButton
            : m().settings.setPasswordButton}
      </button>
    </form>
  </section>

  <section class="card">
    <h2>{m().settings.healthImport.title}</h2>
    <p class="muted">{m().settings.healthImport.intro}</p>

    {#if createdToken}
      <div class="notice created-token">
        <h3>{m().settings.healthImport.createdTitle}</h3>
        <p class="hint">{m().settings.healthImport.createdWarning}</p>
        <div class="invite-link">
          <code>{createdToken.token}</code>
          <button type="button" class="secondary" onclick={copyCreatedToken}>
            {tokenCopied ? m().common.copied : m().common.copy}
          </button>
        </div>
        <button type="button" class="link-button" onclick={() => (createdToken = null)}>
          {m().settings.healthImport.createdDismiss}
        </button>
      </div>
    {/if}

    <form
      onsubmit={(event) => {
        event.preventDefault();
        void createToken();
      }}
    >
      <label for="new-token-name">{m().settings.healthImport.nameLabel}</label>
      <input
        id="new-token-name"
        type="text"
        placeholder={m().settings.healthImport.namePlaceholder}
        bind:value={newTokenName}
      />
      {#if createTokenError}
        <p class="error" role="alert">{createTokenError}</p>
      {/if}
      <button type="submit" class="primary" disabled={creatingToken || !isOnline()}>
        {creatingToken ? m().common.saving : m().settings.healthImport.createButton}
      </button>
      {#if !isOnline()}
        <p class="hint">{m().stats.offlineBody}</p>
      {/if}
    </form>

    {#if tokensLoading}
      <p class="muted">{m().common.loading}</p>
    {:else}
      {#if tokensError}
        <p class="error" role="alert">{tokensError}</p>
      {/if}
      {#if tokens.length === 0 && !tokensError}
        <p class="empty-state">{m().settings.healthImport.noDataHint}</p>
      {:else if tokens.length > 0}
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{m().settings.healthImport.columnName}</th>
                <th>{m().settings.healthImport.columnCreated}</th>
                <th>{m().settings.healthImport.columnLastUsed}</th>
                <th>{m().common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {#each tokens as token (token.id)}
                <tr>
                  <td>{token.name}</td>
                  <td>{formatDateTime(token.createdAt)}</td>
                  <td>
                    {token.lastUsedAt
                      ? formatDateTime(token.lastUsedAt)
                      : m().settings.healthImport.neverUsed}
                  </td>
                  <td>
                    <button
                      type="button"
                      class="danger"
                      onclick={() => revokeToken(token)}
                      disabled={revokingId === token.id}
                    >
                      {m().settings.healthImport.revokeButton}
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}

    <div class="notice">
      <h3>{m().settings.healthImport.instructionsTitle}</h3>
      <p>{m().settings.healthImport.instructionsStep1}</p>
      <p>{m().settings.healthImport.instructionsStep2}</p>
      <p class="env-snippet">{ingestUrl}</p>
      <p>{m().settings.healthImport.instructionsStep3}</p>
      <p class="env-snippet">Authorization: Bearer &lt;token&gt;</p>
      <p>{m().settings.healthImport.instructionsStep4}</p>
    </div>
  </section>

  <section class="card">
    <h2>{m().settings.export.title}</h2>
    <p class="muted">{m().settings.export.intro}</p>
    {#if exportError}
      <p class="error" role="alert">{exportError}</p>
    {/if}
    <button type="button" class="secondary" onclick={exportData} disabled={exporting}>
      {exporting ? m().settings.export.exporting : m().settings.export.button}
    </button>
  </section>
{/if}
