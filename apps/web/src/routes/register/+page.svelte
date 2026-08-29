<script lang="ts">
  import { onMount } from 'svelte';
  import { startRegistration } from '@simplewebauthn/browser';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { RegistrationMode } from '@repfuel/shared';
  import { api } from '$lib/api.js';
  import { setUser } from '$lib/auth.svelte.js';
  import { passwordsMatch, validatePasswordPolicy } from '$lib/auth-validation.js';
  import InstallAppModal from '$lib/components/InstallAppModal.svelte';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';

  type Method = 'passkey' | 'password';
  let method = $state<Method>('passkey');
  let showInstallModal = $state(false);

  // Gemeinsam für beide Methoden: derselbe Benutzername/Einladungs-Token, egal ob das Konto
  // per Passkey oder per Passwort angelegt wird — Invite-Logik und Bootstrap-Hinweis gelten
  // identisch für beide.
  let username = $state('');
  let inviteToken = $state(page.url.searchParams.get('invite') ?? '');
  let loadingMode = $state(true);
  let mode = $state<RegistrationMode>('open');
  let bootstrap = $state(false);

  // --- Passkey-Flow (Default, empfohlen) ---
  let submitting = $state(false);
  let errorMessage = $state<string | null>(null);

  const inviteNeeded = $derived(mode === 'invite' && !bootstrap);

  onMount(async () => {
    try {
      const res = await api.getRegistrationMode();
      mode = res.mode;
      bootstrap = res.bootstrap;
    } catch (err) {
      errorMessage = describeError(err);
    } finally {
      loadingMode = false;
    }
  });

  async function handleRegister(): Promise<void> {
    errorMessage = null;
    if (!username.trim()) {
      errorMessage = m().auth.usernameRequiredForRegister;
      return;
    }
    submitting = true;
    try {
      const { flowId, options } = await api.getRegisterOptions({
        username: username.trim(),
        inviteToken: inviteToken.trim() || undefined,
      });
      const response = await startRegistration({ optionsJSON: options });
      const { user } = await api.postRegisterVerify({ flowId, response });
      setUser(user);
      await goto(resolve('/'));
    } catch (err) {
      errorMessage = describeError(err);
    } finally {
      submitting = false;
    }
  }

  // --- Passwort-Flow ---
  let password = $state('');
  let confirmPassword = $state('');
  let showPassword = $state(false);
  let showConfirmPassword = $state(false);
  let usernameTouched = $state(false);
  let passwordTouched = $state(false);
  let confirmTouched = $state(false);
  let pwSubmitting = $state(false);
  let pwErrorMessage = $state<string | null>(null);

  const usernameFieldError = $derived(
    usernameTouched && username.trim() === '' ? m().auth.usernameRequired : null,
  );

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

  async function handleRegisterWithPassword(): Promise<void> {
    pwErrorMessage = null;
    usernameTouched = true;
    passwordTouched = true;
    confirmTouched = true;
    if (
      username.trim() === '' ||
      password === '' ||
      validatePasswordPolicy(password) !== null ||
      confirmPassword === '' ||
      !passwordsMatch(password, confirmPassword) ||
      (inviteNeeded && inviteToken.trim() === '')
    ) {
      return;
    }
    pwSubmitting = true;
    try {
      const { user } = await api.registerWithPassword({
        username: username.trim(),
        password,
        inviteToken: inviteToken.trim() || undefined,
      });
      setUser(user);
      await goto(resolve('/'));
    } catch (err) {
      pwErrorMessage = describeError(err);
    } finally {
      pwSubmitting = false;
    }
  }
</script>

<section class="card auth-card">
  <h1>{m().auth.registerTitle}</h1>

  {#if !loadingMode}
    {#if bootstrap}
      <p class="notice">{m().auth.bootstrapNotice}</p>
    {:else if inviteNeeded}
      <p class="notice">{m().auth.inviteRequiredNotice}</p>
    {/if}
  {/if}

  <div class="method-switch" role="group" aria-label={m().auth.methodLabel}>
    <button type="button" class:active={method === 'passkey'} onclick={() => (method = 'passkey')}>
      {m().auth.methodPasskey}
    </button>
    <button
      type="button"
      class:active={method === 'password'}
      onclick={() => (method = 'password')}
    >
      {m().auth.methodPassword}
    </button>
  </div>

  {#if method === 'passkey'}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void handleRegister();
      }}
    >
      <label for="username">{m().auth.usernameLabel}</label>
      <input
        id="username"
        name="username"
        type="text"
        autocomplete="username"
        placeholder={m().auth.usernamePlaceholder}
        bind:value={username}
        required
      />

      {#if inviteNeeded}
        <label for="invite">{m().auth.inviteTokenLabel}</label>
        <input
          id="invite"
          name="invite"
          type="text"
          placeholder={m().auth.inviteTokenPlaceholder}
          bind:value={inviteToken}
          required
        />
      {/if}

      {#if errorMessage}
        <p class="error" role="alert">{errorMessage}</p>
      {/if}

      <button type="submit" class="primary" disabled={submitting || loadingMode}>
        {submitting ? m().auth.submitting : m().auth.registerWithPasskeyButton}
      </button>
    </form>
  {:else}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void handleRegisterWithPassword();
      }}
    >
      <label for="username">{m().auth.usernameLabel}</label>
      <input
        id="username"
        name="username"
        type="text"
        autocomplete="username"
        placeholder={m().auth.usernamePlaceholder}
        bind:value={username}
        onblur={() => (usernameTouched = true)}
        required
      />
      {#if usernameFieldError}
        <p class="error" role="alert">{usernameFieldError}</p>
      {/if}

      {#if inviteNeeded}
        <label for="invite">{m().auth.inviteTokenLabel}</label>
        <input
          id="invite"
          name="invite"
          type="text"
          placeholder={m().auth.inviteTokenPlaceholder}
          bind:value={inviteToken}
          required
        />
      {/if}

      <label for="password">{m().auth.passwordLabel}</label>
      <div class="password-input">
        <input
          id="password"
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

      <label for="password-confirm">{m().auth.passwordConfirmLabel}</label>
      <div class="password-input">
        <input
          id="password-confirm"
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

      {#if pwErrorMessage}
        <p class="error" role="alert">{pwErrorMessage}</p>
      {/if}

      <button type="submit" class="primary" disabled={pwSubmitting || loadingMode}>
        {pwSubmitting ? m().auth.submitting : m().auth.registerWithPasswordButton}
      </button>
    </form>
  {/if}

  <p class="switch-link">
    {m().auth.haveAccountAlready}
    <a href={resolve('/login')}>{m().auth.loginLink}</a>
  </p>

  <button type="button" class="secondary" onclick={() => (showInstallModal = true)}>
    {m().auth.installApp.linkLabel}
  </button>
</section>

{#if showInstallModal}
  <InstallAppModal onClose={() => (showInstallModal = false)} />
{/if}
