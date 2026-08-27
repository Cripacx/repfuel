<script lang="ts">
  import { onMount } from 'svelte';
  import { startRegistration } from '@simplewebauthn/browser';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { RegistrationMode } from '@repfuel/shared';
  import { api } from '$lib/api.js';
  import { setUser } from '$lib/auth.svelte.js';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';

  let username = $state('');
  let inviteToken = $state(page.url.searchParams.get('invite') ?? '');
  let submitting = $state(false);
  let loadingMode = $state(true);
  let errorMessage = $state<string | null>(null);
  let mode = $state<RegistrationMode>('open');
  let bootstrap = $state(false);

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

  <p class="switch-link">
    {m().auth.haveAccountAlready}
    <a href={resolve('/login')}>{m().auth.loginLink}</a>
  </p>
</section>
