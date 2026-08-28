<script lang="ts">
  import { api } from '$lib/api.js';
  import { passwordsMatch, validatePasswordPolicy } from '$lib/auth-validation.js';
  import { getUser, setUser } from '$lib/auth.svelte.js';
  import { describeError } from '$lib/errors.js';
  import { m } from '$lib/i18n/index.js';

  const user = $derived(getUser());

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
{/if}
