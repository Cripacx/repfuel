<script lang="ts">
  import { startAuthentication } from '@simplewebauthn/browser';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { api } from '$lib/api.js';
  import { setUser } from '$lib/auth.svelte.js';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';

  type Method = 'passkey' | 'password';
  let method = $state<Method>('passkey');

  // Gemeinsam für beide Methoden: derselbe Benutzername, egal ob per Passkey (optional) oder
  // per Passwort (Pflichtfeld) angemeldet wird.
  let username = $state('');

  // --- Passkey-Flow (Default, empfohlen) ---
  let submitting = $state(false);
  let errorMessage = $state<string | null>(null);

  async function handleLogin(): Promise<void> {
    errorMessage = null;
    submitting = true;
    try {
      const { flowId, options } = await api.getLoginOptions({
        username: username.trim() || undefined,
      });
      const response = await startAuthentication({ optionsJSON: options });
      const { user } = await api.postLoginVerify({ flowId, response });
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
  let showPassword = $state(false);
  let usernameTouched = $state(false);
  let passwordTouched = $state(false);
  let pwSubmitting = $state(false);
  let pwErrorMessage = $state<string | null>(null);

  const usernameFieldError = $derived(
    usernameTouched && username.trim() === '' ? m().auth.usernameRequired : null,
  );
  const passwordFieldError = $derived(
    passwordTouched && password === '' ? m().auth.passwordRequired : null,
  );

  async function handlePasswordLogin(): Promise<void> {
    pwErrorMessage = null;
    usernameTouched = true;
    passwordTouched = true;
    if (username.trim() === '' || password === '') return;
    pwSubmitting = true;
    try {
      const { user } = await api.loginWithPassword({ username: username.trim(), password });
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
  <h1>{m().auth.loginTitle}</h1>

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
        void handleLogin();
      }}
    >
      <label for="username">{m().auth.usernameLabel}</label>
      <input
        id="username"
        name="username"
        type="text"
        autocomplete="username webauthn"
        placeholder={m().auth.usernamePlaceholder}
        bind:value={username}
      />
      <p class="hint">{m().auth.usernameOptionalHint}</p>

      {#if errorMessage}
        <p class="error" role="alert">{errorMessage}</p>
      {/if}

      <button type="submit" class="primary" disabled={submitting}>
        {submitting ? m().auth.submitting : m().auth.loginWithPasskeyButton}
      </button>
    </form>
  {:else}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void handlePasswordLogin();
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

      <label for="password">{m().auth.passwordLabel}</label>
      <div class="password-input">
        <input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autocomplete="current-password"
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
      {#if passwordFieldError}
        <p class="error" role="alert">{passwordFieldError}</p>
      {/if}

      {#if pwErrorMessage}
        <p class="error" role="alert">{pwErrorMessage}</p>
      {/if}

      <button type="submit" class="primary" disabled={pwSubmitting}>
        {pwSubmitting ? m().auth.submitting : m().auth.loginWithPasswordButton}
      </button>
    </form>
  {/if}

  <p class="switch-link">
    {m().auth.noAccountYet}
    <a href={resolve('/register')}>{m().auth.registerLink}</a>
  </p>
</section>
