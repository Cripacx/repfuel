<script lang="ts">
  import { resolve } from '$app/paths';
  import { m } from '$lib/i18n/index.js';
  import { getUser } from '$lib/auth.svelte.js';

  const user = $derived(getUser());
</script>

{#if user}
  <section class="card">
    <h1>{m().home.greeting} {user.username}</h1>
    <p class="muted">
      {user.role === 'admin' ? m().roles.admin : m().roles.user}
    </p>
    <p class="muted">{m().home.placeholderNotice}</p>

    {#if user.role === 'admin'}
      <p>
        {m().home.adminLinkHint}
        <a href={resolve('/admin')}>{m().home.goToAdmin}</a>
      </p>
    {/if}
  </section>
{/if}
