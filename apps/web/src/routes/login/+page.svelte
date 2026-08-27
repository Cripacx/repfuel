<script lang="ts">
  import { startAuthentication } from '@simplewebauthn/browser';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { api } from '$lib/api.js';
  import { setUser } from '$lib/auth.svelte.js';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';

  let username = $state('');
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
</script>

<section class="card auth-card">
  <h1>{m().auth.loginTitle}</h1>

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

  <p class="switch-link">
    {m().auth.noAccountYet}
    <a href={resolve('/register')}>{m().auth.registerLink}</a>
  </p>
</section>
