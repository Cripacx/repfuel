<script lang="ts">
  import { onMount } from 'svelte';
  import type {
    AdminInviteDto,
    AdminSettingsDto,
    AdminUserDto,
    InstanceStatusDto,
    RegistrationMode,
  } from '@repfuel/shared';
  import { requestConfirm } from '$lib/confirm.svelte.js';
  import { api } from '$lib/api.js';
  import { describeError } from '$lib/errors.js';
  import { getLocale, m } from '$lib/i18n/index.js';

  type Tab = 'users' | 'invites' | 'settings' | 'status';

  let activeTab = $state<Tab>('users');
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  let users = $state<AdminUserDto[]>([]);
  let invites = $state<AdminInviteDto[]>([]);
  let settings = $state<AdminSettingsDto | null>(null);
  let status = $state<InstanceStatusDto | null>(null);

  let newInviteUsername = $state('');
  let newInviteExpiresHours = $state(72);
  let creatingInvite = $state(false);
  let copiedInviteId = $state<string | null>(null);
  let settingsSaving = $state(false);

  onMount(async () => {
    try {
      const [usersRes, invitesRes, settingsRes, statusRes] = await Promise.all([
        api.admin.getUsers(),
        api.admin.getInvites(),
        api.admin.getSettings(),
        api.admin.getStatus(),
      ]);
      users = usersRes.users;
      invites = invitesRes.invites;
      settings = settingsRes.settings;
      status = statusRes.status;
    } catch (err) {
      loadError = describeError(err);
    } finally {
      loading = false;
    }
  });

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(getLocale() === 'de' ? 'de-DE' : 'en-US');
  }

  function modeLabel(mode: RegistrationMode): string {
    return mode === 'open' ? m().admin.settings.modeOpen : m().admin.settings.modeInvite;
  }

  async function toggleUserDisabled(user: AdminUserDto): Promise<void> {
    loadError = null;
    try {
      const { user: updated } = await api.admin.updateUser(user.id, {
        disabled: !user.disabledAt,
      });
      users = users.map((u) => (u.id === updated.id ? updated : u));
    } catch (err) {
      loadError = describeError(err);
    }
  }

  async function removeUser(user: AdminUserDto): Promise<void> {
    if (!(await requestConfirm({ message: m().admin.users.confirmDelete, confirmLabel: m().common.delete }))) return;
    loadError = null;
    try {
      await api.admin.deleteUser(user.id);
      users = users.filter((u) => u.id !== user.id);
    } catch (err) {
      loadError = describeError(err);
    }
  }

  async function createInvite(): Promise<void> {
    creatingInvite = true;
    loadError = null;
    try {
      const { invite } = await api.admin.createInvite({
        username: newInviteUsername.trim() || undefined,
        expiresInHours: newInviteExpiresHours,
      });
      invites = [invite, ...invites];
      newInviteUsername = '';
      newInviteExpiresHours = 72;
    } catch (err) {
      loadError = describeError(err);
    } finally {
      creatingInvite = false;
    }
  }

  async function revokeInvite(invite: AdminInviteDto): Promise<void> {
    if (!(await requestConfirm({ message: m().admin.invites.confirmRevoke, confirmLabel: m().admin.invites.revoke }))) return;
    loadError = null;
    try {
      await api.admin.deleteInvite(invite.id);
      invites = invites.filter((i) => i.id !== invite.id);
    } catch (err) {
      loadError = describeError(err);
    }
  }

  function inviteLink(invite: AdminInviteDto): string {
    return `${location.origin}/register?invite=${invite.token}`;
  }

  async function copyInviteLink(invite: AdminInviteDto): Promise<void> {
    try {
      await navigator.clipboard.writeText(inviteLink(invite));
      copiedInviteId = invite.id;
      setTimeout(() => {
        if (copiedInviteId === invite.id) copiedInviteId = null;
      }, 2000);
    } catch {
      // Clipboard-API evtl. nicht verfügbar/erlaubt — der Link steht als Text sichtbar da.
    }
  }

  async function changeRegistrationMode(next: RegistrationMode): Promise<void> {
    if (!settings || settings.registrationMode === next) return;
    settingsSaving = true;
    loadError = null;
    try {
      const res = await api.admin.updateSettings({ registrationMode: next });
      settings = res.settings;
    } catch (err) {
      loadError = describeError(err);
    } finally {
      settingsSaving = false;
    }
  }
</script>

<h1>{m().admin.title}</h1>

{#if loading}
  <p class="muted">{m().common.loading}</p>
{:else}
  {#if loadError}
    <p class="error" role="alert">{loadError}</p>
  {/if}

  <nav class="tabs">
    <button
      type="button"
      class:active={activeTab === 'users'}
      onclick={() => (activeTab = 'users')}
    >
      {m().admin.tabs.users}
    </button>
    <button
      type="button"
      class:active={activeTab === 'invites'}
      onclick={() => (activeTab = 'invites')}
    >
      {m().admin.tabs.invites}
    </button>
    <button
      type="button"
      class:active={activeTab === 'settings'}
      onclick={() => (activeTab = 'settings')}
    >
      {m().admin.tabs.settings}
    </button>
    <button
      type="button"
      class:active={activeTab === 'status'}
      onclick={() => (activeTab = 'status')}
    >
      {m().admin.tabs.status}
    </button>
  </nav>

  {#if activeTab === 'users'}
    <section class="card">
      {#if users.length === 0}
        <p class="empty-state">{m().admin.users.empty}</p>
      {:else}
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{m().admin.users.columnUsername}</th>
                <th>{m().admin.users.columnRole}</th>
                <th>{m().admin.users.columnCreatedAt}</th>
                <th>{m().admin.users.columnStatus}</th>
                <th>{m().common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {#each users as user (user.id)}
                <tr>
                  <td>{user.username}</td>
                  <td>{user.role === 'admin' ? m().roles.admin : m().roles.user}</td>
                  <td>{formatDateTime(user.createdAt)}</td>
                  <td>
                    <span class="badge" class:ok={!user.disabledAt} class:off={!!user.disabledAt}>
                      {user.disabledAt
                        ? m().admin.users.statusDisabled
                        : m().admin.users.statusActive}
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="secondary" onclick={() => toggleUserDisabled(user)}>
                        {user.disabledAt ? m().admin.users.enable : m().admin.users.disable}
                      </button>
                      <button type="button" class="danger" onclick={() => removeUser(user)}>
                        {m().admin.users.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  {/if}

  {#if activeTab === 'invites'}
    <section class="card">
      <h2>{m().admin.invites.createTitle}</h2>
      <form
        onsubmit={(event) => {
          event.preventDefault();
          void createInvite();
        }}
      >
        <div class="field-row">
          <div>
            <label for="invite-username">{m().admin.invites.usernameLabel}</label>
            <input id="invite-username" type="text" bind:value={newInviteUsername} />
          </div>
          <div>
            <label for="invite-expires">{m().admin.invites.expiresLabel}</label>
            <input
              id="invite-expires"
              type="number"
              min="1"
              max={24 * 90}
              bind:value={newInviteExpiresHours}
            />
          </div>
        </div>
        <button type="submit" class="primary" disabled={creatingInvite}>
          {creatingInvite ? m().common.loading : m().admin.invites.createButton}
        </button>
      </form>
    </section>

    <section class="card">
      {#if invites.length === 0}
        <p class="empty-state">{m().admin.invites.empty}</p>
      {:else}
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{m().admin.invites.columnUsername}</th>
                <th>{m().admin.invites.columnLink}</th>
                <th>{m().admin.invites.columnExpiresAt}</th>
                <th>{m().admin.invites.columnUsed}</th>
                <th>{m().common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {#each invites as invite (invite.id)}
                <tr>
                  <td>{invite.username ?? '—'}</td>
                  <td>
                    <div class="invite-link">
                      <code>{inviteLink(invite)}</code>
                      <button type="button" class="secondary" onclick={() => copyInviteLink(invite)}>
                        {copiedInviteId === invite.id ? m().common.copied : m().admin.invites.copyLink}
                      </button>
                    </div>
                  </td>
                  <td>{formatDateTime(invite.expiresAt)}</td>
                  <td>{invite.usedAt ? formatDateTime(invite.usedAt) : m().admin.invites.notUsed}</td>
                  <td>
                    <button type="button" class="danger" onclick={() => revokeInvite(invite)}>
                      {m().admin.invites.revoke}
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  {/if}

  {#if activeTab === 'settings' && settings}
    <section class="card">
      <h2>{m().admin.settings.registrationModeLabel}</h2>
      <form>
        <label>
          <input
            type="radio"
            name="registration-mode"
            checked={settings.registrationMode === 'open'}
            disabled={settingsSaving}
            onchange={() => changeRegistrationMode('open')}
          />
          {m().admin.settings.modeOpen}
        </label>
        <label>
          <input
            type="radio"
            name="registration-mode"
            checked={settings.registrationMode === 'invite'}
            disabled={settingsSaving}
            onchange={() => changeRegistrationMode('invite')}
          />
          {m().admin.settings.modeInvite}
        </label>
      </form>
      <p class="hint">
        {m().admin.settings.configuredHint}
        {modeLabel(settings.configuredMode)}
      </p>
    </section>
  {/if}

  {#if activeTab === 'status' && status}
    <section class="card">
      <dl>
        <dt>{m().admin.status.versionLabel}</dt>
        <dd>{status.version}</dd>
        <dt>{m().admin.status.modeLabel}</dt>
        <dd>{modeLabel(status.registrationMode)}</dd>
        <dt>{m().admin.status.userCountLabel}</dt>
        <dd>{status.userCount}</dd>
      </dl>
    </section>
  {/if}
{/if}
